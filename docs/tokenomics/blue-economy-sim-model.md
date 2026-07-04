# $BLUE economy — simulation model

Feed this into /simulation as the scenario spec. It defines the agent
population, their earn/spend/hold/sell behavior, and the real emission and sink
rules, so the run can answer: **does the $BLUE economy inflate to worthlessness,
and what makes it hold value once it is tradeable?**

All numbers below are the *live* values from the codebase as of this draft, not
invented. Where a value is an assumption for the sim, it is marked `[assume]`.

## Questions the simulation must answer

1. **Net emission** — with today's rewards and only the 400-diamond unseal sink,
   what is net $BLUE minted per active user per week? Per 1,000 users per month?
2. **Inflation trajectory** — circulating supply over 6 / 12 / 24 months against
   the 200M Blue allocation and 1B design reference.
3. **Sink:source ratio** — what fraction of emitted $BLUE is burned back? What
   ratio is needed for a stable float?
4. **Price pressure at liquidity** — when trading turns on, how much sell
   pressure comes from earners cashing out vs. buy demand from sinks + newcomers?
5. **Policy levers** — which single change most stabilizes it: an emission cap,
   higher/more sinks, lower reward amounts, or reward decay over time?

## Supply state (current)

- Design reference supply: **1,000,000,000** $BLUE (not a hard cap today).
- Minted at deploy to Blue's wallet: **200,000,000** (20%).
- Contract: plain ERC-20 + Ownable, **mint-only, uncapped**. Owner + authorized
  minters (Blue's CDP wallet) mint claim rewards.
- Per-user onchain mint cap: **1,500 $BLUE / UTC day** (overflow held, not lost).

## Emission sources (live reward values)

| Source | $BLUE | Frequency / notes |
|---|---|---|
| Shadow Work week seal | **700** | per week, weeks 1–13 (~9,100 to fully complete) |
| Custom course task complete | **50** | per component, per custom course |
| Custom course seal | **200** | per custom course finished |
| Quest: First Light / Deeper Currents / blog post | **100** ea | milestone quests |
| Quest: Pass the Torch (onboard) | **75** | |
| Quest: twitter follow | **40** | (a separate legacy map lists 10 — reconcile) |
| Quest: first-proposal / week-1-story | **50** ea | |
| Quest: first-vote | **25** | |
| Quest: first-reading / first-journal / complete-profile | **15–20** ea | |
| Quest: daily check-in / connect-wallet | **5–10** | daily-checkin repeats |

Observation to test: **week seals dominate emission.** One committed learner
finishing the 13-week arc mints ~9,100 $BLUE from seals alone, before notes and
quests. This is the single biggest emission lever.

## Sinks (current + candidate)

- **Field-notes unseal: 400 $BLUE burned** (live, real burn to dead address).
- Single-note re-read: 50, currently an in-app deduct — `[assume]` convert to a
  real burn for the sim.
- `[assume]` candidate sinks to test: cosmetic profile/banner unlocks, boosting a
  quest bounty, gifting, priority access, streak insurance. The sim should let us
  add these and see what sink:source ratio stabilizes supply.

## Agent archetypes `[assume]` — tune the mix

Model a population as a mix of these. Suggested starting mix in parentheses.

- **Committed Learner (15%)** — seals ~1 week/week, writes most days, does
  milestone quests. High earn (~800–1,000/wk), low spend, mostly holds.
- **Casual Dabbler (45%)** — logs in ~2×/wk, occasional note, rare seal. Low
  earn (~50–150/wk), low spend.
- **Quest Farmer (15%)** — optimizes for reward-per-effort, does every quest,
  minimal depth. Medium-high earn, spends on sinks that gate content.
- **Creator (5%)** — authors custom courses, earns via their learners' activity
  and payouts. Interacts with $BLUE and USDC.
- **Lapsed (15%)** — earns for a few weeks, then churns. Tests dead-supply.
- **Speculator / Trader (5%, post-liquidity only)** — does not earn in-app; buys
  $BLUE to spend on sinks or to flip. Turns on when the market layer is enabled.

Each agent needs: earn rate (from the sources above by behavior), spend
propensity (which sinks, how often), and a **hold vs. sell** disposition for the
market layer.

## Market layer `[assume]` — only after liquidity is enabled

- Liquidity switch: off for phase 1 (utility-only), on for phase 2.
- Float: assume treasury seeds a pool with `[assume]` X $BLUE + Y USDC.
- Sell pressure: earners converting rewards to USDC (fraction by archetype).
- Buy demand: sinks that require $BLUE + newcomers buying in.
- Output: implied price path, and whether sinks absorb enough sell pressure to
  avoid a reflexive decline.

## Parameters to sweep

Run the base case, then vary one at a time:

1. Emission cap: none (current) vs. a hard cap vs. a halving/decay schedule.
2. Week-seal reward: 700 vs. 350 vs. decaying per week.
3. Sink count/price: unseal-only vs. unseal + 3 candidate sinks.
4. Population mix: learner-heavy vs. dabbler-heavy vs. farmer-heavy.
5. Reputation split on/off: does decoupling lifetime-earned from balance change
   spend behavior (people spend freely when spending does not cost them status)?

## Output metrics to return

- Net $BLUE emitted per active user per week, and per 1,000 users per month.
- Circulating supply at 6 / 12 / 24 months.
- Sink:source ratio, and the ratio needed for a flat float.
- % of supply held by lapsed/dead accounts.
- (Phase 2) implied price path and sink absorption of sell pressure.
- The single most stabilizing lever, ranked.

## How to read results back to the contract

- If net emission is wildly positive and no sink ratio fixes it → the contract
  needs an **emission cap or decay schedule**, and reward amounts (esp. the 700
  seal) need retuning before redeploy.
- If sinks can balance it → uncapped-with-sinks is viable; prioritize shipping
  more `burn` sinks over a cap.
- Either way, `burnFrom` + `permit` + roles are needed regardless (see
  token-architecture.md).
