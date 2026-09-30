# AgentPay

Autonomous **USDC payments** for AI agents, gated by **programmable spending policies**, built for the Arc Microgrants event (BUIDL #2).

> **The agent decides whether a service is useful. The policy engine decides whether the agent is allowed to pay.**

**Sprint 3 status:** persistent confirmed-payment ledger. Confirmed on-chain payments are stored in a browser-local repository, restored on load, and used by the policy engine for daily spend accounting. Sprint 3 adds **no** blockchain writes: no signing, no transfers, no new transactions.

## Stack

- Next.js (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS v4
- viem
- Vitest

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Vitest unit tests. |

## Arc network configuration

All Arc constants live in **one module**: `lib/arc/network.ts`. Values were verified against the official Arc documentation on 2026-09-21
(`docs.arc.io/arc/references/connect-to-arc` and `.../contract-addresses`):

| Parameter | Mainnet (default) | Testnet |
| --- | --- | --- |
| Chain id | `5042` | `5042002` |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | same |
| USDC ERC-20 decimals | `6` | `6` |
| Native gas USDC decimals | `18` | `18` |

Arc uses USDC as its native gas token (18 decimals). The optional ERC-20 interface
uses 6 decimals and shares the same underlying balance, so AgentPay shows a **single
USDC balance** read through the ERC-20 interface.

Select the network with `NEXT_PUBLIC_ARC_NETWORK=mainnet|testnet`. See `.env.example`.

## Environment

```bash
cp .env.example .env.local
```

Everything is optional:

- `NEXT_PUBLIC_ARC_NETWORK` — `mainnet` (default) or `testnet`.
- `NEXT_PUBLIC_ARC_RPC_URL` — optional RPC override; otherwise the documented endpoint is used.
- `NEXT_PUBLIC_AGENTPAY_<SERVICE>_RECIPIENT` — the demo payment recipient per service.

No private keys are ever required or stored: the user's injected wallet signs the transaction.

### Payment recipients

AgentPay never invents a recipient, never uses the zero address, and never silently pays the
connected user's own address. Each service needs an explicitly configured demo recipient:

```
NEXT_PUBLIC_AGENTPAY_MARKET_DATA_RECIPIENT=
NEXT_PUBLIC_AGENTPAY_RESEARCH_REPORT_RECIPIENT=
NEXT_PUBLIC_AGENTPAY_AI_SUMMARY_RECIPIENT=
```

Until one is set, the flow is blocked with `Payment recipient not configured` and the wallet is
never contacted. These are demo/test recipients, not production providers.

## Project structure

```text
app/                 App Router routes, layout, global styles
components/          Brutalist dashboard UI + wallet/payments providers
lib/
  wallet/            client.ts (EIP-1193), state.ts, session.ts (pure state machine)
  arc/               network.ts, client.ts, usdc.ts, payment.ts
  agent/             decision.ts (agent chooses), policy.ts (policy gates)
  services/          registry.ts (local demo services)
  payments/          store.ts (typed client-side payment state)
  demo/              Local demo agent, policy, and empty payment list
types/               Agent, SpendingPolicy, Service, Payment
tests/               Vitest unit tests
docs/PRD.md          Product requirements
```

## Architecture

### Wallet access is separate from Arc data access

- `lib/wallet/client.ts` — the only place that touches an injected EIP-1193 provider
  (detect, `eth_requestAccounts`, `eth_chainId`, subscriptions, explicit network switch).
- `lib/wallet/state.ts` / `session.ts` — a pure, testable state machine plus selectors.
  No React, no network calls.
- `lib/arc/*` — Arc network config and a read-only viem client. The transport is
  injectable, so balance reads can route through the connected wallet (avoiding RPC
  CORS issues) without leaking wallet types into Arc code.
- `components/wallet-provider.tsx` — the only component that orchestrates the two.
  UI components consume typed selectors and contain **no RPC logic**.

### Read-only by construction

- `lib/wallet/client.ts` is the only module that touches injected-wallet account/chain reads.
- `lib/wallet/payment.ts` is the only module that submits a transaction, and it exposes a
  narrow `sendUsdcTransfer(approvedPaymentRequest)` — never a generic `sendTransaction`.
- The agent and policy layers do not import the sender. An architecture test enforces this:
  `eth_sendTransaction` may appear in exactly one file.
- `lib/arc/payment.ts` is the only place that encodes the ERC-20 `transfer` calldata.

### Policy-gated payment flow

```
service → agent decision → policy gate → approved PaymentRequest
        → user confirmation → wallet send → Arc receipt → confirmed
```

`lib/payments/gate.ts` is the **only** function that can produce an approved `PaymentRequest`.
It reuses the existing policy engine (`lib/agent/policy.ts`) and additionally resolves a
configured recipient. If it returns `blocked`, no confirmation action is rendered and the wallet
is never contacted.

`components/payment-flow-provider.tsx` orchestrates the flow. It is the only component that calls
the wallet sender and only from the user's **Confirm & Pay** click.

### Persistent ledger and daily accounting

```
components → providers → payment store → payment repository → storage
```

- `lib/payments/storage.ts` — the **only** module that touches `localStorage`. Exposes a
  `KeyValueStorage` interface plus an in-memory fallback.
- `lib/payments/repository.ts` — `PaymentHistoryRepository` (`load` / `save` / `saveMany` /
  `clear`). Owns persistence and re-validates every record on read and write.
- `lib/payments/records.ts` — the single definition of a persistable record
  (`isValidConfirmedPayment`) and the store↔record mappers.
- `lib/payments/store.ts` — pure reducer; `payment/hydrated` restores records, and
  `selectConfirmedPayments` derives the canonical confirmed history.
- `lib/agent/policy.ts` — `sumConfirmedToday` / `buildSpendingSummary`; daily spend counts
  **confirmed payments only**, using local-time day boundaries (`lib/time.ts`).

A payment is only persisted when it is `confirmed`, has a real 32-byte tx hash, and is on a
supported Arc chain. Pending, submitted, failed, blocked, and cancelled requests are never
stored. Malformed or corrupted stored data is dropped rather than crashing the app.

### Security limitation — browser-local persistence

> **Browser-local persistence is not a trusted security boundary.** It provides continuity across
> reloads for the demo, but it cannot independently enforce spending limits against a malicious
> client. Anyone with access to the browser can edit or delete the stored ledger.
>
> Autonomous spending limits require a trusted server/agent execution boundary; the client-side
> ledger must not be relied on for that. Clearing browser storage does **not** reverse, cancel, or
> delete any on-chain transaction.

### Balance honesty

`readUsdcBalance` returns a discriminated result. A failure is `{ ok: false }` and the UI
renders **Balance unavailable** — never `0 USDC`. A genuine on-chain zero is the only
way the UI shows `0.00`.

### Payment state model (Sprint 2 foundation)

`lib/payments/store.ts` is a pure reducer over `idle | pending | submitted | confirmed | failed`
with an enforced transition graph. Sprint 1 never dispatches a creating action, so the
ledger stays empty and no transaction can be implied.

## Data honesty

- Unknown wallet/balance data renders as `Not connected`, `—`, or `Balance unavailable`.
- Live values are tagged `LIVE`; demo agent/policy/service data is tagged `DEMO`.
- `DEMO_PAYMENTS` / the payment ledger is empty and never seeded with samples.
- `.env.example` contains no invented RPC URLs or token addresses.

## Tests

```bash
npm test
```

127 tests across 11 files: Arc network constants, USDC formatting, the no-fake-balance guarantee,
wallet session states, error normalisation, policy rules, the payment gate, USDC calldata
encoding, the wallet sender (with a mocked provider), payment state transitions, persistence and
record validation, daily accounting, hydration/reload, and the security-boundary architecture
checks.

## Status

Sprint 3 — persistent confirmed-payment ledger and daily accounting complete. Autonomous
spending, server-side persistence, and service fulfilment are later sprints.
See [`docs/PRD.md`](docs/PRD.md).

## Judge Demo

A concise 2–3 minute demo path using only functionality that is already proven in production:

1. **Open the landing page** — `https://agentpay-self.vercel.app/`
   - Shows the brutalist landing page with HeroSystemDiagram (animated packet flow), all sections (Trust, Agent Origins, AgentPay Flow, How It Works, Policy, Services, Execution Terminal, Trusted Ledger, Arc, Security, CTA).
   - "OPEN AGENTPAY" CTA navigates to `/app`.

2. **Open AgentPay** — `https://agentpay-self.vercel.app/app`
   - **Agent Runtime**: Research Agent (ACTIVE), wallet status, USDC balance.
   - **Policy Rules**: Max/transaction $1.00, Daily limit $5.00, 3 approved categories (research, data, ai), Network: ARC MAINNET (chain 5042), Policy Authority: SERVER.
   - **Service Registry**: 3 services with category accents — Market Data ($0.10 USDC, DATA), Research Report ($0.25 USDC, RESEARCH), AI Summary ($0.05 USDC, AI). Each shows description and "Request Payment".

3. **Create a payment request** (demo, no blockchain):
   - Click "Request Payment" on Market Data → Payment Panel shows intent details (amount $0.10 USDC, recipient, network, agent).
   - **Explain**: "Real payment requires explicit human wallet approval on Arc Mainnet."

4. **Do NOT create another payment during the prepared demo**.
   - The demo stops at the payment intent. Real payment requires explicit human wallet approval (wallet connection, EIP-191 sign-in, USDC transfer on Arc).

5. **Use the existing fulfilled request** to demonstrate the complete post-payment flow:
   - The existing request `pay_cef94b43-f4f4-4441-9ff0-0d4922cca164` was fulfilled with a real Arc transaction.
   - Transaction: `0xc68d4deda9b23cf4b9dcba638f3818ea9099c5516d1153861e4154e825a91d03` (0.10 USDC on Arc Mainnet chain 5042).
   - Trusted Payment: `pay_1ebef85c-303a-4bff-bbf4-eb0c05bafdd7` (confirmed).
   - **ServiceResultDisplay v2** shows: BTC price, 24h change, 24h volume, source, provider, timestamp.
   - **Trusted Ledger** panel shows the PipelineVisualization (AGENT → AGENTPAY → POLICY → PAYMENT → ARC → VERIFY → SERVICE → RESULT) with animated nodes.
   - The trusted ledger is server-authoritative; browser storage is labeled "CACHE ONLY".

6. **External agent API result retrieval**:
   - Agent creates request: `POST /api/agent/v1/requests` with API key → returns `payment_required` with intent.
   - After fulfillment: `GET /api/agent/v1/requests/:id/result` with same API key → returns `ServiceResult`.

### Important Notes for the Demo

- **No new payment is created during the prepared demo.** The existing real Arc payment (`0xc68d4deda9b23cf4b9dcba638f3818ea9099c5516d1153861e4154e825a91d03`, 0.10 USDC on Arc Mainnet chain 5042) is already on-chain and verified. Its trusted payment is `pay_1ebef85c-303a-4bff-bbf4-eb0c05bafdd7`.
- **LOCAL DEMO** (enabled via the checkbox in Pending Agent Requests) simulates the payment → fulfillment lifecycle **without an on-chain transaction**. It is clearly labeled "LOCAL DEMO" throughout the UI.
- **REAL ARC SETTLEMENT** vs **LOCAL DEMO** are visually distinct throughout the application.

## CoinGecko Provider Status (Honest)

Production configuration:
```
MARKET_DATA_PROVIDER=coingecko
```
Set in Vercel Production environment.

Production diagnostic confirms:
```json
{
  "provider": "coingecko",
  "adapter": "marketDataCoinGeckoAdapter",
  "live": true
}
```

Adapter path:
```
fulfillServiceRequest
→ getServiceAdapter("market-data")
→ getMarketDataAdapter()
→ marketDataCoinGeckoAdapter
→ CoinGecko /simple/price
```

**Important**: The existing paid request (`pay_cef94b43...`) was fulfilled **before** the CoinGecko provider was enabled, so its stored result shows `source: demo`, `provider: demo`. **Live CoinGecko fulfillment is configured and wired into production, but no additional payment was made solely to prove CoinGecko.** A new paid production fulfillment would use CoinGecko, but no new payment was made for this demo.

## Real ARC Payment Proof

The project has a real Arc Mainnet settlement proof:

- **Network**: Arc Mainnet (Chain ID: 5042)
- **Transaction**: `0xc68d4deda9b23cf4b9dcba638f3818ea9099c5516d1153861e4154e825a91d03`
- **Amount**: 0.10 USDC
- **Trusted Payment**: `pay_1ebef85c-303a-4bff-bbf4-eb0c05bafdd7` (confirmed)
- **Service Result**: `pay_250157fc-4bb4-4b7d-a728-627370727019` (status: READY)
- **Verified on**: Arc Explorer (independent server verification)

This transaction was independently verified by the AgentPay server against the Arc RPC and recorded in the trusted ledger. It is the authoritative proof of settlement. No additional transaction was created for this demo.

## External Agent Integration

The external agent lifecycle:

```
Agent
  → POST /api/agent/v1/requests (with API key)
  → payment_required (intent created)
  → Human approval (wallet sign, Arc verification)
  → fulfillment_pending
  → Service fulfillment
  → GET /api/agent/v1/requests/:id/result (with same API key)
  → ServiceResult returned to agent
```

**Authentication differences**:

| Operation | Uses |
|-----------|------|
| Create request | Agent API key |
| Get request | Agent API key |
| Get result | Agent API key |
| Register agent | Human wallet session (EIP-191) |
| View pending approvals | Human wallet session |
| View payment intent | Human wallet session |
| Approve/reject/fulfill | Human wallet session |

The agent decides *what* to request. The human decides *whether to pay*. The server decides *whether the policy allows it*. Arc settles. The server verifies.

## Status

Sprint 3 — persistent confirmed-payment ledger and daily accounting complete. Autonomous
spending, server-side persistence, and service fulfilment are later sprints.
See [`docs/PRD.md`](docs/PRD.md).
