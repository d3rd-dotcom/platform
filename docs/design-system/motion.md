# Motion

Canonical tokens live in [`styles/globals.css`](../../styles/globals.css) (`:root`, "Animation Tokens" block)
and are re-exported for TS/TSX via [`styles/design-tokens.ts`](../../styles/design-tokens.ts) (`durations`, `easings`, `transitions`).
Use those tokens — don't hardcode raw `cubic-bezier()`/`ms` values in new code.

## Rules

1. Never leave `transition-timing-function` at its implicit default (`ease`) or at `linear`. Always name a curve.
2. Exception: continuous, constant-speed loops — marquees, ticker scrolls, spinners — are correctly `linear`. Use `--ease-linear` there and nowhere else.
3. Curve by direction:
   - Entering (fading/sliding into the viewport or DOM): `--ease-out` — fast start, soft landing.
   - Leaving (fading/sliding out, dismissing): `--ease-in` — soft start, fast exit.
   - Moving in place (hover, toggle, drag-settle, tab switch): `--ease-default` (`cubic-bezier(.4, 0, .2, 1)`).
4. Durations for interface transitions stay in the `--duration-fast` (150ms) to `--duration-slow` (300ms) range.
   - `--duration-instant` (50ms) is for near-imperceptible feedback only (e.g. an opacity nudge under the cursor).
   - `--duration-slower` (500ms) is reserved for large, rare, non-interface reveals (full-screen modals, page transitions) — not everyday UI moves.

## CSS usage

```css
.card {
  transition: transform var(--duration-normal) var(--ease-default);
}

.modalEnter {
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modalExit {
  transition: opacity var(--duration-fast) var(--ease-in);
}

.spinner {
  animation: spin 0.8s var(--ease-linear) infinite; /* continuous loop: linear is correct here */
}
```

## TS/TSX usage

```ts
import { durations, easings, transitions } from '@/styles/design-tokens';

element.style.transition = `transform ${durations.normal} ${easings.default}`;
```

`transitions.fast` / `.normal` / `.slow` / `.bounce` / `.spring` are ready-made `all <duration> <easing>` presets for the common cases.
