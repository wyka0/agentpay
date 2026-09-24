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
