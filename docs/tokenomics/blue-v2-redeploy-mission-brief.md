# Mission brief — Diamonds ($BLUE) v2 redeploy

Base mainnet. Deployer and owner: Blue (key in `BLUE_PRIVATE_KEY`, legacy fallback `AZURA_PRIVATE_KEY`).
Written 2026-07-06. Executor: any agent session with this repo, `.env.local`, and Foundry.

**Status 2026-07-06: Phase A complete.** `Diamonds.sol` + `ReflectionVault.sol` are in
`contracts/src/` with 18 tests green (140/140 suite-wide) and a successful mainnet-fork
dry run (~3.57M gas, ~0.000037 ETH). Not deployed, not airdropped — Phases B–E remain.
One as-built simplification vs the original spec: the token never swaps fees itself. AMM
fees move plain BLUE to a settable `feeRecipient` (the treasury); the treasury converts
and funds reflections via `depositReflections` — same pipeline as day-one deposits, and
nothing but one balance move ever happens inside a user's trade. LP sizing theory lives
in [blue-lp-allocation.md](blue-lp-allocation.md).
Format: every move states its expected observation; every fork has a trigger. No speculative
hardening — every guard in here counters a cause verified during recon.

## 0. Mission

Replace Diamonds v1 with v2 on Base:

1. Owner-gated minting and standard burning, where minting dies permanently the moment
   ownership is renounced (supply finalization is a one-way switch Blue can flip later).
2. Gasless in-game burns — users never pay gas or hold ETH — sponsored through Alchemy
   Gas Manager.
3. cbBTC ("Bitcoin on Base") reflections for holders, adapted from the reference contract
   but with every scanner-flag cause removed.
4. Airdrop that mirrors v1 balances exactly, minus what was already burned.

### Ground truth (verified 2026-07-06 — trust this over memory)

- v1: `0x4A25Cea1f05C6725dC90849FBaafF00d67342B3f`. Plain OZ `ERC20 + Ownable` with a
  `minters` mapping ([contracts/src/legacy/DiamondsV1.sol](../../contracts/src/legacy/DiamondsV1.sol)). No
  `burn`, no `burnFrom`, no `permit`. **Source never verified on Basescan** — the page shows
  "UNKNOWN reputation". 15 holders. Total supply 200,000,001 BLUE.
- Burns today: the user's own wallet signs a `transfer` to `0x…dEaD`;
  [app/api/daily-notes/unseal/route.ts](../../app/api/daily-notes/unseal/route.ts) verifies the
  Transfer log. Users must hold Base ETH — the exact friction this mission removes
  (see [docs/field-notes-gasless-burn.md](../field-notes-gasless-burn.md), Path A of which is what we execute here).
- Mints are already gasless for users: Blue's Coinbase smart account sends sponsored user
  operations through the CDP paymaster ([lib/diamonds-paymaster.ts](../../lib/diamonds-paymaster.ts)), and
  [lib/diamonds-onchain.ts](../../lib/diamonds-onchain.ts) auto-grants the CDP wallet `minters` on first claim.
  Keep the v1 mint ABI and none of that code changes.
- The repo already pins gas because unpinned RPC estimates burned us before:
  `baseFeeOverrides()` at [lib/diamonds-onchain.ts:63](../../lib/diamonds-onchain.ts) pins a
  0.001 gwei priority tip and reads the live base fee with a 0.05 gwei fallback.
- User wallets: Privy auth with external EOAs (wagmi); users sign their own txs today.
- Reference contract `0x80394B07Eea4C1E7c9C0D65f9cbBE6e32832b80b` ("COMMUNITY", Base):
  cbBTC reflections via a `DistributionEngine` deployed from the token constructor;
  1.11% fee on AMM buys and sells only (zero fee wallet-to-wallet); 7-way fee split across
  mutable recipient wallets; owner `enableTrading()` gate — trading is dead until the owner
  flips it. Hardcoded addresses it uses, reusable by us:
  - cbBTC: `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`
  - Uniswap V2 router (Base): `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
  - WETH (Base): `0x4200000000000000000000000000000000000006`
  - Aerodrome factory: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`

### One honest tension, resolved

[token-architecture.md](token-architecture.md) defines $BLUE as a high-velocity spend token —
reflections reward holding, which cuts against that. The resolution baked into this spec:
reflections are funded by **treasury cbBTC deposits** (e.g. trading profits), not by taxing
game activity. Every platform action (mint, burn, p2p quest payout) stays 100% fee-free
forever. The AMM fee machinery ships dormant and only ever touches DEX trades, if and when
an LP exists. Holding earns a bonus; spending is never punished.

## 1. New ERC20 — Diamonds spec

Same identity as v1 so wallets and UI carry over: name `Diamonds`, symbol `BLUE`,
18 decimals. Solidity 0.8.24, OpenZeppelin v5 (already vendored in `contracts/lib`).

Inheritance: `ERC20, ERC20Burnable, ERC20Permit, Ownable`.

File: `contracts/src/Diamonds.sol` (keep v1 in place for reference). The constructor
deploys the `ReflectionVault` itself, same pattern as the reference contract, so the pair is
atomic and the vault's token address is immutable.

### Full function inventory

| Function | Access | Behavior |
|---|---|---|
| `constructor(address blue)` | — | Mints 200,000,000 BLUE to Blue's EOA; deploys `ReflectionVault(cbBTC)`; fee-exempts and dividend-excludes Blue, the token, the vault, `0xdEaD` |
| `mint(address to, uint256 amount)` | minters or owner | Same ABI as v1 (so `lib/diamonds-onchain.ts` needs zero changes). **Reverts `MintingFinalized()` when `owner() == address(0)`** — renounce bricks all minting, including existing minters |
| `setMinter(address, bool)` | onlyOwner | Identical to v1; CDP server wallet is auto-granted at runtime |
| `burn(uint256)` | anyone, own balance | ERC20Burnable — permissionless forever, survives renounce |
| `burnFrom(address, uint256)` | allowance holder | The relayer's entry point for gasless burns |
| `permit(owner, spender, value, deadline, v, r, s)` | anyone with sig | ERC-2612; EIP-712 domain name `Diamonds` |
| `setAmmPair(address pair, bool isPair)` | onlyOwner | Flags an address as a DEX pair — fees apply only to transfers touching a flagged pair |
| `setFeeBps(uint16 bps)` | onlyOwner | `require(bps <= MAX_FEE_BPS)` where `MAX_FEE_BPS = 200` is a **constant**. Launch value: 100 (1%) |
| `setFeeExempt(address, bool)` | onlyOwner | Exempt game/treasury contracts from AMM fees |
| `setFeeRecipient(address)` | onlyOwner | Where AMM fees land as plain BLUE (the treasury). No in-contract swaps — the treasury converts and deposits cbBTC to the vault |
| `transferOwnership` / `renounceOwnership` | onlyOwner | Standard Ownable. Renounce = supply finalization, deliberately not scheduled in this op |
| `_update(from, to, value)` override | internal | Takes the AMM fee when a flagged pair is involved and neither side is exempt; syncs `vault.setShare()` for both sides inside `try/catch` so **vault failure can never revert a transfer** |

What is deliberately absent, because each is a verified honeypot-flag cause (section 4):
no `enableTrading()` gate, no blacklist, no max-wallet/max-tx, no owner `adminBurn`,
no mutable fee ceiling.

### ReflectionVault spec

File: `contracts/src/ReflectionVault.sol`. Magnified-dividends-per-share pattern (same
family as the reference `DistributionEngine`), reward token cbBTC.

| Function | Access | Behavior |
|---|---|---|
| `setShare(address holder, uint256 balance)` | only token | Called from `_update`; holders below `minShareBalance` (launch: 1,000 BLUE) or excluded get share 0 |
| `depositReflections(uint256 amount)` | anyone | `transferFrom` cbBTC in, bumps dividends-per-share. This is the primary funding path: treasury deposits, day one, no LP required |
| `claim()` | any holder | Pays pending cbBTC to caller |
| `process(uint256 gas)` | anyone | Walks the holder queue auto-paying until gas budget (launch: 300,000) is spent; never reverts |
| `pendingRewards(address)` | view | Basescan-friendly |
| `setExcluded(address, bool)`, `setMinShareBalance(uint256)` | token or token's owner (freezes with renounce) | Blue's stash is excluded — with 200M of ~200M supply she would otherwise take ~100% of every deposit. Users get the reflections |

## 2. Enemy contact one — the 200x priority tip

**Cause (verified — this already hit us on 2026-07-02):** default fee logic overpays the
tip on Base by ~200x. The recorded incident: ethers v5's default 1.5 gwei priority tip vs
Base's going rate of ~0.001–0.01 gwei drained Blue's gas in just 4 payouts; some RPC
estimators do the same via `eth_maxPriorityFeePerGas`. The tip dominates cost when the
base fee is tiny, and a 4–5M gas deploy is where it bites hardest — this is exactly why
`baseFeeOverrides()` exists.

**Counter:** never let an RPC choose the tip. Every broadcast in this op pins gas.

- Foundry deploy: `--priority-gas-price 1000000` (0.001 gwei) `--with-gas-price 100000000`
  (0.1 gwei max fee — headroom over any realistic Base base fee).
- TS scripts (airdrop, relayer): reuse the `baseFeeOverrides` pattern / pass explicit
  `maxPriorityFeePerGas: 1000000n` to viem.

**Expected observation:** dry-run gas estimate ~4–5M for both contracts; after broadcast,
the Basescan tx shows effective gas price under 0.05 gwei and total deploy cost under
0.0001 ETH (well under $1).

**Forks:**
- Trigger: receipt shows effective gas price above 0.5 gwei → a script bypassed the pin.
  Find the unpinned call, fix it, note it. (Money already spent is small; the point is the leak.)
- Trigger: tx pending more than 30 seconds (Base blocks are 2s; 0.001 gwei normally lands
  next block) → resend the same nonce with the tip at 0.01 gwei. Repeat once at 0.05 gwei.
- Trigger: RPC rejects or times out on broadcast → switch `BASE_RPC_URL` to
  `https://mainnet.base.org` and retry identically.

## 3. Enemy contact two — the honeypot label

**Cause analysis of the reference contract's flag (from its verified source):** scanners
(GoPlus; Blockaid, which powers Coinbase Wallet warnings) flag specific detectable patterns,
and the reference has three: (a) `enableTrading()` — trading is owner-disabled at deploy,
which reads as "owner can prevent selling"; (b) mutable fee-recipient wallets across a 7-way
split; (c) a dividend-processing callback in the sell path that can make simulated sells
fail on gas, which simulators read as "cannot sell = honeypot". Separately, our own v1 was
never source-verified, which is why Basescan shows "UNKNOWN reputation" today.

**Counters (each maps to a cause above, nothing speculative):**

1. No trading gate of any kind — v2 transfers work from the constructor onward. (a)
2. `MAX_FEE_BPS = 200` is a compile-time constant; scanners can read that fees can never
   exceed 2%. Single fee destination (the treasury `feeRecipient`), no recipient-wallet
   spray, and no swap machinery anywhere in the transfer path. (b)
3. `vault.setShare` wrapped in `try/catch` and `process()` is pull-based with a fixed gas
   budget, never called inside a user's sell. A transfer cannot revert or run out of gas
   because of reflections. (c)
4. Verify source on Basescan for both contracts within minutes of deploy. (v1's mistake)
5. No blacklist, no adminBurn, no max-tx — these simply don't exist to be flagged.

**Expected observation:** GoPlus token security API
(`https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=<v2>`) returns
`is_honeypot: 0`, `is_blacklisted: 0`, `can_take_back_ownership: 0`, `is_mintable: 1`
(true and intended until renounce — document it, don't hide it). Pre-LP, honeypot.is will
report "no pair / cannot simulate" — **that is the expected pass state, not a failure**;
a buy/sell simulation is only possible once an LP exists.

**Forks:**
- Trigger: after an LP exists, a scanner flags honeypot AND a honeypot.is simulation shows
  the sell actually succeeding with ~1% fee → false positive. Action: file false-positive
  reports with GoPlus (re-review request on the token page) and Blockaid (their
  false-positive form; Coinbase Wallet inherits the fix), citing verified source, constant
  fee cap, no gate, no blacklist. Do not change the contract for a label.
- Trigger: a simulated sell genuinely fails → the flag is right, the bug is real. Reproduce
  on a Base fork, fix config first (`setMinShareBalance`, `process` gas budget,
  `setFeeExempt`) — config before code, code only if config can't reach it.
- Trigger: Basescan verification fails → fix `foundry.toml` metadata settings and re-run
  `forge verify-contract`; do not announce until both contracts show verified source.

## 4. Gasless burns — Alchemy Gas Manager

Design (Path A from the field-notes doc, now executable because v2 has permit + burnFrom):

1. User signs an EIP-2612 permit (typed-data signature — free, no gas, no ETH) authorizing
   Blue's relayer to spend exactly the burn amount, 10-minute deadline.
2. Client POSTs the signature to the unseal/spend API route.
3. Server sends one sponsored user operation from Blue's relayer smart account through
   Alchemy's bundler with the Gas Manager policy attached:
   `calls = [permit(user, relayer, amount, deadline, v, r, s), burnFrom(user, amount)]`.
4. Route verifies the `Transfer(user → 0x0)` log in the receipt it just got back, writes
   the `diamond_burns` ledger row, releases the content. Supply genuinely shrinks —
   no more dEaD-address parking.

Setup (the only steps needing the Alchemy dashboard, one time):
- Create an Alchemy app on Base mainnet → `ALCHEMY_API_KEY`.
- Gas Manager → create sponsorship policy: chain Base, monthly cap $25, sender allowlist =
  Blue's relayer smart-account address (the setup script prints it) → `ALCHEMY_GAS_POLICY_ID`.
- Pricing observed 2026-07 (re-check the pricing page at execution): free tier sponsors up
  to $50/month of gas; beyond that ~10% markup over chain cost, with email alerts at
  50/75/90/100% of the cap.

Code:
- New `lib/diamonds-burn-relayer.ts` — mirror of `diamonds-paymaster.ts` but transport =
  Alchemy bundler RPC + policy ID. Keep CDP sponsoring mints; Alchemy sponsors burns.
  Two independent sponsors also means one dashboard outage never halts both faucet and sink.
- [components/courses/FieldNotesSheet.tsx](../../components/courses/FieldNotesSheet.tsx):
  replace the `transfer(dEaD)` signing with `signTypedData` (permit). Delete the "you need
  a little ETH" warning copy at line ~316 — that constraint dies with this mission.
- Unseal route: `verifyBurnTx` accepts `Transfer` to `address(0)` (what `burnFrom` emits)
  **and keeps** the v1 dEaD check for the fallback path below.

**Expected observation (end-to-end proof):** a test wallet holding 400+ BLUE and exactly
0 ETH completes an unseal; the Basescan tx shows the Alchemy paymaster as fee payer; a
`diamond_burns` row exists; v2 `totalSupply` dropped by 400e18.

**Forks:**
- Trigger: paymaster rejects the user operation → read the rejection reason in the Alchemy
  dashboard. Sender-not-in-policy means the relayer address in the policy is stale; cap
  exhausted means raise the cap. Nothing else to guess — the dashboard states the reason.
- Trigger: permit signature rejected on-chain → check whether the user's address has
  contract code (smart wallet). OZ `ERC20Permit` verifies ECDSA only, so smart-wallet users
  (EIP-1271 signers, e.g. Coinbase Smart Wallet) cannot use permit. Route them to the
  legacy self-signed burn path, which stays alive in the UI as the fallback. Privy embedded
  wallets and normal EOAs are unaffected.
- Trigger: relayer succeeds but route times out waiting for the receipt → the burn happened;
  the route must treat the userop hash as the source of truth and re-poll before telling
  the user it failed. Never charge a user twice for one successful burn — idempotency key
  is the permit nonce.

## 5. Airdrop plan

Small op: v1 has 15 holders. Blue's 200M stash is re-minted by the v2 constructor, so the
airdrop is ~14 mints.

- Snapshot: `scripts/snapshot-blue-v2-holders.ts` crawls v1 `Transfer` logs from the deploy
  block, computes final balances, writes `data/blue-v1-snapshot.json` with the snapshot
  block number. **Expected observation:** balances sum to exactly 200,000,001e18 and the
  holder count is 15.
- Exclusions: `0xdEaD` gets nothing — v1 burns stay burned, and v2's total supply comes out
  as v1 supply minus everything ever burned. This upgrade makes historical burns real.
  Blue's EOA gets nothing from the script (constructor already minted her 200M).
- Execution: `scripts/airdrop-blue-v2.ts` — Blue signs `mint(holder, v1Balance)` per holder
  with pinned gas; idempotent (skips any holder whose v2 balance already matches target),
  so a crashed run is re-runnable with zero double-mints.
- **Expected observation:** per-holder v2 `balanceOf` equals the snapshot exactly;
  `totalSupply` equals 200,000,001e18 minus dEaD's snapshot balance.
- Fork — trigger: a v1 transfer lands after the snapshot block (v1 sees ~5 transfers/day,
  so announce the snapshot block in the T-2 comms) → re-run the snapshot at a later block
  before airdropping; the airdrop only ever runs against the final JSON.

## 6. Costs

| Item | Estimate | Basis |
|---|---|---|
| Deploy Diamonds + ReflectionVault | < $1 (≈ 4–5M gas at ≤ 0.05 gwei effective) | Pinned gas, section 2 |
| Basescan source verification | $0 | Free (needs an Etherscan API key — free account if none in env) |
| Airdrop (~14 mints ≈ 60k gas each) | < $0.10 | Pinned gas |
| Gasless burns, ongoing | $0 up to ~$50/mo sponsored gas, then ~10% markup | Alchemy free tier; one burn userop ≈ 150–250k gas ≈ small fractions of a cent on Base, so free tier covers thousands of burns monthly |
| First reflection deposit | $25–50 of cbBTC (sizing is a treasury call, not a contract constraint) | Enough for every eligible holder to see a nonzero cbBTC arrival |
| Blue's ETH float | Pre-flight check: ≥ 0.002 ETH in Blue's EOA before Phase C | Covers deploy + airdrop many times over |

Out of scope for this mission: seeding a DEX LP (deliberate later step per token-architecture.md).

## 7. Execution op-order

Preconditions (run before anything): `forge build` clean; `BLUE_PRIVATE_KEY` or
`AZURA_PRIVATE_KEY` set; Blue's EOA ≥ 0.002 ETH; Etherscan/Basescan API key present or
created. Expected observation: all four true, else stop and fix — nothing below depends on
anything not listed here.

**Phase A — Build (repo, no chain writes)** — *A1 and A2 done 2026-07-06 (18 tests green;
8-decimal reward math covered by an 8-decimal mock). A3's fork dry run of the deploy
passed (~3.57M gas); the real-cbBTC `deal` fork test remains a pre-broadcast nicety.*
- A1. Write `Diamonds.sol` + `ReflectionVault.sol` per section 1. Expect: `forge build` clean.
- A2. `contracts/test/Diamonds.t.sol`: renounce bricks `mint` (owner and minters both);
  permit → burnFrom flow; fee applies only when a flagged pair is party; transfers succeed
  when the vault is made to revert (the try/catch guarantee); vault deposit → pending →
  claim math; excluded addresses earn nothing; `process()` respects its gas budget.
  Expect: all green.
- A3. Base fork test (`--fork-url $BASE_RPC_URL`): `deal` cbBTC to a mock treasury,
  `depositReflections`, claim as a holder. Expect: green — proves real-cbBTC decimals
  (8, not 18) are handled.

**Phase B — Alchemy (dashboard, the one human-in-the-loop step)**
- B1. Create app + Gas Manager policy per section 4; put `ALCHEMY_API_KEY` and
  `ALCHEMY_GAS_POLICY_ID` in `.env.local` and Vercel. Expect: policy shows Active with the
  relayer address allowlisted.

**Phase C — Chain (all pinned-gas)**
- C1. Snapshot (section 5). Expect: sums check out.
- C2. `forge script script/DeployDiamonds.s.sol --rpc-url $BASE_RPC_URL` (dry run).
  Expect: both addresses simulated, gas ~4–5M, Blue printed as owner.
- C3. Same + `--broadcast --priority-gas-price 1000000 --with-gas-price 100000000`.
  Expect: both contracts live; deploy cost < 0.0001 ETH.
- C4. `forge verify-contract` both. Expect: verified source badges on Basescan.
- C5. GoPlus scan (section 3). Expect: the documented pass state.
- C6. Airdrop. Expect: balances mirror snapshot; supply = v1 minus burned.

**Phase D — Platform cutover**
- D1. Env swap: `DIAMONDS_TOKEN_ADDRESS` + `NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS` → v2; add
  `DIAMONDS_V1_TOKEN_ADDRESS` (legacy verifier) and `NEXT_PUBLIC_REFLECTION_VAULT_ADDRESS`.
  Local + Vercel.
- D2. Ship `lib/diamonds-burn-relayer.ts`, the FieldNotesSheet permit flow, and the
  unseal-route verifier change. Expect: build + existing tests green.
- D3. First sponsored claim mint on v2. Expect: `ensureMinter` auto-grants the CDP wallet
  (watch for the `MinterSet` event) and the mint lands — zero code changes needed, because
  the mint ABI was kept identical.
- D4. Live-fire test per section 4's expected observation (0-ETH wallet, full unseal).
- D5. Deploy to prod. Expect: /home balance widgets read v2 amounts.

**Phase E — Reflections + comms**
- E1. Treasury `approve` + `depositReflections` of the first cbBTC tranche; call
  `process(300000)`. Expect: eligible holders' `pendingRewards` go nonzero, then paid;
  Blue's excluded stash earns 0.
- E2. Run the communication schedule (section 9).

Post-mission repo hygiene: update `docs/tokenomics/token-architecture.md` status line,
[financial-blockchain-map.md](../financial-blockchain-map.md), and the memory notes on the
token address. Mark v1 deprecated in comments, never delete its source.

## 8. Timeline

| Day | Work |
|---|---|
| Jul 7 (T-2) | Phase A (contracts + tests). Pre-announce to holders, publish snapshot block |
| Jul 8 (T-1) | Phase B (Alchemy setup) + fork dress rehearsal of C2 |
| Jul 9 (T0) | Phases C and D: deploy, verify, scan, airdrop, cutover, live-fire burn |
| Jul 10 (T+1) | Soak: watch Alchemy dashboard + `diamond_burns` for the first organic gasless burns |
| Jul 16 (T+7) | E1: first cbBTC reflection deposit + announcement |
| Unscheduled | Ownership renounce = supply finalization. Trigger is a treasury/DAO decision, not a date. After it: no more minting ever, burns/permit/reflections continue untouched |

## 9. Communication schedule to holders

Fifteen holders — early believers. Channels: pinned /community post, a proactive line from
Blue in chat, and (T0 only) a Daily Note banner. Tone per brand: warm, plain, no hype.

| When | Message |
|---|---|
| Jul 7 (T-2) | "Diamonds are upgrading." What v2 adds (real burns, no more ETH needed, Bitcoin reflections for holders); balances migrate automatically at snapshot block N; nothing to do |
| Jul 9 (T0) | New contract address + verified Basescan link. "Your balance arrives within the hour. The old token stops counting today — the app already reads the new one" |
| Jul 9 (T0+1h) | "Check your wallet." Airdrop done; link the holder guide (section 10) |
| Jul 10 (T+1) | "Burns are now free." Unseal and spend without ETH — explain the one signature users will see |
| Jul 16 (T+7) | "Your first Bitcoin reflection." How holding ≥ 1,000 BLUE earns cbBTC, where to see it |
| Monthly | Reflections recap in /community: total cbBTC distributed, biggest sinks, supply burned |

## 10. Holder guide — Diamonds on the platform

Written to be lifted into the app or /community verbatim once v2 addresses are known.

**What Diamonds are.** Diamonds ($BLUE) are Mental Wealth Academy's currency on Base —
you earn them for your time, you own them in your wallet, and you spend them on things
that are fun. Contract: `<v2 address>` (verified on Basescan). 18 decimals.

**Earning.** Course missions and tasks, sealing your week, and field notes mint Diamonds
straight to your wallet — no signing, no gas, they just arrive. Quest rewards come from
Blue herself, wallet to wallet.

**Spending.** Spending burns — supply actually shrinks every time. Unsealing field notes
burns 400. The shop and games are Diamond sinks too. You'll sign one message (free, no
ETH ever needed) and the platform handles the rest.

**Bitcoin reflections.** Hold at least 1,000 BLUE in your own wallet and you earn a share
of every cbBTC (Bitcoin on Base) deposit the treasury makes, sized by your holdings.
It's delivered automatically; you can also check `pendingRewards` or call `claim()` on
Basescan yourself. Blue's own treasury stash is excluded — reflections belong to you, not
the house.

**Trading.** There is no DEX pool yet; that's a deliberate later step. When one launches,
DEX buys and sells carry a fee capped in the contract at 2% (launching at 1%) that feeds
the reflection pool. Wallet-to-wallet transfers and everything you do in the app are
always fee-free.

**Trust, verifiable onchain.** Source code verified; the fee ceiling is a constant; there
is no blacklist, no trading switch, and no way for anyone to burn your tokens without your
signature. Minting is owner-only and permanently self-destructs when Blue renounces
ownership — the supply-finalization switch, onchain for anyone to check.
