# MWA token architecture

Status: draft for review. Nothing here is deployed. This exists so the next
$BLUE contract is shaped by a decision instead of by a default.

## The decision this document assumes

Two things James has locked in:

1. "I one day see people buying/selling $BLUE on an exchange." $BLUE is a
   **tradeable utility asset**, not a closed-loop points system.
2. The token should be **fun and expendable, not hoarded**. You earn it as fair
   value for your time on the platform, and you *spend* it — to unseal field
   notes, in the /shop, on games, on perks that lower what things cost you.
   Status is explicitly **not** the point; a "who earned the most" leaderboard is
   a popularity contest we don't want.

Together these mean $BLUE is a **high-velocity spend currency**: designed to
circulate and be burned on fun, not to accumulate as a score. That also cleanly
removes the "buy your way to status" risk — if status never derives from the
token, there is nothing to buy your way into.

## Three assets, three jobs

| Asset | Job | Fungible? | Tradeable? | Earned or bought? |
|---|---|---|---|---|
| **$BLUE (Diamonds)** | Fun, expendable reward currency. Earn it for your time; spend it on unseal, /shop, games, perks. Liquid on a DEX eventually. | Yes (ERC-20) | Yes, someday (deliberate, later) | Both — earned in-app, buyable once liquid |
| **Votes** (formerly "Cakes") | Governance. Weighting proposals, treasury allocation, market/trader-mode decisions on /trades. | Yes (ERC-20) | Governance-scoped, not a meme trade | Earned/allocated (no staking — see below) |
| **Membership NFTs** — Soul Key (VIP), Academic Angel (Membership) | Access + perks + eligibility (e.g. USDC quest payouts). | No (ERC-721) | Secondary market ok | Bought / granted |

$BLUE should not also try to be the governance token — that's Votes' job. Keeping
them separate means we can make $BLUE liquid and spendable without handing
governance weight to whoever buys the most on a DEX.

## Reputation comes from what you did, not what you hold

$BLUE is spent, not hoarded, so it must not be the basis of status. Level,
accolade, and leaderboard should read **achievements** — courses completed,
weeks sealed, streak length, badges held — the prosocial things a person *did*,
which spending your tokens never erases and buying tokens never grants.

This is the concrete change from the current build: the profile Level and
accolade are currently computed from the diamond balance
(`levelFromDiamonds(balance)`), which under a spend-economy is backwards —
spend your $BLUE on something fun and you would "lose levels." Move Level and
accolade onto an achievement score (completions + streak + badges). No hidden
lifetime-earned counter, no popularity race — just "here's what you've done."

`users.shard_count` then becomes purely the spendable wallet, nothing more.

## What each app surface uses

- **Application** (courses, field notes) — earns $BLUE, spends it (unseal today;
  re-reads, cosmetic unlocks, streak insurance next). Reputation from
  achievements.
- **Shop** (/shop) — a primary sink. Real and digital goods priced in $BLUE, and
  $BLUE-for-discount on USDC-priced items ("fair exchange for your time" —
  spending what you earned lowers what you pay).
- **Games** — $BLUE as the chip in prosocial mini-games: pay-to-play sinks with
  reward faucets. A fun, high-velocity sink category, not gambling framing.
- **Trading** (/trades, treasury, markets) — **Votes** territory (governance)
  plus the real prediction markets. $BLUE liquidity is a later, deliberate step.
- **Social** (community, creator courses, quests) — reputation from achievements
  is the legible signal. Creator payouts and quest bounties stay USDC / $BLUE.

## Functions the next $BLUE contract needs

Safe regardless of timing — the current contract is missing these:

- `burn` / `burnFrom` (ERC20Burnable) — real sinks instead of transfer-to-dead.
- `permit` (ERC-2612) — gasless approvals; unblocks the gasless unseal burn.
- **AccessControl (roles)** instead of single-owner — safer minter management,
  lets minting decentralize later without an owner-key bottleneck.

Decisions the simulation should inform before we finalize:

- **Emission policy** — cap vs uncapped-but-sink-balanced. The current contract
  is uncapped and mint-only; see the sim model for whether that holds up once
  liquid. This is the biggest open question.
- **Transfer timing** — $BLUE is transferable by design, but liquidity (a DEX
  pool, treasury LP) is a later, capitalized step, not day one.

Explicitly *not* on $BLUE: `ERC20Votes` (that's Votes), pausable/blocklist
(centralization + optics risk on a wellness token).

## Governance without staking

James: staking is a complex feature regular people don't want to learn, and this
is a gamified education app — lean prosocial and fun, not DeFi. So Votes is not
stake-to-vote. Two no-staking options:

- **Membership-gated voting** — Soul Key / treasury access already exists; hold
  the NFT, get a vote. Simple, no new mechanic to teach.
- **Spend-to-signal** — spend a little $BLUE or Votes to back a proposal
  (quadratic-ish to blunt whales). Turns governance into another fun sink rather
  than a lock-up.

Leaning membership-gated for real governance, with spend-to-signal as a light
community-polling layer. Either way: no lock-ups, no staking UI.

## Open questions for James

1. Level/accolade moving to an **achievement score** (completions + streak +
   badges) — good? And what should count, and how much each?
2. Governance: **membership-gated**, **spend-to-signal**, or both (my lean)?
3. When liquidity turns on, does treasury seed the pool, and with what? (Feeds
   the sim's market layer.)
