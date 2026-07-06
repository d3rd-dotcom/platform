---
name: mwa-editorial
description: Mental Wealth Academy editorial voice + copy review. Use when writing or reviewing landing copy, app strings, marketing prose, blog posts, social posts, error messages, empty states, or any user-visible text. Enforces the EDITORIAL.md brand book (v4.0).
version: 2.0.0
user-invocable: true
---

This skill enforces the Mental Wealth Academy voice. The full source of truth is `EDITORIAL.md` at the repo root (Brand Book v4.0) — this skill is the working filter. When a reference and `EDITORIAL.md` disagree, `EDITORIAL.md` wins.

## The one test (run it first)

Before writing or accepting any sentence, ask:

> **Does this communicate an educational gameworld, an academic aspect, or a feature — meaningfully?**

If it doesn't land on one of those three concretely, cut it or ground it. This single question catches more drift than every other rule combined.

## Voice in one breath

**Upbeat, academic, short, sweet.** Internet savvy, never trend-hopping. The energy of debunking conspiracies online — curious, evidence-first. Endless positivity and encouragement, where the lift comes from concrete wins, not hype adjectives.

## Routing

Pick the reference that matches the task:

- **Writing new copy** → `references/voice.md` (what we sound like + who we serve) + `references/sentence-rules.md` (line-level mechanics)
- **Reviewing/editing existing copy** → `references/anti-patterns.md` (what to cut) + `references/sentence-rules.md`
- **Blue, narrative copy, or anything that risks sounding inflated** → `references/ground-then-elevate.md` (the central rule of the brand)
- **Choosing how to frame the product to a specific audience** → `references/voice.md` (Primary = individuals 21–28; Secondary = scientists/academics)

When in doubt, load all four references — they're short — and check `EDITORIAL.md` for anything they don't cover.

## Hierarchy of information

Every concept introduction follows this order:

1. **What it is** — functional definition
2. **What it does** — practical reality
3. **Why it matters** — value proposition
4. **What it means** — narrative / philosophical layer

Most drafts jump straight to #4 without earning #1–3. Reorder before publishing. **Never frame with "this is X, not Y."** State what it is.

## What this skill does NOT cover

- Blue's in-character dialogue → use `mwa-blue` instead. Her voice is distinct from the brand voice.
- Visual / layout / typography decisions → covered by `EDITORIAL.md` "Visual Identity" but not by this skill. The skill is for words only.

## Final checklist before shipping copy (from EDITORIAL.md Revision Checklist)

- Can someone explain what we do after reading this?
- Is every poetic phrase grounded in something concrete?
- Does the order go real → story layer, not story layer → real?
- One main idea per paragraph?
- Cut every sentence that sounds cool but means nothing?
- Did I avoid "this is X, not Y" phrasing?
- No recruiter/referral-bait, no corporate-wellness or vague self-help tells?
- Would an investor understand this? Would an artist feel it?

If any answer is "no," go back to the relevant reference and revise.
