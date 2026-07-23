# Email Marketing Architecture

Source: [Email Marketing Architecture](https://app.notion.com/p/3a497ad572998101bd68c6d12bdd70c8) (Notion)

A standalone reference system for turning a raw idea into a compliant, on-brand, send-ready Mental Wealth Academy email.

Same two-layer shape as the [LinkedIn Content Architecture](../linkedin/README.md) and [LinkedIn Marketing System Architecture](../linkedin/system-architecture.md) docs, consolidated into this folder: the **System** (how the pipeline runs) and the **Content Rulebook** (voice, exclusive-email style, visual/image drafts, mechanics, streak design, compliance, templates), plus a **Reference Library** and a ready **2/5/7 nurture sequence** you can adapt.

Goal this sequence is tuned for: **build a returning habit / streak** after signup. Send layer: **Resend + n8n on Railway**. Currency words: **Diamonds** and **credits** only, ever.

## Folder map

- `system.md` — Part 1: the ten-step pipeline (setup once, runtime every campaign).
- `content-rulebook.md` — Part 2: voice, the exclusive-email style, visual/image drafts, mechanics, streak/habit design, compliance.
- `reference-library.md` — Part 3: five reference senders (adopt / reject).
- `nurture-sequence.md` — Part 4: the six send-ready 2/5/7 emails.
- `metrics.md` — Part 5: the feedback loop and what to measure per email.

## How to use this page

Take a raw idea (a campaign concept, a rough draft, a single email someone wants sent) and run it through the pipeline below to get a compliant, on-brand, send-ready email. Nothing here needs memory of a past conversation to use.

**The one test, before drafting anything:** does this email give the reader one worthwhile thing and one clear next step that moves them back into the academy? If it does neither, fix the idea, not the wording.

**The ordered loop (idea → sent):**

1. **Intake** — what triggers this email, what state is the reader in (new, active, building, lapsed), what is the single job of this email.
2. **Skeleton** — pick a 2/5/7 slot or a copy skeleton (PAS/AIDA/BAB) as a starting shape, not a formula.
3. **Brand-voice draft** — write in MWA brand voice, apply Ground Then Elevate and the Hierarchy of Information. Blue appears only as a character cameo, never as the one making the ask.
4. **Evidence check** — every claim sorted Safe now / Requires measurement / Requires new functionality. Hold anything that does not clear it.
5. **Compliance check** — run the guardrails (no fake scarcity, no parasocial pressure, no reward-first acquisition, no backstage vocabulary, nothing minor-directed).
6. **Mechanics check** — subject, preview, one CTA, mobile-first, deliverability, real unsubscribe.
7. **Humanization pass (last)** — the AI-detection checklist, run after everything else.
8. **Send / schedule** — through Resend + n8n on Railway, at a consistent window.

---

*Setup runs once. Runtime runs every campaign. Refresh the setup phase when email norms shift or the brand guidelines change. This page is the rulebook; any drafted campaign is checked against it, not the other way around.*
