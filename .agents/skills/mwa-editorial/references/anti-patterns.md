# Editorial Anti-Patterns

Things to grep for and remove. Drift modes from `EDITORIAL.md` Part 3.

## "This is X, not Y" phrasing — the hard rule

**Never define us by contrast.** Do not write "we're not a crypto app, we're a…" or "this isn't self-help, it's…". The Hierarchy of Information says state what a thing *is*; the negative framing is internal positioning only.

- No: "This isn't another meditation app — it's a research lab."
- Yes: "A research lab for personal development, with Blue as your co-investigator."

## Corporate-wellness tells

Watch for: *optimize your life, unlock your potential, level up your life, your best self, transform your mindset, holistic, synergy, empower, journey of self-discovery, step into your best era*.

These are LinkedIn words. Replace each with the specific psychological frame or the concrete mechanism it's gesturing at.

## Recruiter / referral-bait tells

Watch for: *invite your friends and earn, refer and get, share to unlock, grow your network, spots filling fast, don't miss out*.

We are not a growth funnel. Talk about the work and the rewards for doing it, never about recruiting other people.

## Vague self-help tells

Watch for: *journey, awakening, manifest, alignment, vibration, frequency, higher self, true self, best era, deeper meaning*.

Each has a place only if grounded immediately to a concrete mechanism. Standing alone, cut it or anchor it.

## Crypto-bro tells

Watch for: *WAGMI, ser, gm, ngmi, frens, anon, based, alpha, degen, ape in, diamond hands, to the moon*.

Zero of these belong in MWA copy. We are internet-savvy but never trend-hopping.

## Crypto infrastructure leaking into copy

The chain is a primitive, never the pitch. Grep marketing copy for: *Base, $BLUE, blockchain, onchain, crypto, token, wallet, mint, burn, gas, NFT, DEX, smart contract, transaction hash*, and tickers. All of it is backstage vocabulary — it belongs in `docs/tokenomics/` and technical surfaces only. "Diamonds" and "credits" are the product nouns; describe rewards as real, permanent, and owned, and stop there.

## Generic AI-product copy

If the page describes a feature ChatGPT, Claude, and 50 other AI products also have, you've underdescribed. What's specific to MWA?

- No: "Our AI is trained to understand you"
- Yes: "Blue retains memory of every quest you've submitted and uses it to calibrate her review of the next one — then pays the reward herself, from her own stash"

## Audience-mixing in one section

The Primary reader is a Gen-Z individual (ages 18 and up) seeking growth; the Secondary reader is a scientist/academic. Don't start a section speaking to the individual and end it pitching researchers. Pick one audience per surface (`voice.md`). If you need both, separate them physically.

## Repeated information

Common pattern: a heading that says X, a sub-heading that says X again, an intro that says X a third time. Each layer must add new information.

- No: Heading "Our Mission" / Sub "What We Stand For" / Body "At MWA, our mission is..."
- Yes: Heading "Invest In Human Potential" / Body "Small, consistent actions today make the future measurably better."

## "We are excited to announce"

Just announce it.

## Mechanism-as-title

Feature titles, nav labels, and section headers name the **category** the user is entering — not how it works. Mechanism goes in the body underneath.

| Mechanism-as-title | Category-as-title |
|---|---|
| Twelve-Week Cohort | A Micro-University For Intellectual Refreshment |
| AI Reviews Your Progress | A Platform Governed By A Shade Of Blue |
| A Crypto Token Called Diamonds | Rewards That Belong To You |
| Building Research | Parasocial Research Programs |
| Memory That Compounds | Certified Academic Labs |
| One NFT, Full Access | A Membership You Own Forever |

The pattern: bad titles describe *how it works*. Good titles name *what you're joining*. A short, research-elevated title sets the frame; the sentence below grounds it. Rows three and six also remove the technology from the title entirely — chain vocabulary never reaches marketing (see "Crypto infrastructure leaking into copy").

## ALL CAPS

Never set words or headings in all caps. Title Case is fine for feature titles (the brand uses it); ALL CAPS is not a house style. Her name is **Blue** in prose; `BLUE`/`$BLUE` only for the token and code identifiers.
