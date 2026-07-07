---
name: diamonds-mainnet-switch
description: Step-by-step runbook for switching Diamonds ($BLUE) V2 + Bitcoin reflections from Base Sepolia to Base mainnet. Use when deploying DiamondsV2 to mainnet, flipping the app off NEXT_PUBLIC_USE_TESTNET, funding the treasury with cbBTC, seeding the DEX liquidity pool, or flagging the AMM pair. Covers env flips, Gas Manager, the v1 migration, and the renounce trap.
version: 1.0.0
user-invocable: true
---

The mainnet switch, end to end. Work the phases in order — each one gates the next. The canonical op-order and comms plan is `docs/tokenomics/blue-v2-redeploy-mission-brief.md`; this skill is the executable checklist that goes with it.

State when this skill was written (2026-07-07): V2 + vault live and battle-tested on Base Sepolia (token `0xd116e780ca9ec3984e7682e095aab50006a9c160`, vault `0xc8FfD11F157C71F58477Cc49a2bf25bc69683b20`), prod running with `NEXT_PUBLIC_USE_TESTNET=true`, daily reflections cron live at `/api/cron/reflections` (12:00 UTC), v1 token on mainnet at `0x4A25Cea1f05C6725dC90849FBaafF00d67342B3f`. Verify all of this against current code before acting.

## Phase 0 — go/no-go gates

Do not start the switch until every gate is green on testnet:

1. `npx tsx --env-file=.env.local scripts/e2e-reflections-sepolia.ts` passes every check (wiring, shares, threshold, house exclusion, deposit, accrual, payout, resync).
2. `npx tsx --env-file=.env.local scripts/verify-diamond-ledger.ts` reports zero BAD rows — every `sent` reward and every burn in the ledgers matches a real onchain Transfer.
3. Real users have run the in-app loop on testnet: claim mints landed in their wallet popup, a burn sink (field-notes unseal or shop) verified server-side, and a daily reflections drop reached their wallet.
4. Contract tests pass: `cd contracts && forge test`.
5. Blue's mainnet wallet (`0x0920553CcA188871b146ee79f562B4Af46aB4f8a`, key in `BLUE_PRIVATE_KEY` falling back to `AZURA_PRIVATE_KEY`) holds enough Base ETH for deploy plus daily ops — 0.005 ETH is comfortable.

## Phase 1 — deploy V2 + vault to mainnet

The deploy script self-wires everything: Diamonds deploys its own ReflectionVault, premines 200M to Blue, excludes her from reflections, and uses native cbBTC (`0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`) as the reward token on chain 8453.

```bash
cd contracts
forge script script/DeployDiamonds.s.sol:DeployDiamonds \
  --rpc-url $BASE_RPC_URL --broadcast \
  --priority-gas-price 1000000 --with-gas-price 100000000
```

Gas flags are not optional. The 2026-07-02 incident: forge's default 1.5 gwei tip is roughly 200x Base's going rate and drains the deployer. Pin both prices exactly as above.

Immediately after broadcast:

```bash
forge verify-contract <token> src/Diamonds.sol:Diamonds --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address)" <blue> 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf)
forge verify-contract <vault> src/ReflectionVault.sol:ReflectionVault --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" <token> 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf <blue>)
```

Then run the GoPlus token-security scan per the mission brief and confirm zero flags (the contract was designed against the scanner checklist: no blacklist, no trading gate, constant fee ceiling). Sanity-read the deployment: `vault()` on the token matches the vault address, `owner()` is Blue, `feeBps()` is 100, `minShareBalance()` is 1000e18.

## Phase 2 — wire the app to mainnet

1. Code change in `lib/chain-config.ts`: the MAINNET block currently has `reflectionVaultAddress: null` and `cbBTcAddress: null`. Set them — vault to the Phase 1 address (env override `NEXT_PUBLIC_REFLECTION_VAULT_ADDRESS`), cbBTC to native `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`. The daily reflections cron and the wallet popup's cbBTC row both activate on mainnet the moment these are non-null.
2. Vercel env (Production) — the full flip set:

| Variable | Action |
| :--- | :--- |
| `NEXT_PUBLIC_USE_TESTNET` | remove (this is the switch itself) |
| `DIAMONDS_TOKEN_ADDRESS` + `NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS` | new V2 token address |
| `NEXT_PUBLIC_REFLECTION_VAULT_ADDRESS` | new vault address |
| `DIAMONDS_V1_TOKEN_ADDRESS` | old `0x4A25…2B3f`, kept for the migration snapshot |
| `ALCHEMY_API_KEY` + `ALCHEMY_GAS_POLICY_ID` | keep; policy update is Phase 2 step 3 |
| `CRON_SECRET` | set if missing, so only Vercel's scheduler can fire the reflections cron |
| `REFLECTIONS_MIN_DEPOSIT_SATS` | optional; deposit floor, defaults to 1000 |

3. Alchemy Gas Manager: edit the policy to allowlist the new mainnet token address and its `mint(address,uint256)` selector. If the policy only lists the old or testnet address, every sponsored mint silently falls back to owner mints from Blue's key and burns her ETH — the fallback works, but it is not the design.
4. Minter grant needs no manual step: `lib/diamonds-onchain.ts` grants Blue's smart account minter on the first claim (`ensureMinter`). Watch the first mainnet claim's logs to see it happen.
5. Deploy, then confirm on prod: wallet popup shows mainnet balances, `verify-diamond-ledger.ts` runs clean against the mainnet chain, and one staff-account claim mints on Basescan.

## Phase 3 — migrate v1 holders

Decision recorded in the mission brief: V2 supersedes v1, holders are made whole by airdrop. Steps:

1. Snapshot v1 balances (`DIAMONDS_V1_TOKEN_ADDRESS`) at an announced block.
2. Airdrop the same amounts in V2 from Blue's premine as plain transfers — they come from her stash, so supply accounting stays honest. Batch through a script with pinned gas; reuse the `scripts/backfill-diamonds.ts` delivery pattern (unique-per-ref ledger rows) so a re-run can never double-pay.
3. Publish the snapshot block, the airdrop tx list, and the holder guide (mission brief section 10) per the comms timeline.

## Phase 4 — fund the treasury (cbBTC)

The treasury is Blue's wallet. The pipeline is already automated: anything above the floor that sits in her wallet gets swept into the vault at 12:00 UTC daily by `/api/cron/reflections`, accrual is instant at the deposit block, and the same run pushes payouts to every holder.

1. Acquire cbBTC on Base: swap revenue (USDC) to cbBTC on Aerodrome, or buy BTC on Coinbase and withdraw as cbBTC to Base. Either lands as the same token.
2. Send it to Blue's wallet — that is the whole funding step. Do not send cbBTC directly to the vault address: only `depositReflections` updates the accounting, and tokens transferred straight in are stranded with no rescue path.
3. Size the first drops small and steady — 0.001 to 0.01 cbBTC per day reads better than one large drop, and the per-Diamond math (`deposit x your BLUE / eligible BLUE`) is published in the README, so holders can check every drop.
4. Verify the first mainnet drop end to end: cron response JSON shows `deposited` and `processed.claims`, the vault balance returns to dust, and a known holder wallet shows the cbBTC increment on Basescan.
5. Ops note: each daily run costs Blue three transactions of gas. Top her up when she thins; alert if her ETH drops below ~0.001.

## Phase 5 — liquidity pool and the 1% fee

The contract shipped ready for this stage: `feeBps` is 100 (hard cap `MAX_FEE_BPS` 200 is compile-time), `feeRecipient` is the treasury, and pairs are dormant until flagged.

1. Venue: Aerodrome (Base's canonical DEX), volatile pool BLUE/WETH. A volatile v2-style pair suits a spend token; skip concentrated liquidity for launch.
2. Set the initial price deliberately: the first liquidity deposit defines it. Decide the float (from Blue's 200M) and the paired asset amount together — for example seeding 1% of supply (2M BLUE) against WETH at the chosen price. Record the reasoning in the tokenomics docs before the transaction.
3. Seed the pool from Blue's wallet. Her transfers are fee-exempt by constructor, so seeding pays no fee.
4. Flag the pair: `token.setAmmPair(<pool>, true)` from Blue (owner). This turns on the 1% fee for pool trades and simultaneously excludes the pool from reflections. Wallet-to-wallet transfers and all app flows stay fee-free.
5. Verify with one small buy and one small sell: the trade pays 1% in BLUE to the treasury (`feeRecipient` balance grows), reflections accounting stays sane (`totalShares` unchanged by pool balance), and a plain transfer between two wallets still pays zero fee.
6. The AMM fee arrives as BLUE, and the vault only accepts cbBTC. Close the loop on a cadence: swap accumulated fee BLUE to cbBTC (through the pool itself, small clips) and leave the cbBTC in the treasury wallet for the nightly sweep.
7. LP custody: the LP position is a treasury asset. Park it in the Safe (`scripts/create-safe.js` exists for this) or document exactly where it lives and who can move it.

## Phase 6 — hold the line

- Do not renounce ownership while the Academy still mints rewards. Renounce permanently ends minting for the owner and every granted minter — it is the supply-finalization switch, only for the day earning moves fully to transfers from Blue's stash. Until then, ownership stays with Blue (or migrates to the Safe via `contracts/script/TransferOwnership.s.sol`).
- Keep `scripts/verify-diamond-ledger.ts` in the weekly ops rotation: it proves every ledgered mint and burn matches the chain, and catches wrong-chain or no-op transactions the moment they appear.
- Watch the first week of cron runs (Vercel logs, `/api/cron/reflections` responses) and the `diamond_onchain_rewards` failure statuses; `scripts/backfill-diamonds.ts` releases anything parked.

## Rollback

The switch is env-reversible at every phase before the airdrop: restore `NEXT_PUBLIC_USE_TESTNET=true` and the previous address envs, redeploy, and prod is back on Sepolia while mainnet contracts sit untouched. After the airdrop, rollback stops being an option — treat Phase 3 as the commit point.
