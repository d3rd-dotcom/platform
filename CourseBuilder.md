# Course Builder — Architecture & Refactor Guide

## Current State

The course builder (`components/course-studio/`) is a drag-and-drop WYSIWYG for
creating authored VIP courses (stored in `vip_courses` → `course_weeks` →
`course_components`). It lives inside `CourseStudioModal` and has three main
areas:

```
┌─────────────────────────────────────────────────────────┐
│ Header (title, save, preview, publish)                   │
├──────────┬──────────────────────────────┬────────────────┤
│          │                              │                │
│Component │  MissionEditor  OR           │  (empty —      │
│ Panel    │  VideoEmbedEditor OR         │  WeekCanvas    │
│ (left)   │  ReadingEditor               │  is unused)    │
│ 420px    │                              │                │
│          │                              │                │
├──────────┴──────────────────────────────┴────────────────┤
│              ComponentPalette (bottom drawer)             │
└─────────────────────────────────────────────────────────┘
```

---

## Known Issues

### 1. No Week Navigation in Builder

`WeekCanvas.tsx` is fully built but **never imported**. The builder has no UI
for switching weeks, seeing all weeks at a glance, or adding new weeks.

- `addWeek()` exists at `CourseStudioModal.tsx:283` but no button calls it.
- `selectedWeekId` is set but the user can't change it.
- `ComponentPanel` only shows the current week's components.

### 2. Only 5 of 10 Component Types in Palette

The palette (`ComponentPalette.tsx`) only exposes:

| Type | Config |
|------|--------|
| `text_input` | `{}` |
| `multiple_choice` | `{ question: '', options: [], selectMultiple: true }` |
| `rating_scale` | `{ min: 0, max: 10, minLabel: 'Low', maxLabel: 'High' }` |
| `image_embed` | `{ url: '', alt: '' }` |
| `video_embed` | `{ url: '', description: '', question: '', answer: '' }` |

**Missing:** `rich_text`, `file_upload`, `reflection_journal`, `quiz_block`,
`password_gate`.

### 3. Default Configs Are Too Thematically Specific

The default configs lean into wellness/gratitude themes:

- `multiple_choice`: no generic question, no default options
- `rating_scale`: `minLabel: 'Low'`, `maxLabel: 'High'` — works but feels
  specific
- `video_embed`: has `question` and `answer` fields that aren't used in the
  renderer

Teachers need **neutral, generic defaults** they can adapt to any subject.

### 4. CSS Is Misaligned with /course

The builder CSS uses hardcoded color values and doesn't match the /course route
design system. Compare:

**/course page (reference)** — `app/course/page.module.css`:
- Cards: `background: color-mix(in srgb, var(--color-primary) 7%, #ffffff);`
  `border-radius: 14px;` `box-shadow: 0 2px 8px rgba(...);`
- Week nav: dots `10px` circle, `#E0E1EE` bg, `var(--color-primary)` active
- Missions heading: `font-size: 16px;` `font-weight: 700;` with dividers
- Task accent: `3px` bar, `border-radius: 999px`
- Task artwork: `40px` thumb, gradients with `color-mix`, 6 variants

**Builder (current)** — `CourseStudioModal.module.css`:
- `.panelCard`: `box-shadow: 0 6px 0 var(--color-primary), 0 10px 5px ...` —
  harsh, not matching /course
- No week nav dots
- No artwork thumbnails in component list
- Bottom palette is a collapsed drawer, not inline

### 5. Multiple Choice Renders Stacked Wrong

`MultipleChoiceRenderer` uses:
```css
.options_list > * + * { margin-top: 6px; }
```
Options stack vertically with no visual grouping. The selected state uses emoji
(`◉` `○` `☑` `□`) instead of styled radio/checkbox inputs. The component
doesn't match the /course card aesthetic.

### 6. No `rich_text` Editor

`rich_text` is the most flexible component type but has no palette entry and no
editor. It would be the primary vehicle for teachers to write instructions,
lessons, and content blocks.

### 7. Component Title Not Easily Changeable

The title input in `MissionEditor` saves on blur/Enter, not on keystroke. The
`useEffect` sync on `[component.id, component.title]` can cause flicker. No
title editing is available from `ComponentPanel` — you must open the component
first.

---

## Design Reference: /course Route

These CSS classes from `app/course/page.module.css` are the target aesthetic:

### Reading Card
```css
.readingCard {
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: 14px;
  min-height: 92px;
  padding: 14px 16px;
  background: color-mix(in srgb, var(--color-primary) 7%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, rgba(26,29,51,0.06));
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(26,29,51,0.04);
}
```

### Week Dots
```css
.weekDot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #E0E1EE;
  border: 1.5px solid rgba(26,29,51,0.08);
}
.weekDotActive {
  background: var(--color-primary);
  transform: scale(1.2);
}
```

### Week Nav
```css
.weekNav { display: flex; align-items: center; gap: 8px; margin: 12px 0; }
.weekNavArrow {
  width: 28px; height: 28px;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(26,29,51,0.1);
  border-radius: 8px;
}
```

### Task Accent (for mission cards)
```css
.taskAccent {
  width: 3px; height: 28px;
  border-radius: 999px;
  background: var(--color-primary);
  flex-shrink: 0; opacity: 0.85;
}
```

### Missions Heading
```css
.missionsHeadingRow {
  display: flex; align-items: center; gap: 12px;
  margin: 8px 4px 0;
}
.missionsHeading {
  font-size: 16px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
}
.missionsDivider { flex: 1; height: 1px; background: rgba(26,29,51,0.1); }
```

### Task Artwork Variants (6 gradients)
```
aurora, sunrise, orbit, bloom, ribbon, prism
```
Each is a `40px` (or `36px` in compressed view) box with a multi-layer
gradient using `color-mix` with `var(--color-primary)`.

### Grid Background
```css
background-image:
  linear-gradient(to right, color-mix(in oklch, var(--color-primary) 8%, transparent) 1px, transparent 1px),
  linear-gradient(to bottom, color-mix(in oklch, var(--color-primary) 8%, transparent) 1px, transparent 1px);
background-size: 32px 32px;
```

---

## Editor Components: Complete Inventory

| Component Type | Palette? | Editor? | Config Stored |
|---------------|----------|---------|---------------|
| `rich_text` | ✗ | ✗ | `{ content, format }` |
| `multiple_choice` | ✓ | `MultipleChoiceEditor` | `{ question, options, selectMultiple }` |
| `image_embed` | ✓ | ✗ (preview only) | `{ url, alt }` |
| `video_embed` | ✓ | `VideoEmbedEditor` | `{ url, description }` |
| `text_input` | ✓ | ✗ (preview only) | `{ placeholder, maxLength }` |
| `rating_scale` | ✓ | ✗ (preview only) | `{ min, max, step, labels }` |
| `reflection_journal` | ✗* | ✓ (via legacy mapping) | `{ prompt, minWords }` |
| `file_upload` | ✗ | ✗ | `{ accept, multiple }` |
| `quiz_block` | ✗ | ✗ | `{ timeLimitMinutes, passingScore }` |
| `password_gate` | ✗ | ✗ | `{ password, hint }` |

\* `reflection_journal` is the "Add Mission" default (`addBlankMission`).

---

## Refactor Roadmap

### Phase 1 — Week Navigation (high priority)

1. **Render `WeekCanvas` in `CourseStudioModal`** — wire it into the right
   panel area (or replace the MissionEditor area when no component is selected).
2. **Expose `addWeek`** — add a "+" button in the week nav bar.
3. **Allow week switching** — clicking a week dot sets `selectedWeekId`.
4. **Allow week title/theme editing** — inline inputs in the week nav.

### Phase 2 — Palette Expansion (high priority)

1. **Add `rich_text` to palette** — with default config `{ content: '',
   format: 'markdown' }`.
2. **Add `reflection_journal` to palette** — with `{ prompt: '', minWords: 0 }`.
3. **Add `file_upload` to palette** — with `{ accept: '*', multiple: false }`.
4. **Add `quiz_block` to palette** — with `{ timeLimitMinutes: 0,
   passingScore: 80 }`.
5. **Add `password_gate` to palette** — with `{ password: '', hint: '' }`.

### Phase 3 — Editor for Every Component (medium priority)

Build dedicated editors for components that currently fall through to
read-only preview:

- `RichTextEditor` — rich text / markdown textarea with toolbar
- `ImageEmbedEditor` — URL input + alt text + alignment
- `TextInputEditor` — placeholder + max length
- `RatingScaleEditor` — min/max/step/label configuration
- `FileUploadEditor` — accept types + max size
- `QuizBlockEditor` — time limit + passing score + question list
- `PasswordGateEditor` — password + hint text

Follow the `MultipleChoiceEditor` pattern: receive `{ config, onUpdate }`,
call `onUpdate({ ...config, ...patch })`.

### Phase 4 — CSS Alignment (medium priority)

Adopt /course CSS patterns across the builder:

1. **Replace `.panelCard` box-shadow** — use the soft 2px/8px shadow from
   `/course` reading cards instead of the aggressive `0 6px 0` primary shadow.
2. **Add artwork thumbnails** to `ComponentPanel` task cards — mirror
   `/course` task card layout with accent bar + artwork + title + arrow.
3. **Match border-radius** — all cards should use `14px` (matching /course),
   not `12px`.
4. **Use `color-mix` backgrounds** — everywhere cards appear, use the
   `color-mix(in srgb, var(--color-primary) 7%, #ffffff)` pattern.
5. **Add grid background** — match the `32px` dot-grid from `/course`.
6. **Fix Multiple Choice CSS** — use styled radio/checkbox inputs, remove
   emoji markers, add proper border/background states.

### Phase 5 — Component Palette UI (low priority)

1. **Make palette inline** — remove the bottom drawer toggle; show it as a
   fixed sidebar or floating toolbar.
2. **Group by category** — "Content" (rich_text, image, video), "Input"
   (text_input, rating_scale, file_upload), "Assessment" (multiple_choice,
   quiz_block), "Gate" (password_gate), "Reflection" (reflection_journal).
3. **Show icons** — the palette already has icons; show them larger with
   labels underneath in a grid.

### Phase 6 — 4-Week Course Bridge (low priority)

1. **Default to 4 weeks** — start new courses with 4 blank weeks instead of 1.
2. **Auto-name weeks** — "Week 1: Getting Started", "Week 2: Building
   Knowledge", "Week 3: Putting It Into Practice", "Week 4: Reflection &
   Next Steps".
3. **Template picker** — offer pre-built templates (Blank, Mental Wellness,
   Health & Fitness, Academic, Professional) on course creation.
4. **Week deletion** — allow removing weeks with confirmation.
5. **Week reordering** — drag-and-drop week dots to reorder.

---

## Multiple Choice Editor Fixes

The `MultipleChoiceEditor` and `MultipleChoiceRenderer` need these specific
CSS fixes:

1. **Remove emoji markers** (`◉` `○` `☑` `□`) — replace with styled
   `<input type="radio">` / `<input type="checkbox">` with custom appearance.
2. **Add proper card wrapper** — wrap the question + options in a `div` with
   the /course card styling:
   ```
   background: color-mix(in srgb, var(--color-primary) 7%, #ffffff);
   border: 1px solid color-mix(...);
   border-radius: 14px;
   padding: 14px 16px;
   ```
3. **Stack options vertically** with `gap: 6px` and a left-aligned layout.
4. **Option hover state** — `border-color: var(--color-primary)` with subtle
   tinted background.
5. **Selected state** — primary border + tinted background, matching
   `/course`'s `.readingCardActive` pattern.
6. **Correct/incorrect feedback** — green `#22C55E` / red `#ef4444` borders
   with matching tinted backgrounds (already partially done in the renderer
   CSS).

---

## Key Design Tokens to Use

| Token | Light Value | Dark Value |
|-------|-------------|------------|
| `--color-primary` | `#5168FF` | `#5168FF` |
| `--color-text-dark` | `#1A1B24` | `oklch(93.5% 0.016 285)` |
| `--color-text-muted` | `rgba(26,27,36,0.6)` | `rgba(235,232,247,0.64)` |
| `--color-text-faint` | `rgba(26,27,36,0.42)` | `rgba(235,232,247,0.46)` |
| `--color-surface-base` | `#FFFFFF` | varies |
| `--color-surface-2` | `#F4F5FE` | `rgba(255,255,255,0.04)` |
| `--color-surface-3` | `#E7E8F8` | `rgba(255,255,255,0.08)` |
| `--color-border-subtle` | `rgba(26,27,36,0.08)` | `rgba(255,255,255,0.08)` |
| `--color-border-strong` | `rgba(26,27,36,0.16)` | `rgba(255,255,255,0.16)` |

Card background pattern:
```css
background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface-base));
border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border-subtle));
border-radius: 14px;
box-shadow: 0 2px 8px rgba(26, 29, 51, 0.04);
```

Dark mode card:
```css
:global([data-theme="dark"]) .card {
  background: color-mix(in srgb, var(--color-primary) 10%, #0d0e16);
  border-color: color-mix(in srgb, var(--color-primary) 18%, rgba(255,255,255,0.06));
}
```

---

## File Reference

| File | Purpose |
|------|---------|
| `app/course/page.module.css` | **Primary design reference** — reading cards, week nav, missions heading, task cards, artwork variants, grid background |
| `app/course/page.tsx` | Student-facing course reader with swipe navigation |
| `components/course-studio/CourseStudioModal.tsx` | Main builder orchestrator (798 lines) — week state, drag-and-drop, save |
| `components/course-studio/CourseStudioModal.module.css` | Builder layout styles (732 lines) — needs alignment with /course |
| `components/course-studio/ComponentPalette.tsx` | Drag palette with 5 component types |
| `components/course-studio/ComponentPanel.tsx` | Left sidebar with reading card + mission list |
| `components/course-studio/MissionEditor.tsx` | Component editor router — title + content editing |
| `components/course-studio/WeekCanvas.tsx` | **Unused** — full week WYSIWYG with sortable cards |
| `components/course-studio/MultipleChoiceEditor.tsx` | ✅ Dedicated MC editor |
| `components/course-studio/MultipleChoiceEditor.module.css` | Needs CSS alignment with /course |
| `components/course-renderers/MultipleChoiceRenderer.tsx` | Student-facing MC component |
| `components/course-renderers/MultipleChoiceRenderer.module.css` | Needs styled radio/checkbox, no emoji |
| `components/course-renderers/ComponentRenderer.tsx` | Routes componentType → renderer |
| `lib/vip-course-db.ts` | DB types + CRUD for courses/weeks/components |
| `lib/course-templates.ts` | 4 course templates (Mental Wellness, Health, Fitness, Blank) |
