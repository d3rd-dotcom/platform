# Phase 07 — Optional on-chain certificate path (DEFERRED)

**Status:** Deferred. No contract, web3, or `contracts/` changes were made in this
phase. This note only records how the on-chain path *would* work so the decision
is documented; the tiered verifier test + `verifier_credentials` upsert is the
authoritative source of verifier status today.

## What it would do

`contracts/src/SurveyCertificates.sol` is a soulbound ERC-1155. To make a passed
verifier credential portable/on-chain, we would mint a certificate token to the
verifier's wallet after `gradeVerifierTest` records a pass.

- **Call:** `SurveyCertificates.mint(address to, uint256 tokenId)`.
- **Args:** `to` = the verifier's wallet (`users.wallet_address`); `tokenId` = a
  verifier-credential token id. The contract currently defines ids 1–4 for
  attachment styles, so we'd first call `setMaxTokenId(newMax)` (owner-only) to
  extend the collection, then `setTokenURI(id, ipfsUri)` for each new
  verifier-tier token before minting.
- **Backend signer:** only the contract's `minter` address may call `mint`. The
  server-side signer (the wallet held behind `MINTER_PRIVATE_KEY` / the existing
  Blue minter used for survey certificates) submits the tx after the DB pass is
  committed. `hasMinted[to][tokenId]` makes re-mints revert, so it is idempotent.

## Why deferred

Adds a web3 dependency and key-management surface for status that the DB already
tracks and every current consumer (panel selection in `guide-verification-db`)
reads from `verifier_credentials`. Revisit if verifier status needs to be
portable across apps or provable without trusting our DB. Until then: no on-chain
code, no new deps, `verifier_credentials.earned_via = 'tiered_test'` is the record.

## Prestige & minting

Phase 8 added the read-only verifier **prestige track** (`lib/verifier-prestige-db.ts`,
`components/guides/VerifierBadges.tsx`, `/api/leaderboard/verifiers`): per-subject
credential tiers (Reader → Verifier → Arbiter), panels served, and an *upheld rate*
derived from how often a member's panel vote matched the final panel decision and
survived any dispute. That standing is the natural trigger for the deferred mint
above: the **top-tier** verifiers — Arbiters with a high upheld rate and many panels
served — are the capstone cohort whose credential would first be minted as a soulbound
`SurveyCertificates` token when/if the on-chain path is revisited. Nothing here adds
a contract, web3 dependency, or `contracts/` change; the prestige metrics simply give
a future mint a principled, earned allowlist instead of minting every passing test.
