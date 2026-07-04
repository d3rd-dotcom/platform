# MWA token architecture

Status: draft for review. Nothing here is deployed. This exists so the next
$BLUE contract is shaped by a decision instead of by a default.

## The decision this document assumes

James: "I one day see people buying/selling $BLUE on an exchange." So $BLUE is a
**tradeable utility asset**, not a closed-loop points system. That single fact
drives everything below — most importantly, it forces us to separate *status you
earn* from *tokens you can buy*, because the moment $BLUE is liquid, anything
priced in "current balance" becomes purchasable.

## Three assets, three jobs

| Asset | Job | Fungible? | Tradeable? | Earned or bought? |
|---|---|---|---|---|
| **$BLUE (Diamonds)** | Utility + reward currency. The thing you earn for doing the work and spend on unlocks. Liquid on a DEX eventually. | Yes (ERC-20) | Yes, someday (deliberate, later) | Both — earned in-app, buyable once liquid |
| **Votes** (formerly "Cakes") | Governance. Weighting proposals, treasury allocation, market/trader-mode decisions on /trades. | Yes (ERC-20) | Governance-scoped, not a meme trade | Earned/allocated, staked to vote |
| **Membership NFTs** — Soul Key (VIP), Academic Angel (Membership) | Access + perks + eligibility (e.g. USDC quest payouts). | No (ERC-721) | Secondary market ok | Bought / granted |

$BLUE should not also try to be the governance token — that's Votes' job. Keeping
them separate means we can make $BLUE liquid and speculative without handing
governance weight to whoever buys the most on a DEX.

## The core move: reputation is not balance

If level / accolade / leaderboard rank are computed from a user's **current
$BLUE balance**, then once $BLUE is tradeable, someone can buy "Level 24 /
Digital Alchemist." On a mental-health platform that is actively harmful — it is
pay-to-appear-well, and it hollows out the one thing that makes the profile mean
anything.

Fix: track two numbers per user.

- **Lifetime earned ($BLUE_earned)** — a monotonic counter that only goes up, and
  only from *doing the work* (course seals, notes, quests). Never reduced by
  spending, never affected by buying or receiving transfers. This drives level,
  accolade, streak, leaderboard — all reputation.
- **Spendable balance ($BLUE on-chain)** — the ERC-20. Earned rewards mint into
  it, sinks burn out of it, and someday it trades. This drives what you can
  *afford*, never who you *are*.

Today `users.shard_count` conflates the two. The architecture keeps them apart:
reputation reads lifetime-earned; the burn/unseal flow reads on-chain balance
(already true after the recent chain-balance work). Lifetime-earned can live in
the DB now and graduate to an on-chain soulbound counter later if we want it
verifiable.

## What each app surface uses

- **Application** (courses, field notes) — earns $BLUE (mints), spends $BLUE
  (burn sinks: unseal, re-read, future cosmetic/boost unlocks). Reputation from
  lifetime-earned.
- **Trading** (/trades, treasury, markets) — this is **Votes** territory
  (governance over treasury/markets) plus the real prediction markets. $BLUE is
  not the trading chip here; keep speculation off the reputation asset until
  $BLUE liquidity is switched on deliberately.
- **Social** (community, creator courses, quests) — reputation (lifetime-earned)
  is the legible, hard-to-fake signal. Creator payouts and quest bounties are
  USDC / $BLUE as already built.

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
- **Soulbound earned-counter on-chain** — nice-to-have; DB is fine to start.

Explicitly *not* on $BLUE: `ERC20Votes` (that's Votes), pausable/blocklist
(centralization + optics risk on a wellness token).

## Open questions for James

1. Does **lifetime-earned reputation** feel right as the fix, or do you want
   status to be spendable/at-risk (a different game)?
2. Should **Votes** be a fresh token, or is it $BLUE staked? (Leaning fresh —
   separation is the whole point.)
3. When liquidity turns on, does treasury seed the pool, and with what? (Feeds
   the sim's market layer.)
