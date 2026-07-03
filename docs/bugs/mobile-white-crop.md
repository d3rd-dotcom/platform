# Mobile: persistent white crop at bottom of blue scene

## Behaviour

On phones (≤768px viewport), a fixed white/off-white rectangle is visible
covering the bottom portion of the blue scene. It:

- Is fixed — same size and position regardless of scroll
- Sits **under** the field-notes card (lower z-index) but **over** the
  blue scene (covers the scene footer, garden-shader canvas, and bgImage)
- Extends across the full viewport width
- Is roughly the height of the mobile-bottom-nav + field-notes-shell area

## Layout context (mobile, ≤768px)

```
┌──────────────────────────────┐
│  blueSceneWrap              │  ← height: 100dvh; flex: none
│  ┌────────────────────────┐ │
│  │ .scene                │ │  ← flex: 1; min-height: 100dvh;
│  │  (bgImage + garden)   │ │     box-sizing: border-box;
│  │  sceneFooter (static) │ │     display: flex; flex-direction: column
│  └────────────────────────┘ │
├──────────────────────────────┤
│  sidebarWrap                │  ← visible after scrolling
│  ┌────────────────────────┐ │
│  │ leaderboard card       │ │
│  │ angel card             │ │
│  └────────────────────────┘ │
└──────────────────────────────┘

Fixed elements (always on screen):
  fieldNotesShell: z-index 1002, bottom: calc(mobile-nav-h + 10px)
  MobileBottomNav:  z-index 1000, bottom: 0

MobileBottomNav background: rgba(251, 248, 255, 0.92)  — off-white
```

## Suspects

### 1. MobileBottomNav (`z-index: 1000`)
- `background: rgba(251, 248, 255, 0.92)` — nearly opaque off-white
- Fixed at `bottom: 0`, covers full width, ~94–110 px tall
- Z-index 1000 is **above** the blue scene (auto z-index) but **below**
  fieldNotesShell (1002)
- This is the most likely source of the visible white area

### 2. Field notes shell (fieldNotesShell)
- Currently has no background (was tried and removed)
- Padding areas (bottom 10px, sides 12 px) are transparent — show scene
  through

### 3. Scene footer (`sceneFooter`)
- At 768px: `position: static; margin-top: auto`
- Background: `color-mix(in oklch, var(--color-primary) 8%, var(--color-surface-1))`
  → nearly white on light theme (~92% white)
- Sits at the bottom of the flex column inside the scene

### ~~4. FieldNotesGradient~~ (removed / set to 24px)
- Currently 24 px tall, starts 24 px above shell top, z-index within shell
- Too small to cause the reported issue

## Attempted fixes (all failed)

| # | What | File | Result |
|---|------|------|--------|
| 1 | Added `display: flex; flex-direction: column` to scene at 1024px | BlueScene.module.css | Broke tablet layout |
| 2 | Made sceneFooter `position: static; margin-top: auto` at 1024px | BlueScene.module.css | Moved to 768px |
| 3 | Set footerCounters `position: absolute; top: 14px; left: 66px` | BlueScene.module.css | Positioning context wrong (relative to absolute footer) |
| 4 | Same but at 768px only with footer `position: static` | BlueScene.module.css | Fixed badge position |
| 5 | Removed `min-height: 520px` from scene at 1024px | BlueScene.module.css | Tablet collapsed |
| 6 | Added `min-height: 100dvh` to scene at 768px | BlueScene.module.css | User wanted this |
| 7 | Set blueSceneWrap `height: 100dvh; flex: none` at 768px | Dashboard.module.css | Part of viewport-height fix |
| 8 | Increased dashboard gap 20→28px at 768px | Dashboard.module.css | More breathing room |
| 9 | Added gradient overlay `top: -40px; height: 60px; z-index: 2` | Dashboard.module.css | Covered scene (white at z-index 1002 above scene) |
| 10 | Moved `isolation: isolate` to base fieldNotesShell | Dashboard.module.css | Needed for tablet stacking |
| 11 | Changed gradient to `top: -60px; height: 60px` | Dashboard.module.css | Still over scene, gradient didn't cover CTA but opaque end did |
| 12 | Made sceneFooter `background: transparent` on mobile | BlueScene.module.css | Reverted per user — wasn't the issue |
| 13 | Added `background` to fieldNotesShell on mobile | Dashboard.module.css | Added another white area |
| 14 | Changed gradient to `top: -24px; height: 24px` | Dashboard.module.css | Still over scene |
| 15 | Set gradient `display: none` | Dashboard.module.css | White persisted — source was elsewhere |
| 16 | Restored gradient as 24px (user asked) | Dashboard.module.css | Current state |
| 17 | Removed fieldNotesShell background | Dashboard.module.css | Current state |
| 18 | Added `box-sizing: border-box` to scene at 768px | BlueScene.module.css | Prevents 4px border overflow, white persisted |
| 19 | Restored `min-height: 520px` at 1024px | BlueScene.module.css | Fixed tablet collapse |

## Still in play

- **MobileBottomNav** (`rgba(251, 248, 255, 0.92)` at z-index 1000) — never
  been modified. Its off-white background covers the bottom 94–110 px of the
  viewport, which overlaps the bottom of the blue scene (100dvh extends
  behind it).
- The blue scene at `min-height: 100dvh` fills the full viewport, so its
  bottom portion is naturally covered by the fixed bottom elements.

## Hypothesis

The "white crop" is the **MobileBottomNav** bar. The blue scene is `100dvh`
tall (fills the viewport). The mobile nav sits at the bottom (z-index 1000)
with an off-white background `rgba(251, 248, 255, 0.92)`. Since the scene
extends the full viewport height, its bottom ~94 px are behind the nav bar.
The nav's nearly-opaque white background creates the visible crop.

## Possible remaining fixes (untried)

1. **Reduce scene height** to `calc(100dvh - var(--mobile-nav-height))` so
   the scene ends above the nav bar
2. **Make MobileBottomNav transparent** (change `background` to `transparent`
   or lower opacity) so the scene shows through
3. **Remove `100dvh` from scene** entirely — let it size naturally (the
   user originally asked for full viewport, but may reconsider given this
   side-effect)
4. **Clip the scene** with `overflow: hidden` on blueSceneWrap and reduce
   its height to avoid the nav overlap
