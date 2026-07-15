# Mental Wealth Academy — Typographic System

> Source of truth: [`styles/typography.css`](../../styles/typography.css), imported at the top of
> [`styles/globals.css`](../../styles/globals.css). Color has one runtime source of truth:
> [`styles/color-system.css`](../../styles/color-system.css).

The tone is **calm and editorial meets modern, tech-forward** — academic, highly readable,
with a beautiful fluid scale. Fonts are self-hosted via `next/font` in `app/layout.tsx`,
exposed as CSS variables (`--font-commit-mono`, `--font-space-grotesk`,
`--font-patrick-hand`). No external Google Fonts `<link>`.

---

## 1. Typeface pairing

| Role | Face | Variable | Rationale |
| --- | --- | --- | --- |
| Display / headings / labels | **Space Grotesk** | `--type-font-heading` / `--type-font-display` / `--type-font-label` | A geometric grotesque with subtle personality (distinctive digits, open apertures). Gives headings and UI labels a modern, tech-forward voice while staying legible at small sizes and in uppercase. |
| Body / long-form / inputs | **Commit Mono** | `--type-font-body` | A precise monospaced face with open forms and clear punctuation. It gives course copy and inputs a consistent technical rhythm. |
| Code / mono badges / IDs | **Space Grotesk** (tabular) | `--type-font-code` | Reused as the "mono-feeling" face for slugs, block IDs and counters with `tabular-nums`, keeping the palette tight rather than adding a fourth family. |
| Accent / annotation | **Patrick Hand** | `--type-font-accent` | Hand-drawn accent, used **only where already present** (field-notes / doodle flourishes). Never a primary UI face. |

**Pairing logic:** Space Grotesk (display) over Commit Mono (text) pairs broad,
characterful headings with a precise technical reading texture. The heading face
adds identity while the body face creates a consistent academic rhythm.

**Banned as primary faces:** Arial, Helvetica, Times New Roman, and bare
system-default stacks. Generic families only ever appear as the *tail* of a
fallback stack (e.g. `…, ui-sans-serif, sans-serif`).

---

## 2. Fluid type scale

Base is **16px**. Every step is fluid via `clamp(min, preferred, max)` so type
scales smoothly between mobile and desktop without breakpoints. Each step is
exposed as a size / line-height / tracking triple **and** a matching utility class
(`.type-display`, `.type-h1`, … `.type-code`).

| Step | `clamp()` value | px range | Line-height | Tracking | Face | Usage |
| --- | --- | --- | --- | --- | --- | --- |
| **display** | `clamp(2rem, 1.4rem + 2.2vw, 3.2rem)` | 32 → 51 | 1.2 | −0.02em | Space Grotesk | Hero / preview-stage headline, profile avatar initials |
| **h1** | `clamp(1.625rem, 1.28rem + 1.5vw, 2.375rem)` | 26 → 38 | 1.2 | −0.02em | Space Grotesk | Page / section titles |
| **h2** | `clamp(1.375rem, 1.19rem + 0.9vw, 1.75rem)` | 22 → 28 | 1.2 | −0.015em | Space Grotesk | Week titles, studio title input, rich-text `h1` |
| **h3** | `clamp(1.1875rem, 1.09rem + 0.5vw, 1.375rem)` | 19 → 22 | 1.3 | −0.015em | Space Grotesk | Reader theme, publish-form title, rich-text `h2` |
| **h4** | `clamp(1rem, 0.95rem + 0.25vw, 1.125rem)` | 16 → 18 | 1.3 | −0.015em | Space Grotesk | Card titles, task/mission/reading titles, question inputs |
| **body-lg** | `clamp(1rem, 0.96rem + 0.2vw, 1.0625rem)` | 16 → 17 | 1.6 | 0 | Commit Mono | Long-form reading surfaces, rich-text body, instructions |
| **body** | `clamp(0.875rem, 0.85rem + 0.12vw, 0.9375rem)` | 14 → 15 | 1.6 | 0 | Commit Mono | Default UI copy, inputs, options |
| **body-sm** | `clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)` | 13 → 14 | 1.6 | 0 | Commit Mono | Secondary copy, compact inputs, hints, buttons |
| **label** | `clamp(0.6875rem, 0.66rem + 0.1vw, 0.75rem)` | 11 → 12 | 1 | +0.03em | Space Grotesk | Small sentence-case labels, badges, kickers, palette item labels |
| **caption** | `clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem)` | 12 → 13 | 1.4 | 0 | Commit Mono | Fine print, meta, captions, counters |
| **code** | `clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)` | 13 → 14 | 1.55 | 0 | Space Grotesk | Slugs, inline `code`, block IDs (`tabular-nums`) |

Utility classes apply family + size + line-height + tracking + a sensible default
weight. Individual triple variables (e.g. `--type-h4-size`, `--type-h4-lh`,
`--type-h4-track`) are consumed directly inside CSS-module classes so component
selectors keep their own colours and box styles while inheriting the scale.

---

## 3. Hierarchy, weight & spacing

- **Weights:** regular 400, medium 500, semibold 600, bold 700
  (`--type-weight-*`). Display/H1/H2 default to bold; H3/H4 to semibold; body to
  regular; labels to semibold.
- **Line-height:** body copy `1.6` (`--type-lh-body`); headings `1.2`
  (`--type-lh-heading`); compact card titles `1.3` (`--type-lh-snug`);
  single-line badges/labels `1` (`--type-lh-solid`).
  > Exception: `FieldNotesSheet .noteBody` keeps `line-height: 28px` because it is
  > locked to the ruled-paper background lines — a layout constraint, not free type.
- **Tracking:** `−0.02em` on large headings (display/h1), `−0.015em` on mid
  headings, `+0.03em` on small sentence-case labels, `+0.05em`
  (`--type-track-label-lg`) on the tightest micro-labels (week badges,
  section kickers).
- **Spacing rhythm:** margins/padding follow a **4px-based scale**. Flow headings
  use a consistent ratio — **`1.5em` above, `0.5em` below**
  (`--type-heading-margin-top` / `--type-heading-margin-bottom`), applied to the
  rich-text and reader heading selectors and available via `.type-heading-rhythm`.

---

## 4. Colour contrast (WCAG AA)

AA requires **4.5:1** for normal text and **3:1** for large text (≥ 24px, or
≥ 18.66px bold). Ratios below are computed against the dark surfaces
`#090A10` / `#11131B` / `#171A24` and white. Semi-transparent text tokens are
evaluated composited over the opaque surface.

| Text colour | on `#090A10` | on `#11131B` | on `#171A24` | on `#FFFFFF` | Verdict |
| --- | --- | --- | --- | --- | --- |
| Dark-mode heading/body `#f0f1fa` (a.k.a. `--color-text-dark`) | 17.6 | 16.5 | 15.4 | — | ✅ AA/AAA |
| Dark-mode `--color-text-soft` (.78) | 10.0 | 9.6 | 9.2 | — | ✅ AA/AAA |
| Dark-mode `--color-text-muted` (.64) | 7.0 | 6.8 | 6.6 | — | ✅ AA/AAA |
| Dark-mode `--color-text-faint` (.46) | 4.05 | 4.07 | 4.04 | — | ✅ large text (3:1); placeholder/meta only |
| Light `--color-text-dark` `#1A1B24` | — | — | — | 16.13 on `#F6F8FE` | ✅ AA/AAA |
| Light `--color-text-muted` (.64) | — | — | — | 5.01 on `#F6F8FE` | ✅ AA (normal) |
| Accent link/title `#8f9bff` (dark) | 7.8 | 7.3 | 6.9 | 2.5 | ✅ on dark; not used as text on white |
| Action Blue `#465BE0` (control text/fill) | — | — | — | 5.48 | ✅ AA for normal text |

**Notes**
- Uppercase styling and bold weight do not make 11–13px labels large text. Every
  label-sized foreground/background pair must meet the normal-text threshold of
  4.5:1. Academy Blue remains the brand swatch; Action Blue is the accessible
  interactive shade for small text and filled controls.
- `--color-text-faint` (~4:1) is intentionally reserved for placeholders,
  disabled states and decorative meta — never for primary reading content.

### Colour changes made to pass AA
Action Blue was introduced for normal-size control text and filled controls.
Automated contrast tests now protect the semantic foreground/background pairs.

---

## 5. How to use

```css
/* Preferred inside CSS modules: consume the triple so you keep your own colour/box */
.cardTitle {
  font-family: var(--type-font-heading);
  font-size: var(--type-h4-size);
  line-height: var(--type-h4-lh);
  letter-spacing: var(--type-h4-track);
  font-weight: var(--type-weight-semibold);
}
```

```html
<!-- Or drop a utility class for a complete style -->
<p class="type-body-lg">Long-form course copy…</p>
<span class="type-label">MODULE 3</span>
```
