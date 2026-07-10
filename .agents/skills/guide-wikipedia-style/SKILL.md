---
name: guide-wikipedia-style
description: Wikipedia-style structure, sizing, and spacing for guide article pages. Use when editing the layout, typography, headings, dividers, or spacing of guide articles (app/home/guides/[slug]), the GuideBody renderer, or when normalizing guide body content stored in the guides table. Also covers the walkthrough trigger placement and overlay behavior on guide pages.
version: 1.0.0
user-invocable: true
---

Guide articles are the encyclopedia layer of Mental Wealth Academy. They should read like a well-set reference page: one title, a lede, ruled section headings, and a quiet, consistent vertical rhythm. This skill defines that system and how to apply it without breaking the surfaces that share code with guides.

## The anatomy of a guide page

Top to bottom, a guide page is:

1. **Page header** — breadcrumb/back link, subject chips, level chip, the `h1` title (`topicTitle`), and the walkthrough trigger. The walkthrough trigger lives in the header row beside the level chip, styled as a compact action, and opens an **overlay** (modal over the page), never an inline pop-down that shoves the article downward.
2. **Article divider** — a full-width horizontal rule with a small centered or leading icon, separating the header from the article. The article never starts as text floating in a bare div.
3. **Lede** — the first paragraph of the body, directly under the divider, with **no heading above it**. It is the summary; it needs no label.
4. **Sections** — each subsequent body block with a title renders as a ruled `h2` section (heading with a hairline `border-bottom`, Wikipedia style). Sub-headings inside rich text are `h3`/`h4`, smaller, unruled.
5. **Appendix components** — methods, materials, votes, verification log — after the article, separated by the same ruled-heading treatment.

## Sizing scale

Wikipedia works because headings step down fast and body text dominates. Use the design tokens; the rem values are the target ratio:

| Element | Size | Weight | Rule |
|---|---|---|---|
| `h1` page title | 2rem | serif/display per existing header style | none |
| `h2` section heading | 1.375rem | 500-600 | hairline border-bottom, full width |
| `h3` sub-heading | 1.125rem | 600 | none |
| Body text | 1rem | 400 | line-height 1.6 |
| Chips, meta, captions | var(--font-size-sm) | — | — |

The current `blockTitle` (1.75rem, nearly h1-sized) is the main offender — section headings must be visibly subordinate to the title.

## Spacing rhythm

One rule: **space belongs above headings, not below everything.**

- Heading margins: roughly `1.5em` top, `0.4em` bottom. A heading binds to the content under it.
- Paragraph margins: `0 0 0.9em`. Never add both a bottom margin on one element and a top margin on the next — pick one direction (bottom) and hold it everywhere.
- Container gaps: do not stack a flex `gap` on top of child margins; if the container has `gap`, children lose their outer margins. The current double-spacing (huge gap below the title, huger below the first paragraph) comes from exactly this stacking.
- First element after the article divider or any heading: `margin-top: 0`.
- Collapse empties: skip rendering blocks with no content, and never emit an empty heading.

## Redundant titles

Never render a body block title that repeats the guide's `topicTitle` (case-insensitive, trimmed). The `h1` already said it. Enforce in two places:

- **Render guard** in `GuideBody.tsx`: suppress `blockTitle` when it matches `topicTitle` (pass the title down as a prop).
- **Data normalization** for existing content: guide bodies live in `guides.body` (JSONB) in Postgres — a one-off script in `scripts/` (following existing script conventions for env loading) can null out first-block titles matching the guide title. The render guard is the fail-safe; the data fix keeps the content clean at the source.

## Where the code lives

- Page: `app/home/guides/[slug]/page.tsx` + `page.module.css` — header, level chip, walkthrough trigger, article wrapper.
- Body renderer: `components/guides/GuideBody.tsx` + `GuideBody.module.css` — block mapping and the typographic overrides.
- Walkthrough: `components/guides/GuideWalkthrough.tsx` — currently toggled inline by `showWalkthrough` state on the page; the overlay wraps this component, it does not change it.

## Hard constraints

- **`ComponentRenderer` is shared.** `GuideBody` adapts guide blocks into `components/course-renderers/ComponentRenderer.tsx`, the same renderer courses use. Never edit the shared renderer or its CSS for guide styling — scope every typographic override inside `GuideBody.module.css` via the wrapper (`.body :global(...)` descendant selectors or equivalent), so course surfaces are untouched. The course-design-parity skill governs those surfaces; guides must not leak into them.
- Fonts only via `--font-*` tokens; spacing via `--space-*` tokens where they exist.
- Reuse an existing overlay/modal pattern from the codebase for the walkthrough overlay (check components/ for the established modal convention and /styleguide) before writing a new one. Overlay must close on backdrop click and Escape, and lock body scroll while open.
- No emojis, no all-caps text, sentence case headings. Copy follows EDITORIAL.md (mwa-editorial skill).
- Mobile: the ruled headings and divider span the content column; the article column keeps a comfortable measure (roughly 65-75ch max-width) rather than stretching full-bleed.

## Definition of done for a restyle pass

- Exactly one `h1` on the page; no body heading repeats it.
- A divider with icon sits between header and article; the lede starts immediately under it with no heading.
- Section headings are ruled `h2`s at the scale above; vertical rhythm is single-direction with no double margins.
- Start walkthrough sits beside the level chip and opens an overlay; the article does not reflow when it opens.
- Course pages (`app/course/[slug]`, `app/shadow-work`, VIP course views) render pixel-identical to before — confirm the shared renderer CSS has no diff.
