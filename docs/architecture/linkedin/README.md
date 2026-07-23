# Entry Point — SKILL.md

Source: [LinkedIn Content Architecture](https://app.notion.com/p/3a297ad57299817ab638fdd08d68d565) (Notion)

This is the entry point for MWA's LinkedIn content architecture. Everything below is standalone, local-only reference material — it never modifies anything else in the Mental Wealth Academy repository, and it doesn't require memory of any prior conversation to use. If you're picking this up cold with a raw content idea, start here.

A standalone, local-only reference system for turning a raw idea into a compliant, on-brand, post-ready LinkedIn post. It does not replace `EDITORIAL.md` or the brand-book — see the Authority note in each section below for exactly how they relate. This is the *rulebook* that drafted posts and batches should be checked against.

## What this is for

Take a raw idea — a draft post, a rough concept, a batch of posts, a topic someone wants covered — and turn it into a compliant, on-brand, post-ready LinkedIn post, with zero ambiguity about which rules apply.

## Folder map

- **`linkedin/voice/`** — how MWA sounds on LinkedIn.
  - `voice-brand.md` — the brand's own voice (writing ABOUT MWA).
  - `voice-blue.md` — Blue's voice (writing AS Blue).
- **`linkedin/visual/`** — `visual-identity.md`: colors, typography, atmospheric visual themes, image/video specs, current AI image/video model list.
- **`linkedin/mechanics/`** — `algorithm-2026.md`: LinkedIn-specific format, structure, algorithm behavior, and platform house rules (hashtags, links, engagement bait).
- **`linkedin/compliance/`** — the checks a post must clear before it's finished.
  - `evidence-discipline.md` — the fail-closed rule for claims and statistics; the claims-ledger and positioning-ladder techniques.
  - `compliance-guardrails.md` — anti-manipulation rules (scarcity, urgency, disclosure, mental-health claims, parasocial pressure, minor-directed promotion).
  - `humanization-pass.md` — the mandatory AI-detection checklist.
  - `dino-out-of-scope.md` — a scope exclusion, not a voice guide: Dino does not appear in LinkedIn content until his product role is clarified with the team.
- **`linkedin/templates/`** — starting points for a draft.
  - `content-pillars.md` — candidate topic buckets.
  - `post-skeletons.md` — PAS/AIDA/BAB structures.

## The one test, before anything else

Before drafting: does this idea communicate an educational gameworld, an academic angle, or a feature that actually matters? If it doesn't land on one of those three concretely, it's not ready to become a post — go back to the idea, not to the wording.

## The workflow — idea to finished post

This is the ordered loop: take a raw idea in, run it through every stage below, and get a finished, compliant, humanized post out. Skipping a stage or reordering it (especially running humanization before evidence/compliance) produces a post that reads naturally but is still wrong.

1. **Intake.** What is the raw idea? Is it about the brand generally, or does it need Blue's voice specifically? Check `voice-blue.md`'s "when her voice belongs in a post" test before assuming she's the right voice for this idea. If the idea involves Dino in any way, stop — see `dino-out-of-scope.md`; he is not available for LinkedIn content.
2. **Pillar and skeleton (optional, if useful).** Does the idea fit one of the candidate topic buckets in `content-pillars.md`? Would a PAS, AIDA, or BAB structure from `post-skeletons.md` help shape a first draft? Use these as a starting point, not a requirement.
3. **Voice draft.** Write the draft using `voice-brand.md` (brand voice) or `voice-blue.md` (Blue's voice), never both in the same post's main copy. Apply Ground Then Elevate and the Hierarchy of Information (what it is → what it does → why it matters → what it means). Watch for the "LinkedIn words" collision named in `voice-brand.md` — LinkedIn's native professional register is largely what MWA's voice forbids.
4. **Evidence check.** Run every factual claim, statistic, and feature description through `evidence-discipline.md`: the Verified/Qualified/Blocked framework, the claims ledger (Safe now / Requires measurement / Requires new functionality), and the sourcing discipline. Hold anything that doesn't clear this — a fixed posting plan never overrides a hold.
5. **Compliance check.** Run the post through `compliance-guardrails.md` — no fake scarcity, no investment-coded urgency, no undisclosed relationships, no unsubstantiated mental-health outcomes, no manufactured consensus, no reward-first acquisition, no parasocial pressure if Blue is speaking, nothing aimed at a minor. Separately, check backstage vocabulary: no Base, $BLUE, blockchain, onchain, crypto, token, wallet, mint, burn, gas, NFT, DEX, smart contract, transaction hash, or any ticker, anywhere in the post.
6. **Format and mechanics check.** Run the post through `algorithm-2026.md`: hook under ~140-210 characters, no external link in the caption (first comment only), no hashtags (zero, always), no engagement-bait phrasing, right format choice (see `visual-identity.md` for image specs if the post needs a visual).
7. **Humanization pass (mandatory, last).** Run `humanization-pass.md` in full — check for an `avoid-ai-writing`-style skill in your current session first, then the manual checklist either way. This runs last because humanizing a post that still has an unverified claim or a compliance problem just makes the underlying issue sound more natural, not fixes it.
8. **Output.** Write the finished post as a new file — don't overwrite anything.

## Self-check before presenting a finished post

- It passed every stage above, in order.
- Every claim in it is either Safe now per the evidence-discipline claims ledger, or removed.
- No compliance guardrail is triggered.
- No backstage vocabulary appears anywhere, including in any image-text or alt text.
- Zero hashtags. No external link in the caption body.
- It has been through the humanization pass, not just voice-checked.
- If Blue's voice was used, the post is a character/narrative moment, not a pitch, CTA, or explainer aimed at someone unfamiliar with MWA.

If any of these isn't true, the post isn't finished — go back to the relevant stage, don't patch it in place at the end.

## When to stop and ask a human instead of resolving it yourself

- The idea requires a genuinely new factual claim with no available source — don't invent one; flag it and ask.
- The idea involves Dino in any capacity — out of scope; ask before proceeding at all.
- The idea touches Dormant project territory: DAO governance, Chainlink CRE workflows, Kalshi trader-bot automation, or Polymarket — do not build on these without asking.
- The idea requires a visual claim about Blue's appearance palette or MWA typography that conflicts with `visual-identity.md` — that file already resolved two known documentation-drift issues; if you find a third, ask rather than guessing which source is current.
- A compliance guardrail and an evidence check produce conflicting guidance you can't reconcile from the files alone.

## State and re-runs

This architecture doesn't track a persistent state file — each pass through the workflow is self-contained. If revising a post that already went through this workflow once, re-run the full sequence rather than patching only the changed part.

## A note on `marketing-psychology` material

If any future addition to this architecture draws on persuasion/behavioral-tactic reference material (scarcity, loss aversion, anchoring, social proof, and similar), it must state explicitly, in the file itself, that MWA's brand position is against using these tactics on its own audience. The only legitimate use of that kind of material is to *name and explain* a tactic when writing content *about* media literacy or manipulation-awareness.
