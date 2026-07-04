# $BLUE economy — simulation model

Feed this into /simulation as the scenario spec. It defines the agent
population, their earn-and-spend behavior, and the real emission and sink rules.

Design frame (locked): $BLUE is a **fun, expendable, high-velocity currency** —
earned as fair value for time on the platform, meant to be *spent* on unseal,
/shop, and games, not hoarded as status. So the run's job is not "does hoarding
inflate supply" but: **is there enough fun sink capacity to absorb what people
earn, and does a typical user get a fair, satisfying exchange for their time?**

All numbers below are the *live* values from the codebase as of this draft, not
invented. Where a value is an assumption for the sim, it is marked `[assume]`.

## Questions the simulation must answer

1. **Sink coverage** — do today's sinks (only the 400 unseal) absorb what people
   earn? What is net $BLUE minted per active user per week with, and without, a
   full shop + games sink layer?
2. **Fair value for time** — for a typical user's weekly activity, how much can
   they earn, and does that buy a satisfying amount of fun (unseals, shop items,
   game plays)? Earn-to-afford ratio, not just supply.
3. **Velocity** — how fast does an earned $BLUE get spent? A healthy spend
   economy has high velocity (tokens circulate); low velocity means people are
   hoarding, which signals the sinks aren't fun or aren't worth it.
4. **Inflation trajectory** — circulating (unspent) supply over 6 / 12 / 24
   months against the 200M Blue allocation and 1B design reference, once sinks
   are doing their job.
5. **Price pressure at liquidity** — when trading turns on, how much sell
   pressure comes from earners cashing out vs. buy demand from sinks + newcomers?
6. **Policy levers** — which single change most stabilizes it: more/better sinks,
   an emission cap, reward retuning, or reward decay over time?

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

## Sinks — the heart of the model

The token is meant to be spent, so sinks are the main thing to design, not an
afterthought. Emission is roughly fixed by the reward table; the question is
whether there are enough *fun, worth-it* places to spend that a normal user
happily burns most of what they earn. Model these as a menu with prices and
per-archetype uptake, and let the sim tell us the mix that keeps velocity high.

- **Field-notes unseal: 400 $BLUE burned** (live today, real burn to dead
  address). The only shipped sink.
- **Single-note re-read: 50** — currently an in-app deduct; `[assume]` convert to
  a real burn.
- **/shop `[assume]`** — the big one. Digital + real goods priced in $BLUE, and
  $BLUE-for-discount on USDC items (spend earned tokens to lower what you pay —
  the "fair value for your time" loop). Model a spread of price points.
- **Games `[assume]`** — pay-to-play $BLUE sinks with reward faucets (net-sink on
  average). Prosocial mini-games, not gambling. High-velocity by design.
- **Other candidates `[assume]`** — cosmetic profile/banner unlocks, streak
  insurance, boosting a quest bounty, gifting to another user.

The sim should let us toggle each sink and price and read back velocity + sink
coverage, so we can find the sink layer that makes spending feel great.

## Agent archetypes `[assume]` — tune the mix

Model a population as a mix of these. Suggested starting mix in parentheses.

- **Committed Learner (15%)** — seals ~1 week/week, writes most days, does
  milestone quests. High earn (~800–1,000/wk); spends readily on unseal + shop +
  games (this is the archetype most likely to bank a surplus — watch it).
- **Casual Dabbler (45%)** — logs in ~2×/wk, occasional note, rare seal. Low
  earn (~50–150/wk), spends most of it on small fun.
- **Quest Farmer (15%)** — optimizes reward-per-effort, does every quest, minimal
  depth. Medium-high earn; spends on content-gating and games.
- **Creator (5%)** — authors custom courses, earns via learners' activity and
  payouts. Interacts with $BLUE and USDC.
- **Lapsed (15%)** — earns for a few weeks, then churns. Tests dead-supply.
- **Speculator / Trader (5%, post-liquidity only)** — does not earn in-app; buys
  $BLUE to spend on sinks or to flip. Turns on when the market layer is enabled.

Each agent needs: earn rate (from the sources above by behavior), and a **spend
profile** — how much of income they spend, on which sinks, how fast. The key
behavioral variable is **spend rate** (fraction of earned $BLUE spent per week);
a fun economy pushes this high across archetypes. For phase 2, each also gets a
**cash-out fraction** (how much of a surplus they sell rather than spend).

## Market layer `[assume]` — only after liquidity is enabled

- Liquidity switch: off for phase 1 (utility-only), on for phase 2.
- Float: assume treasury seeds a pool with `[assume]` X $BLUE + Y USDC.
- Sell pressure: earners converting rewards to USDC (fraction by archetype).
- Buy demand: sinks that require $BLUE + newcomers buying in.
- Output: implied price path, and whether sinks absorb enough sell pressure to
  avoid a reflexive decline.

## Parameters to sweep

Run the base case, then vary one at a time:

1. Sink layer: unseal-only (today) vs. unseal + shop vs. unseal + shop + games.
   This is the headline sweep — the whole thesis is that fun sinks carry it.
2. Sink pricing: cheap-and-frequent vs. premium-and-rare, and the effect on
   velocity and satisfaction.
3. Spend rate: how the results change if agents spend 40% vs. 70% vs. 90% of
   income (i.e. how fun the sinks are).
4. Week-seal reward: 700 vs. 350 vs. decaying per week (the dominant source).
5. Emission cap: none (current) vs. a hard cap vs. a halving/decay schedule.
6. Population mix: learner-heavy vs. dabbler-heavy vs. farmer-heavy.

## Output metrics to return

- **Velocity** — average time from earning a $BLUE to spending it; % of weekly
  earnings spent vs. banked, per archetype.
- **Sink coverage** — total spent ÷ total earned; the target is near 1 (people
  spend roughly what they earn on fun).
- **Earn-to-afford** — for a typical week's activity, how many unseals / shop
  items / game plays it buys. The "fair value for your time" read.
- Net unspent $BLUE per active user per week, and circulating (banked) supply at
  6 / 12 / 24 months.
- % of supply stranded in lapsed/dead accounts.
- (Phase 2) implied price path and sink absorption of sell pressure.
- The single most stabilizing lever, ranked.

## How to read results back to the contract

- If fun sinks (shop + games) push sink coverage near 1 and velocity stays high
  → uncapped-with-sinks is viable; prioritize **building the sinks** over any
  supply cap. This is the outcome the design is betting on.
- If people still bank a large surplus no matter the sink layer → reward amounts
  (esp. the 700 seal) need retuning and/or an emission cap or decay before
  redeploy.
- Either way, `burnFrom` + `permit` + roles are needed regardless, and Level /
  accolade should move off token balance onto achievements (see
  token-architecture.md).
