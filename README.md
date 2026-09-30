# AgentPay

Controlled **USDC payments** for AI agents, gated by **programmable spending policies** and **explicit human approval**, built on **Arc**.

> **The agent decides whether a service is useful. The policy engine decides whether the agent is allowed to pay.**

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

All Arc constants live in **one module**: `lib/arc/network.ts`. Values were verified against the official Arc documentation on 2026-09-21 (`docs.arc.io/arc/references/connect-to-arc` and `.../contract-addresses`):

| Parameter | Mainnet (default) | Testnet |
| --- | --- | --- |
| Chain id | `5042` | `5042002` |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | same |
| USDC ERC-20 decimals | `6` | `6` |
| Native gas USDC decimals | `18` | `18` |

Arc uses USDC as its native gas token (18 decimals). The optional ERC-20 interface uses 6 decimals and shares the same underlying balance, so AgentPay shows a **single USDC balance** read through the ERC-20 interface.

Select the network with `NEXT_PUBLIC_ARC_NETWORK=mainnet|testnet`. See `.env.example`.

## Environment

```bash
cp .env.example .env.local
```

Everything is optional:

- `NEXT_PUBLIC_ARC_NETWORK` — `mainnet` (default) or `testnet`.
- `NEXT_PUBLIC_ARC_RPC_URL` — optional RPC override; otherwise the documented endpoint is used.
- `NEXT_PUBLIC_AGENTPAY_<SERVICE>_RECIPIENT` — the demo payment recipient per service.
- `MARKET_DATA_PROVIDER` — `coingecko` or `demo` (default: `demo`).

No private keys are ever required or stored: the user's injected wallet signs the transaction.

### Payment recipients

AgentPay never invents a recipient, never uses the zero address, and never silently pays the connected user's own address. Each service needs an explicitly configured demo recipient:

```
NEXT_PUBLIC_AGENTPAY_MARKET_DATA_RECIPIENT=
NEXT_PUBLIC_AGENTPAY_RESEARCH_REPORT_RECIPIENT=
NEXT_PUBLIC_AGENTPAY_AI_SUMMARY_RECIPIENT=
```

Until one is set, the flow is blocked with `Payment recipient not configured` and the wallet is never contacted. These are demo/test recipients, not production providers.

## Project structure

```text
app/
  page.tsx                    # Landing page (brutalist marketing)
  app/page.tsx                # Application dashboard
  layout.tsx                  # Root layout, providers
  globals.css                 # Brutalist theme, animations
  api/
    agent/v1/                 # External agent API
      requests/               # POST create, GET list, GET :id, GET :id/result, GET :id/intent
      pending/                # GET pending approvals (human auth)
    auth/                     # EIP-191 authentication
      challenge/, verify/, session/, logout/
    services/requests/        # Server-side service fulfillment
      [id]/fulfill, /reject, /reconcile, /result
    payments/                 # Payment verification, recovery, history
    diagnostics/              # Read-only market-data provider health
components/
  landing/                    # Landing page sections (Hero, HowItWorks, Services, Policy, Security, etc.)
  service-request-panel.tsx   # Service selection → execution → fulfillment → result
  pending-agent-requests.tsx  # Human approval queue (approve/reject/fulfill)
  services-panel.tsx          # Service registry with category accents
  payment-panel.tsx           # Payment intent, approval, verification
  trusted-ledger-panel.tsx    # Server-authoritative ledger + PipelineVisualization
  agent-registry.tsx          # Agent registration + API key management
  agent-execution-provider.tsx# Controlled execution loop (intent → sign → verify)
  payment-flow-provider.tsx   # Client-side payment state machine
  trusted-ledger-panel.tsx    # Server-authoritative trusted ledger
  pipeline-visualization.tsx  # Animated workflow (AGENT→AGENTPAY→POLICY→PAYMENT→ARC→VERIFY→SERVICE→RESULT)
  card.tsx, section-label.tsx # Brutalist UI primitives
lib/
  auth/                       # EIP-191 authentication (challenge/verify, session cookie, nonce)
    challenge/, verify/, session/, repository/, cookie/, ownership/
  agent/
    sdk.ts                    # External agent client (create request, get result)
    execution.ts              # Controlled execution loop (intent → sign → verify)
    policy.ts                 # Server-side policy engine (daily limits, categories)
    repository.ts             # Agent persistence
  arc/
    client.ts                 # Read-only viem client (Arc RPC)
    network.ts                # Arc network constants (chain 5042, USDC, gas)
    payment.ts                # USDC transfer encoding
    client.ts                 # Read-only viem client
  auth/
    session.ts                # Server-side session resolution
    challenge/                # EIP-191 challenge generation/verification
    cookie.ts                 # HttpOnly, SameSite=Lax, Secure session cookie
    nonce.ts                  # Single-use challenge nonce (10 min TTL)
    repository/               # Session persistence (Postgres + memory)
  arc/                        # Arc network constants, viem client, USDC transfer
  payments/
    gate.ts                   # Policy evaluation → approved PaymentRequest
    verify.ts                 # Arc transaction verification → trusted payment
    reconcile.ts              # Intent reconciliation
    store.ts                  # Client-side payment state machine
  services/
    registry.ts               # Local demo services (market-data, research-report, ai-summary)
    adapters.ts               # Service adapter registry
    market-data/
      coingecko.ts            # CoinGecko /simple/price adapter
      provider.ts             # Provider selection (demo vs coingecko)
      adapter.ts              # Service adapter interface
  services/                   # Service registry, adapters, market-data (CoinGecko)
  auth/                       # EIP-191 challenge/verify, session cookie, nonce
  agent/                      # Agent SDK, policy engine, execution loop
  demo/                       # Local demo agent, policy, empty payment list
  security/                   # Rate limiting, headers, origin guard, request body limits
types/                         # Agent, SpendingPolicy, Service, Payment, ServiceRequest, ServiceResult
tests/                         # Vitest unit tests (439 tests)
examples/
  research-agent/             # External agent integration example
docs/
  PRD.md                      # Product requirements
  AGENT-INTEGRATION.md        # External agent SDK documentation
```

## Architecture

### External Agent → Service Result

```
External Agent
      ↓
Agent API
      ↓
Server Policy
      ↓
Payment Intent
      ↓
Human Wallet Approval
      ↓
Arc USDC Settlement
      ↓
Server Verification
      ↓
Trusted Ledger
      ↓
Service Fulfillment
      ↓
Service Result
      ↓
External Agent
```

1. **Agent requests a service** via `POST /api/agent/v1/requests` with its API key.
2. **Server evaluates policy** — daily limits, per-transaction limits, allowed categories, trusted spend.
3. **AgentPay creates a payment intent** — immutable amount, recipient, chain (Arc 5042), expiry.
4. **Human wallet owner explicitly approves** — wallet connection, EIP-191 sign-in, explicit USDC transfer on Arc.
5. **USDC settles on Arc Mainnet (chain 5042)** — native gas token is USDC.
6. **Server independently verifies** the Arc transaction against the intent (amount, recipient, sender, token).
7. **Trusted ledger records the confirmed payment** — server-authoritative, immutable record.
8. **Service is fulfilled** — only after trusted payment confirmation; service adapter executes.
9. **External agent retrieves the result** — `GET /api/agent/v1/requests/:id/result` with API key.

### Controlled Wallet Execution

AgentPay does not give agents private keys. Agents cannot directly submit wallet transactions.

- The server creates a payment intent.
- Human approval is required.
- The connected wallet signs the USDC transfer.
- AgentPay verifies the resulting Arc transaction server-side.
- Service fulfillment does not create another payment.

Payment execution exists, but is deliberately controlled: the server creates the intent, the human signs, the server verifies, the ledger records.

### Trusted Ledger (Server-Authoritative)

The trusted payment ledger is **server-authoritative**.

- Browser `localStorage` is **UI/cache only** — labeled "CACHE ONLY" in the UI.
- The trusted ledger is the **only source of truth** for policy decisions and spend accounting.
- Browser-local persistence provides UI continuity across reloads but is **not a security boundary**.
- Malformed or corrupted browser data is dropped; the server ledger remains authoritative.

> **Browser-local persistence is not a trusted security boundary.** It provides continuity across reloads for the demo, but it cannot independently enforce spending limits against a malicious client. Anyone with access to the browser can edit or delete the stored ledger. Autonomous spending limits require a trusted server/agent execution boundary; the client-side ledger must not be relied on for that. Clearing browser storage does **not** reverse, cancel, or delete any on-chain transaction.

### Balance Honesty

`readUsdcBalance` returns a discriminated result. A failure is `{ ok: false }` and the UI renders **Balance unavailable** — never `0 USDC`. A genuine on-chain zero is the only way the UI shows `0.00`.

### Data Honesty

- Unknown wallet/balance data renders as `Not connected`, `—`, or `Balance unavailable`.
- Live values are tagged `LIVE`; demo agent/policy/service data is tagged `DEMO`.
- `DEMO_PAYMENTS` / the payment ledger is empty and never seeded with samples.
- `.env.example` contains no invented RPC URLs or token addresses.

## Security Model

Verified security features in the current codebase:

- **EIP-191 wallet authentication** — challenge/verify flow, single-use nonce (10 min TTL).
- **HttpOnly session cookie** — `SameSite=Lax`, `Secure` in production, 12-hour TTL.
- **Authenticated wallet ownership** — session bound to wallet address; ownership enforced on approve/reject/fulfill.
- **Agent API keys** — bcrypt-hashed, ownership tied to wallet address.
- **Rate limiting** — on API routes.
- **Security headers** — CSP, HSTS, origin guard, request body limits.
- **CSP** — configured in `next.config.ts`.
- **Server-side authorization** — owner checks on approve, reject, fulfill; agent API key ownership verified.
- **Trusted server ledger** — server-authoritative payment records; browser cache labeled "CACHE ONLY".
- **Private keys/seed phrases** — never stored, never generated.
- **Sensitive log redaction** — structured logging with redaction.
- **Agent API key hashing** — bcrypt, ownership tied to wallet.

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

## Tests

```bash
npm test
```

**439/439 tests passed** across 29 test files covering:
- Arc network constants, USDC formatting, no-fake-balance guarantee
- Wallet session states, error normalization, policy rules
- Payment gate, USDC calldata encoding, wallet sender (mocked provider)
- Payment state transitions, persistence and record validation
- Daily accounting, hydration/reload, security-boundary architecture checks
- Authentication, rate limiting, security headers, origin guard
- Service fulfillment, trusted accounting, payment gate
- Wallet session, payment, errors, ARC USDC encoding
- Architecture boundary checks (no private keys in browser code)

All quality gates pass:
- **Tests**: 439/439 passed
- **TypeCheck**: Passed (`tsc --noEmit`)
- **Lint**: Passed (0 errors, pre-existing warnings only)
- **Build**: Passed (`next build`)

## Production Status

AgentPay is deployed on Arc Mainnet infrastructure.

- `/` is the public brutalist landing page.
- `/app` is the application/dashboard.
- External agents can create service requests through the API.
- Human approval controls payment.
- Arc transactions are independently verified.
- Confirmed payments are recorded in the trusted ledger.
- Services can be fulfilled after confirmed payment.
- Demo Mode is available for no-spend demonstrations.
- Production deployment on Vercel with automatic CI/CD from `origin/master`.

No autonomous private-key-based spending. The agent requests, the human approves, the server verifies.

---

*No private keys are ever required or stored. The user's injected wallet signs the transaction.*