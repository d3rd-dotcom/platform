# Part 2 — The Content Rulebook

Source: [Email Marketing Architecture](https://app.notion.com/p/3a497ad572998101bd68c6d12bdd70c8) (Notion)

## Voice — how MWA sounds in an email

**Authority:** `EDITORIAL.md` and the brand-voice rules in [voice-brand.md](../linkedin/voice/voice-brand.md) are canonical. This restates them for email. On email-specific mechanics (subject, preview, cadence, deliverability), this page is the authority.

### Emails are brand voice

- Write in MWA brand voice: academic, visionary, calmly skeptical of hype, concrete before poetic.
- Apply **Ground Then Elevate** — concrete fact first, narrative framing second, never the reverse.
- Apply the **Hierarchy of Information**: what it is, what it does, why it matters, what it means. Most drafts jump to the last one. Reorder.
- The banned "LinkedIn words" apply here too: optimize your life, unlock your potential, level up, your best self, transform your mindset, holistic, synergy, empower, journey of self-discovery, step into your best era.

### Blue in an email — cameo only

- Blue may appear as a short, set-off **character cameo** (the way Duo appears in Duolingo email), reacting to or celebrating something real.
- Blue **never** makes the ask, writes the CTA, explains the product from the outside, or applies pressure. Brand voice handles the ask.
- When she speaks: giddy short bursts, exclamation points are natural, no em dashes, no emojis, no all-caps, one tangent at most. Her ledger and payouts stay exact even when she is silly. Honesty floor: locked is locked, a wrong answer is wrong.

### Sentence mechanics

- One idea per sentence, active voice, present tense.
- Cut hedge words (just, simply, basically, really, very, quite) and "that" constructions.
- Never all-caps a word or heading. Never use "this is X, not Y" framing.

## The exclusive-email style — the "top context" layer, blended and made MWA-safe

This is the differentiator: an email that feels selective and personal without a single manufactured tactic. Blended from Superhuman (white-glove, selective) and Morning Brew (reliability as intimacy), filtered through MWA's anti-manipulation rules.

- **Genuine selectivity only.** Speak to the reader as an early / founding-cohort member *because they actually are one*. Never invent exclusivity or a badge for effect.
- **Belonging over scarcity.** "You are part of a small group shaping this" — never "seats running out" or a resetting countdown.
- **One quick win first.** The earliest emails hand over a real, small win before asking for anything (Superhuman's opening move).
- **Relevance over volume.** Fewer, better emails. Every send carries one worthwhile thing and nothing filler. Strava cut email volume to roughly a third and engagement rose; do the same.
- **Consistency is intimacy.** A predictable rhythm is what turns a reader into someone who expects you (Morning Brew's whole engine). The 2/5/7 cadence is that promise.
- **White-glove warmth, no salesperson.** Brand voice carries the care; Blue's cameo carries the personality. Neither hard-sells.

## Visual and image drafts for Gmail — colors, type, hero specs, motifs

Values pulled from the live design system (same source as the LinkedIn visual file, which corrected two documentation-drift issues — use these, not `EDITORIAL.md`'s reversed typography).

### Palette

- **Academy Blue `#5168FF`** — dominant brand color, lead with it.
- **Academy Indigo `#50599B`** and **Study Violet `#7A56C6`** — supporting/secondary tones.
- **Streak Green `#8BE4AC`** and **Gold `#B58A00`** — momentum, streak, and reward accents only.
- **Blackpill / Ink `#1A1B24`** — text. **Canvas** cool blue-white — background.
- Avoid Neon Pink `#EC4899` as a dominant tone; card accent only.

### Typography (in-image text)

- Display / headings: **Space Grotesk**. Body: **Commit Mono**. Hand-drawn flourish: **Patrick Hand**, sparingly.

### Reusable motifs (from the landing film)

- **Ascent through indigo clouds toward a floating glass academy** — arrival / welcome.
- **Branching luminous paths forming worlds** — the map / "simulate your world."
- **Orbital glass structures, a living network of light** — ecosystem / the circle.
- **Warm light through a library atrium, drifting pages** — belonging / your place is kept.
- **Sunrise over a cloud sea, light ascending** — invitation / a new day of the habit.

### Email image specs

- **Hero banner: 1200×600 (2:1)** for a Gmail-safe top image, or **1080×1080 (1:1)** for a square block.
- Light-mode canvas background; keep essential text large (many read on mobile).
- Always ship an image-light fallback: the email must read fully with images off.
- **AI-image prompt structure:** Subject + Setting + Style + Lighting + Composition + Technical. Lead with Academy Blue. Current models: Gemini / Nano Banana, Flux Pro / Kontext, Ideogram 3.0 (best text-in-image), GPT Image, Midjourney v7, Recraft V3 (brand-consistent vector).

## Mechanics — the email-specific rules (subject, preview, cadence, deliverability)

This is email's equivalent of the LinkedIn algorithm file. Grounded in the `emails` marketing skill and 2026 reference research.

### Core principles (from the emails skill)

- **One email, one job** — one purpose, one primary CTA.
- **Value before ask** — lead with usefulness, earn the ask.
- **Relevance over volume** — fewer, better, segmented.
- **Clear path forward** — every email moves them somewhere specific.

### Subject line

- 40 to 60 characters. Clear beats clever. Specific beats vague. One idea.
- Always draft two variants and A/B test the opener on a small slice first (Morning Brew tests every send).
- Emojis are polarizing and collide with MWA style — default to none.

### Preview text

- Roughly 90 to 140 characters. Extend the subject, do not repeat it. Complete the thought or add intrigue.

### From-name and reply-to

- Default from-name: **Mental Wealth Academy**. Optional warmer variant: **Blue at Mental Wealth Academy** (body still brand voice).
- Reply-to must be a real, monitored inbox.

### Body

- Roughly 120 to 250 words for a nurture email. Short paragraphs (1 to 3 sentences), white space, mobile-first — most opens are on a phone.
- One primary CTA as a button; label it action plus outcome ("Start your first mission", not "Click here").

### Cadence and timing (the 2/5/7 model)

- Day 0 welcome already runs via `sendMeetBlueEmail()`. This page covers **Day 2, Day 5, Day 7**.
- Pick one send window and hold it — predictability is what builds the habit.
- Send at the recipient's local time where possible. This audience is Gen-Z / B2C, so evenings and weekends are worth testing, not avoiding.

### Deliverability (non-negotiable)

- Authenticate the sending domain (SPF, DKIM, DMARC).
- Prune non-engagers regularly — list hygiene took Morning Brew from about 60% to 99% inbox placement.
- Real, one-click unsubscribe in every send. Honest sender identity. No deceptive subject lines.
- Keep image-to-text balanced and always provide a plain fallback.

### Personalization

- Use the first name only if known — the audience is anonymous-by-default, so every email must also read well with no name.
- Prefer behavior-triggered variants (active vs. lapsed) over broadcast, the way Headspace fires action-based emails ("1 for 1").

## Streak and habit design — the goal this sequence is tuned for, done without coercion

Adopted from Duolingo, Strava, and Headspace; the coercive parts are explicitly rejected (see the Reference Library).

- **Give the streak breathing room.** A weekly rhythm survives real life; a daily-punishing one breaks for reasons outside the reader's control and makes the system feel like it is working against them (Strava's deliberate weekly-not-daily choice).
- **Build in freeze / repair, not shame.** Nothing expires or resets because someone took a break. "Your place is kept" beats "you lost your streak." (Duolingo's freeze infrastructure measurably extends streaks; the humane version is the point.)
- **Motivate from the reader's own reason.** Tie every nudge to why *they* signed up, not to what they owe us (Headspace's intrinsic-motivation onboarding).
- **Make it identity, not obligation.** "You are becoming someone who returns to learn in small steps" — identity attachment outlasts habit tricks (Duolingo's strongest retention lever).
- **Attach the habit to an existing routine** (morning coffee, the commute) so it has an anchor.
- **Tie genuine rewards to genuine effort.** Completing a real challenge can unlock a real Diamond reward or early access (Strava's challenge-to-unlock), never a vague giveaway.

## Compliance — MWA guardrails plus email-specific rules

### MWA guardrails (all apply, every send)

- No fake scarcity or resetting countdowns. Any limit must be real, with its exact reason stated.
- No investment-coded urgency — no price talk, profit implication, "early" status framed as future value, or reward-as-investment.
- No undisclosed creator or participant relationships.
- No unsubstantiated mental-health outcomes — no diagnosis, treatment, prevention, or efficacy claims.
- No manufactured consensus — state unit, window, source, and limit for every metric.
- No reward-first acquisition — no task whose only purpose is claiming a reward.
- No parasocial pressure from Blue — she never implies the reader owes her attendance, spending, or engagement.
- Nothing minor-directed — the audience begins at 18.
- No backstage vocabulary anywhere, including image text and alt text: Base, $BLUE, blockchain, onchain, crypto, token, wallet, mint, burn, gas, NFT, DEX, smart contract, transaction hash, any ticker. Say "credits" or "Diamonds" for reward, "cash" or "a dollar bounty" for money.

### Email-specific

- A real, working unsubscribe in every send (legal and ethical baseline).
- Honest subject lines — the body must deliver what the subject promised.
- Respect frequency — relevance over volume; do not pad the calendar.
- No dark-pattern "last chance / only 2 left" unless it is literally, verifiably true.

### Evidence discipline

- Sort every claim: **Safe now** (true from how the feature works today), **Requires measurement** (needs a metric that does not exist yet — do not state as fact), **Requires new functionality** (product does not do this yet — never state as current).
- Source every external statistic against its primary source. A fixed send date never overrides a held claim.

### Humanization pass (mandatory, last)

- Banned words: meticulous, pivotal, robust, showcase, tapestry, testament, underscore, valuable, vibrant, stands as, serves as, marks a shift, evolving landscape, focal point.
- Banned patterns: negative parallelism ("not just X, it is Y"), transition padding ("in summary"), vague attribution ("some argue").
- Read the finished email aloud once; rewrite anything that needs an unnatural breath.

## Templates — 2/5/7 slots and copy skeletons

### The 2/5/7 slots (streak/habit goal)

- **Day 2 — the first real step.** Hand over one quick win or the smallest possible first action. Plant the idea that a second small step is where momentum starts.
- **Day 5 — what compounds + belonging.** Show how finished pieces connect into a map; bring in the anonymous shared effort of the early group; offer one step deeper. Have a no-guilt win-back variant ready for anyone who has not returned.
- **Day 7 — cement the identity + honest exclusivity.** Name the pattern they have built; anchor it to a routine; or open a genuine challenge that unlocks a real reward. No countdown tricks.

### Copy skeletons (a starting shape, not a formula)

- **PAS** — Problem, Agitate (the real cost, never manufactured), Solve (Ground Then Elevate).
- **AIDA** — Attention (subject under the limit), Interest (one concrete detail), Desire (a real feature the reader wants), Action (one CTA).
- **BAB** — Before, After (every claim cleared by evidence), Bridge (the specific mechanism — the part most likely to get cut when rushing).

None of these override Ground Then Elevate or skip the humanization pass.
