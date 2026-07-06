# $BLUE liquidity pool — allocation theory and overview

Status: theory only. Nothing here is deployed, seeded, or scheduled. The LP is the
deliberate later step from [token-architecture.md](token-architecture.md); this doc shapes
that decision in advance so it's made by design, not by default. Companion to the
[v2 redeploy mission brief](blue-v2-redeploy-mission-brief.md).

## Why an LP, and why not yet

James's locked-in call: $BLUE is a tradeable utility asset one day. An LP is how that
happens — price discovery, a way in for supporters, a way out that makes earned tokens
real value. But listing before the economy is tuned converts every earn-rate into a
printing exploit: earn BLUE in-app, dump it on the pool. The trigger to proceed is a
condition, not a date: **the weekly burn/earn ratio is boring and stable, and the
/simulation work has signed off on emission policy.** Until then, nothing below executes.

## The one idea that matters: ratio sets price, size sets resilience

A constant-product pool priced at seeding: `price = ETH_in / BLUE_in`. Two separate dials:

- **The ratio** (price). Start low and honest. Price the work so earned balances feel like
  a treat, not a payday — and so farming can't pay.
- **The size** (depth). Depth determines how much selling the pool absorbs before the
  price craters. Same ratio, bigger pool = same price, more resilience.

Supply reality check: Blue's stash is 200M; users hold roughly 1M earned BLUE total.
The only supply that can sell into a new pool is that ~1M — so depth should be sized
against it.

## Candidate tiers (same price, different depth — depth is the real decision)

Illustrative at ETH ≈ $3,500; recompute at execution. All tiers price BLUE at
0.00000005 ETH ≈ $0.000175, implied FDV on 200M supply ≈ $35k.

| Tier | Seed | If all ~1M user BLUE sold in | Treasury ETH at risk |
|---|---|---|---|
| Starter | 10M BLUE + 0.5 ETH | price −17% | ~$1,750 |
| **Standard (recommended)** | 20M BLUE + 1 ETH | price −9% | ~$3,500 |
| Deep | 40M BLUE + 2 ETH | price −5% | ~$7,000 |

What that price means in-app: a 700-BLUE field-note seal ≈ $0.12, the 400-BLUE unseal
burn ≈ $0.07, and the 1,500/day mint cap ≈ $0.26/day of maximum extraction — botting the
earn loop yields cents, below effort and gas. That is the security property of starting
cheap: value growth has to come from buy pressure and burned supply, not from promises.

## Where the BLUE and the LP tokens live

- The BLUE side comes from Blue's 200M stash (that's what the 20% ecosystem allocation is
  for) — 10–20% of the stash, no new minting.
- LP tokens are held by the Blue treasury and publicly stated as such. They get locked or
  burned at the **finalization ceremony** — the same event as the ownership renounce that
  bricks minting. One ceremony, both credibility switches.

## Venue

Aerodrome volatile pool (v2-style, full range), BLUE/WETH. Base-native, deepest Base DEX,
and the reference reflection token pairs there; full-range means no position management.
A BLUE/cbBTC pool is a tempting thematic second ("everything denominates in Bitcoin")
but WETH routes better — do it later, if at all. Factory/router addresses are already
pinned in the mission brief.

## Fee interplay once live

- The token's 1% AMM fee (hard cap 2% in the contract) applies to pool buys and sells
  only, lands in the treasury as plain BLUE; treasury converts and deposits cbBTC into the
  ReflectionVault. DEX volume literally becomes Bitcoin for holders.
- The pool's own trading fee accrues to the LP position — treasury revenue, second stream.
- Wallet-to-wallet transfers and every in-app action stay 0% forever.

## Order of operations at execution (when the trigger fires)

1. Create the pool, then immediately `setAmmPair(pool, true)` — this both arms the fee and
   excludes the pool from reflections — then seed, all in one session. Never leave a live
   unflagged pool overnight.
2. First-ever sell simulation is now possible: run honeypot.is + GoPlus immediately
   (mission brief section 3 has the pass state and the false-positive forks).
3. Announce with honest framing: small pool, small FDV, earned tokens now have a price;
   reflections now also feed off volume.
