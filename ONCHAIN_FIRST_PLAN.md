# Plan B — On-chain-first migration

North star: the blockchain is the single source of truth. The DB becomes a
derived read-cache, never authoritative. The DON (Chainlink CRE blue-review) is
the only review path — no Eliza/Anthropic fallback. Large content lives on
IPFS/Arweave addressed by on-chain hashes. Identity stays off-chain by design
(privacy: the 6 avatars + name changes).

Do this AFTER Plan A (redeploy), so all wiring targets the final contracts.

---

## Phase 1 — Write to chain first, derive the DB from chain

Today the create/review/finalize flow writes to the DB and the chain in
parallel, and they drift (DB says approved while chain is Pending). Invert it.

- Proposal creation: already chain-first on the frontend (createProposal on
  chain, then POST to DB). Keep that, but treat the DB row as a cache keyed by
  the on-chain proposal id. Phase-2 verification (recipient/amount/proposer
  match) already enforces they agree.
- Status: stop using the DB `status` column as authority. Derive display status
  from the on-chain ProposalStatus (we already read it server-side in the
  proposals API). The DB column becomes a denormalized copy updated FROM chain
  events, used only for filtering/sorting.
- Remove DB-side status transitions that aren't mirrors of a chain event.
- Net effect: the "DB approved / chain Pending" class of bug disappears because
  the DB can no longer disagree with the chain — it is generated from it.

## Phase 2 — DON-only review (remove Eliza/Anthropic)

- Delete the server-side AI review (Eliza -> Anthropic fallback) in
  `app/api/voting/proposal/review/route.ts`. That route's only job becomes:
  read the on-chain review result and sync it to the DB cache.
- The blue-review CRE workflow becomes the sole reviewer: the DON runs the AI
  off-chain (verifiable), then writes a DON-signed result on-chain via onReport
  actionType 2 (gated by the C1 workflow allowlist from Plan A).
- Failure mode is intentional: if the DON is down, proposals sit Pending
  on-chain rather than falling back to a centralized AI. That is honest
  decentralization, and the card already renders Pending/Expired truthfully.
- Prerequisites (carried from Plan A): allowedWorkflow set on the contract,
  blue-review workflow deployed + funded, and Blue's signer / DON config sound.

## Phase 3 — Indexer (research first, then build)

Replace the hand-maintained mirror + the per-request RPC enrichment with a
proper indexer that turns contract events into a queryable read model. Reads
come from chain-derived data, not a table we write to.

Learning resources:
- Ponder — https://ponder.sh (TypeScript-native indexer; simplest fit for a
  Next.js/TS solo stack; you write event handlers in TS, it serves GraphQL/SQL).
  Recommended starting point.
- The Graph subgraphs — https://thegraph.com/docs (the established standard;
  more tooling/ceremony, hosted/decentralized network options).
- Background concept: "event sourcing / read model" — the chain emits events,
  the indexer folds them into queryable state.

Decision to make after research: Ponder (recommended) vs a subgraph.

## Phase 4 — Content addressing (IPFS/Arweave)

- Store proposal markdown and (if any human-readable) review reasoning off-chain,
  content-addressed; put the content hash on-chain.
- Pattern already exists in EtherealHorizonPathway (contentHash). Reuse it for
  proposals so the on-chain record commits to the exact text reviewed.
- Pick a pinning/storage provider (web3.storage / Pinata for IPFS, or Arweave
  via Irys) — small decision, low risk.

## Phase 5 — Identity (decided: stays off-chain)

No work. Username + 1 of 6 avatars stay in the DB for privacy and changeability.
This is a deliberate choice, not a gap.

---

## Sequencing summary
Plan A (redeploy + ERC20Votes + multisig + audit) -> Phase 1 (chain-as-truth)
-> Phase 2 (DON-only review) -> Phase 3 (indexer) -> Phase 4 (content hashes).
Phases 1 and 2 deliver most of the "no janky bandaid" value; 3 and 4 are the
polish that make it fully clean.
