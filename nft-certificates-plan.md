# Plan: Mintable NFT Certificates for Survey Completion

Status: Draft / requirements-gathering. Nothing here is built yet. This document
exists so we can collect the artwork and configuration Blue needs to deploy the
certificate contract safely and route any proceeds to the multisig treasury.

## Goal

When a member finishes a survey, they can mint an NFT "certificate" that proves
completion. Certificates are a keepsake and an on-chain credential. Any USDC/ETH
collected from minting must flow to the MWA multisig treasury, not to an
individual wallet.

## How this fits the current app

- Surveys complete through `app/api/survey/process/route.ts` (the surveys page at
  `app/surveys/page.tsx` POSTs there). That endpoint is the natural place to mark
  a wallet "eligible to mint" once a survey is genuinely finished.
- Contracts live in `contracts/src` and are built/deployed with Foundry
  (`contracts/foundry.toml`). Existing examples: `BlueKillStreak.sol`,
  `BlueMarketTrader.sol` (treasury), `EtherealHorizonPathway.sol`.
- Blue already moves funds and NFTs from her CDP wallet (`lib/blue-wallet.ts`,
  `lib/blue-membership.ts`), and the app verifies on-chain ownership the way
  `lib/vip-membership-card.ts` and the new `lib/academic-angels.ts` do. The
  certificate flow should reuse these patterns.

## Open questions to resolve before building

These each change the contract and the flow, so we need answers first.

1. **One contract or one per survey?**
   - Option A: a single `SurveyCertificates` ERC-1155 where each survey is a
     distinct token id (cheap, one deploy, easy to add new surveys).
   - Option B: one ERC-721 contract per survey/cohort (heavier, but each is a
     clean standalone collection).
   - Recommendation: ERC-1155, one token id per survey.

2. **Soulbound or transferable?** Certificates of completion usually should be
   non-transferable (soulbound) so they can't be bought/sold to fake completion.
   If they are soulbound, "route the sales to the treasury" only applies to the
   mint fee, not a secondary market.

3. **Is minting free or paid?**
   - If free: gas only; "sales to treasury" is moot (no proceeds). Confirm whether
     there is a mint price at all.
   - If paid: what is the price, and in what asset (USDC on Base, ETH)?

4. **Who pays gas / who mints?**
   - Option A (gasless for members): Blue mints to the member's wallet from her
     CDP wallet after the server confirms eligibility. Matches the VIP membership
     UX. Member never needs gas.
   - Option B (member mints): the member calls `mint()` directly and pays gas; the
     contract checks an eligibility signature.
   - Recommendation: Blue-mints (gasless), gated by a server check of survey
     completion, mirroring the membership transfer flow.

5. **Eligibility proof.** How does the contract or Blue know a survey was really
   finished? Likely: the server (which owns survey completion state) signs an
   eligibility message or calls Blue's mint after `survey/process` records a
   completed row. Need a one-mint-per-wallet-per-survey guard (DB unique + on
   on-chain balance check), like the `quest_usdc_claims` unique constraint.

6. **Treasury address.** What is the multisig treasury address that mint proceeds
   should route to? `BlueMarketTrader.sol` is the on-chain treasury contract today
   — confirm whether proceeds go there or to a separate Safe multisig. We need the
   exact address and chain (assume Base mainnet).

7. **Metadata + artwork.** Need final art and metadata per survey (see checklist).

## Artwork & metadata to gather

For each survey that gets a certificate:

- [ ] Certificate artwork (image, ideally square; provide source + export).
- [ ] Certificate name (e.g. "Mental Wealth Academy — Onboarding Survey 2026").
- [ ] Description text.
- [ ] Any traits/attributes (survey name, date, cohort).
- [ ] Where art + metadata are hosted (IPFS via the existing nftstorage gateway,
      consistent with `lib/avatars.ts`, or another pinning service).
- [ ] A shared "collection" image/banner if we go the ERC-1155 route.

## Safe deployment by Blue (checklist)

1. [ ] Finalize contract design from the answers above; write
       `contracts/src/SurveyCertificates.sol` with:
   - owner/admin = a secure key (ideally the multisig, or Blue with a clear
     transfer-ownership step).
   - mint restricted to an authorized minter (Blue's wallet) or signature-gated.
   - `treasury` address set at construction, immutable or owner-settable, with
     mint fees forwarded to it.
   - soulbound transfer hook if we choose non-transferable.
2. [ ] Foundry tests (`contracts/test/SurveyCertificates.t.sol`) covering: only
       authorized minter can mint, one-per-wallet-per-survey, fee routes to
       treasury, transfers blocked if soulbound.
3. [ ] Dry-run deploy to Base Sepolia; verify mint + treasury routing end to end.
4. [ ] Deploy to Base mainnet. Record the address (add to the redeploy-addresses
       memory + `CLAUDE.md`/env like the other contracts).
5. [ ] Set/confirm the treasury address on the deployed contract and verify it
       on-chain reads back the multisig.
6. [ ] Add env vars: `SURVEY_CERTIFICATES_ADDRESS`,
       `NEXT_PUBLIC_SURVEY_CERTIFICATES_ADDRESS`, and any minter config.

## App integration (after deploy)

1. [ ] On `survey/process` completion, record eligibility (new table, e.g.
       `survey_certificate_mints`, with a unique (user_id, survey_id) guard).
2. [ ] `lib/survey-certificates.ts`: on-chain ownership check (mirror
       `lib/academic-angels.ts`).
3. [ ] API route `POST /api/surveys/certificate/mint`: verify completion + not
       already minted, then Blue mints to the member's wallet (or returns a
       signature for member-mint). Idempotent reserve-then-mint, like
       `app/api/quests/usdc/review/route.ts`.
4. [ ] UI on the surveys page: a "Mint your certificate" state after completion,
       showing the art, mint status, and a BaseScan link once minted.
5. [ ] If paid: a checkout step that routes funds to the treasury before mint.

## Security notes

- Real funds and a real contract are involved — treat like the USDC quest payout:
  server-authoritative eligibility, idempotent guards, on-chain re-verification,
  and never trust client-supplied amounts or eligibility.
- Prefer the multisig as contract owner. If Blue must be owner for operational
  minting, scope her to a minter role and keep ownership/treasury on the multisig.
- Confirm Base mainnet vs Sepolia for each step; the Hobby-plan cron limit and
  deploy notes in `CLAUDE.md`/memory still apply to anything scheduled.
