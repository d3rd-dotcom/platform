# Part 1 — The System (build once, run each campaign)

Source: [Email Marketing Architecture](https://app.notion.com/p/3a497ad572998101bd68c6d12bdd70c8) (Notion)

The ten steps do not change between campaigns. Only the research in step 1 and the references in step 2 get refreshed when email norms or the brand shift.

## Setup — build the knowledge base (once)

**1. Deep research** — email deliverability, lifecycle/nurture best practice, and the senders with the highest email-driven retention. Captured on this page.

**2. Reference mining** — 3 to 5 senders whose style and goal match ours, enough to avoid overfitting to one voice. See the Reference Library.

**3. Pull email data** — subject patterns, cadence, structure, and what actually converts, from each reference.

**4. Extract patterns** — not raw examples, but what makes them work (adopt) and what to reject (anti-patterns).

**5. Brand filter logic** — strip the borrowed voice and tactics, re-apply MWA rules: no backstage vocabulary, Diamonds/credits only, no manipulation tactics, Blue as cameo only.

**6. Save to this page** — research, references, pattern library, brand filter, and the 2/5/7 skeletons live here as the permanent knowledge base.

## Runtime — use the knowledge base (every campaign)

**7. Draft generation** — draft the sequence and variants filtered through the saved rules. One email, one job.

**8. Review and pick** — you review and select the strongest variant. Human-in-the-loop, never automatic.

**9. Clean picked content** — run the picked email through voice, evidence, compliance, mechanics, and the humanization pass.

**10. Send / schedule** — publish through Resend + n8n on Railway, at a consistent send window, behavior-triggered where possible.

> ↻ **Feedback loop.** Track opens, clicks, mission completion, and whether the streak continued. Feed that back into step 5's filter and step 4's patterns. Without this, the system never improves past this first build.
