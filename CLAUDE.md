# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend
npm run dev          # Next.js dev server (requires Node 20)
npm run build        # Production build
npm run lint         # ESLint (lint errors do NOT block builds — ignoreDuringBuilds: true)

# Contracts (run from contracts/)
forge build
forge test
forge test --match-test <TestName>   # single test

# CRE Workflows (run from cre-workflows/)
cre workflow simulate --workflow blue-review
cre workflow simulate --workflow auto-execute
cre workflow simulate --workflow trade-execute

# Utility scripts (tsx, run from repo root)
npm run check-treasury
npm run check-blue-wallet
npm run seed:blue-rag
```

## Architecture

### Frontend — Next.js 14 App Router
Pages live under `app/`. Public-facing routes: `/` (landing), `/home` (dashboard — **not** the landing page), `/community`, `/markets`, `/course`, `/quests`, `/simulation`, `/styleguide`.

Check `app/styleguide/page.tsx` for existing reusable components before building new UI. The design token file is `components/design-tokens.ts`; use `--font-*` CSS variables, never raw font names.

**Font tokens** (defined in `styles/globals.css`):
- `--font-body` → Inter
- `--font-primary` → Poppins
- `--font-secondary` → Space Grotesk
- `--font-mono` / `--font-button` / `--font-code` → Departure Mono

### Auth
All auth flows resolve to a wallet address. `lib/wallet-auth.ts` checks in order: (1) Privy JWT `Authorization` header, (2) Privy `privy-token` cookie, (3) legacy signed message, (4) agent API key (`mwa_ag_...`). Call `getCurrentUserFromRequestCookie()` from `lib/auth.ts` in API routes — never roll your own auth.

### Database
Direct PostgreSQL via `pg` pool (not the Supabase JS client). Always import `sqlQuery` from `lib/db.ts`. Use named parameters: `:paramName`. IPv4-first DNS is enforced in the pool config.

Schema migrations are handled by `lib/ensureXxxSchema.ts` modules — call the relevant `ensureXxxSchema()` once at the top of the API route that owns that table. No external migration runner.

`lib/safe-storage.ts` — use instead of raw `localStorage`/`sessionStorage` everywhere; direct access throws in private browsing and sandboxed contexts.

Rate limiting is in-memory (`lib/rate-limit.ts`). It resets on cold starts; for production multi-instance use, this would need Redis.

### Smart Contracts (Base Mainnet — 2026-05-21 redeploy)
| Contract | Address |
|----------|---------|
| BlueKillStreak (governance) | `0x09a4FEfEe8245B644713546FDF28b4160218f7Fc` |
| BlueMarketTrader (trading treasury) | see `NEXT_PUBLIC_AZURA_MARKET_TRADER_ADDRESS` |
| EtherealHorizonPathway (12-week seals) | see `NEXT_PUBLIC_PATHWAY_CONTRACT_ADDRESS` |
| SurveyCertificates | `0x9396…Bf9` |
| MockPredictionMarket | local/test only |

Old `0x2cbb…` governance address is deprecated. `contracts/` uses Foundry with `solc 0.8.30` and OpenZeppelin via remapping. Fuzz runs = 256.

### CRE Workflows
`cre-workflows/` is a self-contained package (own `package.json`, `tsconfig.json`). Three workflows: `blue-review` (event-triggered AI scoring), `auto-execute` (cron proposal execution), `trade-execute` (event-triggered trading). All write back on-chain via DON-signed `onReport()`. The autonomous Kalshi scanner is a Vercel cron, not CRE.

### Blue — AI Agent
Blue chat uses `lib/eliza-api.ts` → Eliza Cloud (`ELIZA_API_BASE_URL`). Eliza Cloud requires `stream: true` (upstream bug); multi-turn falls back to DeepSeek native. Server-side LLM clients must send a browser `User-Agent` header or Cloudflare blocks with 403.

Blue's wallet key is `AZURA_PRIVATE_KEY`. `BLUE_PRIVATE_KEY` falls back to `AZURA_PRIVATE_KEY` when blank — the rename is incomplete. Blue's wallet address: `0x0920…4f8a`.

Blue RAG lives in `lib/blue-rag-*.ts`. Seed with `npm run seed:blue-rag`.

### Markets
`lib/market-api.ts` is a re-export shim pointing at `lib/kalshi-api.ts`. Polymarket is deprecated — do not add new Polymarket imports. The CLOB env vars are legacy.

### Deployment
Vercel Hobby plan (`academy-v3`). `vercel.json` crons must be `@daily` or longer — more frequent crons fail the deploy silently.

### Key env vars
See `.env.example` for the full list. The most load-bearing:
- `DATABASE_URL` — Supabase pooler connection string
- `AZURA_PRIVATE_KEY` — Blue's signing key (never expose client-side)
- `ELIZA_API_KEY` + `ELIZA_API_BASE_URL` — Blue chat
- `PRIVY_APP_ID` / `NEXT_PUBLIC_PRIVY_APP_ID` — wallet auth
- `CRON_SECRET` / `INTERNAL_API_SECRET` / `ADMIN_SECRET` — server-to-server auth
- `NEXT_PUBLIC_SCATTER_COLLECTION_ADDRESS` — required for USDC quest payouts
