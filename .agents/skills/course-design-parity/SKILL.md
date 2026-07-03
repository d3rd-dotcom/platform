---
name: course-design-parity
description: Keep the two course surfaces visually identical. Use whenever you change the design/CSS (or shared JSX layout) of the custom-course view (app/course/[slug]) OR the main 12-week course (app/shadow-work) — a change to one MUST be mirrored to the other, or the two drift apart.
version: 1.0.0
user-invocable: true
---

MWA renders course content through **two separate pages that intentionally share one design system.** They are not wired together in code, so a design change to one silently leaves the other behind. This skill is the checklist that keeps them in lockstep.

## The two surfaces

| | Custom courses (VIP / Blue-built) | Main course ("Creative Healing") |
|---|---|---|
| Page | `app/course/[slug]/page.tsx` | `app/shadow-work/page.tsx` |
| Base layout CSS | `app/course/page.module.css` (`courseStyles`) | `app/shadow-work/page.module.css` (self-contained) |
| View-specific CSS | `app/course/[slug]/page.module.css` (`styles`) | same file (merged into `page.module.css`) |

**Current source of truth: the custom-course files are AHEAD.** When in doubt, `app/course/page.module.css` wins and `app/shadow-work/page.module.css` gets updated to match.

## The rule

> Any change to a **shared** class or shared layout structure on one surface must be applied to the other in the same commit.

Shared classes (same names in both files, must stay identical):

```
pageLayout · bgViz · content · contentDesktop · leftCol · rightPanel
controlPanel · popupCard · panelBanner · panelBody · panelAvatarWrap · panelAvatar
panelHeader · panelTitle · panelTitleDivider · panelDescription · panelDivider
weekNav · weekNavArrow · weekNavDots · weekDot(+Active/Sealed/Loading)
weekContent(+SwipeLeft/Right) · readingCard(+Active) · readingAccent · readingThumb(+Img)
readingInfo · readingCategory · readingTitle · readingArrow · missionsHeadingRow/Divider/Heading
inlineReader · inlineReaderInner · inlineReaderBack/Header/Category/Title/Body · backBtn
skeletonBlock + all *Skeleton* classes
```

Plus every `:global([data-theme="dark"])` override for the classes above.

## What NOT to sync (deliberate per-surface differences — leave alone)

- **`.panelBanner` `background-image`** — shadow-work hard-codes a themed image; the custom course sets its cover via an inline `style` (`coverImageUrl`). Different by design.
- **Panel title / description / week data** — content, not design (`WEEKLY_READINGS`, hard-coded "Creative Healing", etc.).
- **Mission rendering** — shadow-work renders `<WeekTasksView>`; the custom course renders a `missionGrid` of `ComponentRenderer` tiles. The `missionGrid`/`missionTile`/`detailCard`/`seal`/`confirm*` classes only actually render on the custom course. Keep them consistent if you touch them, but they are not what makes the two pages look the same day-to-day.

## Workflow when you change course design

1. Make the change on whichever surface you're working in.
2. `diff` the shared base to find what drifted:
   ```bash
   diff <(sed -n '1,849p' app/course/page.module.css) app/shadow-work/page.module.css
   ```
   Lines marked `<` (present only in the custom base) that belong to a shared class are the drift — port them into `app/shadow-work/page.module.css`. Ignore the large shadow-work-only block (mission/detail/seal/confirm) and the `.panelBanner` image line.
3. Apply the same edit to the other file's matching class.
4. If the change is to shared JSX structure (the `controlPanel`/`weekNav`/`readingCard`/`rightPanel` markup), mirror that too — both pages hand-roll the same tree.
5. Re-run the diff. It should show only the known deliberate differences above.

## Independent right-panel scroll (the intended behavior)

Both pages use a two-column desktop grid (`contentDesktop` = `leftCol` + `rightPanel`). The right panel is `position: sticky` and owns its **own** scroll area so the reading/task detail can scroll without moving the left mission list:

```css
.rightPanel {
  position: sticky;
  top: calc(72px + 24px);
  max-height: calc(100vh - 72px - 48px);
  overflow-y: auto;
  overscroll-behavior: contain;   /* don't chain scroll to the page */
  scrollbar-width: thin;
}
/* Below the desktop grid the panel is normal flow — no inner scroll box. */
@media (max-width: 1023px) {
  .rightPanel { position: static; max-height: none; overflow: visible; }
}
```

Keep this block identical in both `page.module.css` files.
