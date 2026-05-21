# Plan A — Security Redeploy Batch

Goal: ship the contract-level security fixes that require new deployments, put
treasury control behind a 2-of-3 Safe, deploy MWG as a real ERC20Votes token,
and rewire the app + CRE workflows to the new addresses.

Do this before Plan B (on-chain-first), because the indexer and CRE work in
Plan B must target the final contract addresses, not the ones we're replacing.

Current deployed contracts are the old AzuraKillStreak set (governance at
0x2cbb90a761ba64014b811be342b8ef01b471992d). The repo source is newer and not
deployed. The new repo source uses getPastVotes, which needs an ERC20Votes
governance token (the current MWG is plain ERC20).

---

## Where we are (updated 2026-05-21)

- Phase 0 — Done (all fixes coded + tested).
- Phase 1 — Code + migration prepared and fork-tested. Awaiting Blue's on-chain broadcast.
- Phase 2 — Deploy script ready (bundled with Phase 1 in DeployV2). Awaiting the same broadcast.
- Phase 3 — Next. Waiting on the Gnosis Safe setup before we wire it.
- Phase 4 — Pending (after Phase 3).
- Phase 5 — Pending (audit before funds).

The deploy is a single run of `script/DeployV2.s.sol`, signed by Blue's wallet
(0x0920...4f8a) via BLUE_PRIVATE_KEY / AZURA_PRIVATE_KEY. Nothing has been
broadcast yet.

---

## Phase 0 — Contract fixes — Done

Coded + tested in the repo:
- C1 — onReport workflow metadata pinning (both fund contracts).
- C2 — MockPredictionMarket redemption + trader refund/claim.
- M5 — onReport deadline guard. M6 — zero-supply constructor guard.
- M7 — reset market allowance to 0 after the buyOutcome call in _executeTrade.
- L1 — setPredictionMarket rejects EOAs (requires contract code; address(0) ok).
- L3 — cancelProposal refuses an at-threshold Active proposal.
- L8 — deadline guard in blueReview + _blueReviewInternal (no zombie revival).

Exit check met: `forge test --use 0.8.24` — 101 local tests green.

## Phase 1 — ERC20Votes governance token (L4) — Code complete, awaiting broadcast

- Done: `BlueCreditSystem.sol` — MWG re-issued as ERC20Votes + ERC20Permit, same
  name/symbol ("Mental Wealth Governance" / "MWG"), owner mint/batchMint +
  renounceMinting, block-number clock. Tested (8 tests).
- Done: read-only holder snapshot reconstructed from Transfer events — 2 holders,
  sum equals the 100k MWG supply exactly:
  - 0x84D55C4BB3d4062f74F096Fcdf58E1A9d7405d95 = 60,000 MWG
  - 0x0920553CcA188871b146ee79f562B4Af46aB4f8a = 40,000 MWG (Blue)
  Data files: contracts/migration/mwg-holders.json + MwgHolders.sol.
- Done: MigrationFork test proves minted balances equal live MWG balances 1:1.
- Remaining: Blue broadcasts DeployV2 (mints the 60k/40k, then renounceMinting).
- After deploy: each holder calls delegate(self) once to activate voting power.

## Phase 2 — Deploy the new contracts — Code complete, awaiting broadcast

Bundled into `script/DeployV2.s.sol` (one run): deploy token -> batchMint
snapshot -> renounceMinting -> deploy BlueKillStreak (sized to the real migrated
supply) + BlueMarketTrader.
- MockPredictionMarket: leave unset on mainnet unless its redemption path (C2)
  is the intended mechanism.
- EtherealHorizonPathway: unchanged, no redeploy needed.
- Ownership stays with Blue (deployer) until Phase 3.

Run (Blue's wallet needs Base ETH for gas):
- Dry run: `forge script script/DeployV2.s.sol:DeployV2 --rpc-url https://mainnet.base.org`
- Broadcast: add `--broadcast --verify`

## Phase 3 — Lock down ownership + signer (H2) — Next (waiting on Gnosis Safe)

- Create a 2-of-3 Gnosis Safe on Base: James + Blue + AI signer.
- `transferOwnership(<Safe>)` on BlueKillStreak, BlueMarketTrader, and the token.
- Optional: a TimelockController between the Safe and the contracts for
  destructive calls (emergencyWithdraw, setKeystoneForwarder, setAllowedWorkflow,
  setBlueAgent, withdraw).
- Migrate Blue's signer from the plaintext env key (AZURA_PRIVATE_KEY) to CDP
  Server-Signer / MPC so no raw private key exists in env.

## Phase 4 — Wire CRE + app to the new addresses — Pending

- On both fund contracts: `setKeystoneForwarder(<Base forwarder>)` and
  `setAllowedWorkflow(<workflow owner>, <workflow name bytes10>)` — C1 makes
  onReport revert until this is set.
- Update CRE workflow configs (contract addresses) and redeploy blue-review,
  auto-execute, trade-execute.
- Update env: NEXT_PUBLIC_BLUE_KILLSTREAK_ADDRESS, the governance token address,
  and reconcile the AZURA_ vs BLUE_ naming so there is one canonical set.
- Mark the old DB proposals terminal (their on-chain ids point at the old
  contract); align /community with the new address.

## Phase 5 — External audit gate — Pending

Before any meaningful funds (grant money) land, get an external audit of the
contracts (small scope). The fixes above go into the audit scope, not around it.
Options: fixed-scope firm audit, Cantina/Code4rena listing, or one independent
auditor for a second opinion.

---

## Open decisions
- Token migration mechanism: decided — 1:1 batchMint from the snapshot, then
  renounceMinting (in DeployV2).
- Timelock: yes/no and delay length (24-48h suggested).
- Whether MockPredictionMarket is wired on mainnet at all.
