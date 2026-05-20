# Plan A — Security Redeploy Batch

Goal: ship the contract-level security fixes that require new deployments, put
treasury control behind a 2-of-3 Safe, deploy MWG as a real ERC20Votes token,
and rewire the app + CRE workflows to the new addresses.

Do this BEFORE Plan B (on-chain-first), because the indexer and CRE work in
Plan B must target the final contract addresses, not the ones we're replacing.

Current deployed contracts are the old AzuraKillStreak set (governance at
0x2cbb90a761ba64014b811be342b8ef01b471992d). The repo source is newer and not
deployed. The new repo source uses getPastVotes, which REQUIRES an ERC20Votes
governance token (the current MWG is plain ERC20 — see Phase 2).

---

## Phase 0 — Finish the remaining contract fixes (code, not yet done)

Already coded + tested in the repo: C1 (onReport workflow metadata pinning),
C2 (MockPredictionMarket redemption + trader refund/claim), M5 (onReport
deadline guard), M6 (zero-supply constructor guard).

Still to add, each with a Foundry test:
- M7 — reset `usdcToken.approve(predictionMarket, 0)` after the buyOutcome call
  in `_executeTrade` (or use forceApprove). Currently only reset in
  setPredictionMarket.
- L1 — require `predictionMarket.code.length > 0` in `setPredictionMarket`.
- L3 — `cancelProposal` must refuse a proposal that already reached threshold
  (only cancel Pending / sub-threshold Active).
- L8 — add the deadline guard to `blueReview` and `_blueReviewInternal`
  (`if (block.timestamp > proposal.votingDeadline) revert VotingEnded();`) so a
  long-expired Pending proposal cannot be revived into a zombie Active.

Exit check: `forge test --use 0.8.24` all green.

## Phase 1 — Deploy the ERC20Votes governance token (L4)

The new BlueKillStreak votes via `getPastVotes`; the current MWG reverts on it.
- Write/deploy a new MWG as ERC20Votes (OZ ERC20Votes + ERC20Permit), same
  name/symbol, on Base.
- Snapshot current MWG holders (token 0x84939fEc50EfdEDC8522917645AAfABFd5b3EA6F)
  and mint matching balances on the new token (or make it claimable).
- Note: holders must self-delegate (or be delegated) for voting power to count —
  document this for the community.

## Phase 2 — Deploy the new contracts

- Deploy BlueKillStreak with the new ERC20Votes token, USDC, Blue agent, and a
  non-zero total supply.
- Deploy BlueMarketTrader (USDC).
- Decide on MockPredictionMarket: do NOT point real funds at it unless the
  redemption path (C2) is the intended mechanism; otherwise leave unset on
  mainnet.
- EtherealHorizonPathway: unchanged, no redeploy needed unless desired.

## Phase 3 — Lock down ownership + signer (H2)

- Create a 2-of-3 Gnosis Safe on Base: James + Blue + AI signer.
- `transferOwnership(<Safe>)` on BlueKillStreak, BlueMarketTrader, and (if
  redeployed) the others.
- Optional but recommended: a TimelockController between the Safe and the
  contracts for destructive calls (emergencyWithdraw, setKeystoneForwarder,
  setAllowedWorkflow, setBlueAgent, withdraw).
- Migrate Blue's signer from the plaintext env key (AZURA_PRIVATE_KEY) to CDP
  Server-Signer / MPC so no raw private key exists in env.

## Phase 4 — Wire CRE + app to the new addresses

- On both fund contracts: `setKeystoneForwarder(<Base forwarder>)` and
  `setAllowedWorkflow(<workflow owner>, <workflow name bytes10>)` — C1 makes
  onReport revert until this is set.
- Update CRE workflow configs (contract addresses) and redeploy blue-review,
  auto-execute, trade-execute.
- Update env: NEXT_PUBLIC_BLUE_KILLSTREAK_ADDRESS, the governance token address,
  and reconcile the AZURA_ vs BLUE_ naming so there is one canonical set.

## Phase 5 — External audit gate

Before any meaningful funds (grant money) land, get an external audit of the
four contracts (~600 lines, small scope). The fixes above go INTO the audit
scope, not around it. Options: fixed-scope firm audit, Cantina/Code4rena
listing, or one independent auditor for a second opinion.

---

## Open decisions
- Token migration mechanism: airdrop vs claimable for new MWG.
- Timelock: yes/no and delay length (24-48h suggested).
- Whether MockPredictionMarket is wired on mainnet at all.
