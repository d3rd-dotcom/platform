# algorithm-2026.md — LinkedIn format, structure, and algorithm rules

Source: [LinkedIn Content Architecture](https://app.notion.com/p/3a297ad57299817ab638fdd08d68d565) (Notion)

This file is the authority on LinkedIn mechanics — no other repo file documents this.

A check against the existing 30-day campaign pack found **zero LinkedIn-specific content there to conflict with** (it targets Instagram, YouTube, Discord, Reddit). Almost everything here is fresh ground rules.

## What's confirmed vs. what's industry-inferred

LinkedIn's own engineering blog (Hristo Danchev, March 12, 2026) confirms a rebuilt feed: an LLM-embedding retrieval system plus a transformer-based "Generative Recommender." The name **"360Brew"** commonly attached to this comes from a separate, withdrawn LinkedIn research paper — LinkedIn has never officially confirmed 360Brew by name is the deployed ranker. Cite Danchev's post as confirmed; cite "360Brew" as a widely-used but not officially confirmed label.

## Ranking signals

- **Saves and comments both far outweigh likes — don't force false precision on exact ranking.** Design every post to be worth bookmarking AND worth a substantive comment.
- **No "golden hour"** in the time-of-day sense — but the **first 60-90 minutes after a post's own publish time** does matter for that post's trajectory. Keep a consistent posting rhythm (e.g., Mon/Wed/Fri).
- **External links in the post body cut reach by roughly 60%.** Any CTA that sends someone off-platform belongs in the first comment, never the caption.
- **Engagement bait is now actively detected and suppressed.** "Comment YES if you agree," reaction-polling gimmicks — actively suppressed, not just discouraged.

## The AI-detection penalty (most urgent finding)

An Originality.ai analysis of ~9,000 long-form LinkedIn posts found posts likely written by AI get **45% less engagement**. Every finished post must go through the mandatory humanization pass — not optional.

## Profile strategy

**Personal profiles outperform company pages by roughly 500-560% in reach.** Personal-profile-first, with company-page resharing as secondary.

## Format

- **Carousels are strong and recovering, not declining** — document/carousel posts generate 39% more reach and 30% more engagement than average (AuthoredUp, 3M posts through Feb 2026).
- **Polls are confirmed dead — deprioritize/drop for LinkedIn.** A reach trap: 1.78x reach, only 0.37x engagement. No existing LinkedIn poll content in this project to walk back.
- **Hook length: keep the opener under roughly 140-210 characters** so it fits before "see more" truncation on mobile.
- **Long-form (1,300+ characters) gets 18% more engagement** in one dataset. Separately, text-only *format* (vs. text+image/carousel) drops engagement ~18% — two different claims, don't conflate.
- **Named, reusable frameworks are a real differentiator.** MWA already has real internal frameworks — Ground Then Elevate, the Knowledge DAG structure, the Hierarchy of Information — worth considering for a public-facing name.
- **Classic copywriting skeletons:** PAS, AIDA, BAB — see `post-skeletons.md`.

## House rules

- **Hashtags: zero, always.** Explicit, deliberate MWA instruction — confirmed directly, overriding the research's 1-3 suggestion.
- No engagement-bait phrasing.
- No external links in the caption — first comment only.
- No emojis, no all-caps, no "X not Y" framing.
