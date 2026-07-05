# Landing Scroll Script — Cinematic Pass

The landing page is scripted as a 60-second scroll film. Lenis supplies the dolly
(smooth, weighted scroll); GSAP ScrollTrigger cues every beat. Each act has a
color tint that washes the whole viewport via the cinematic overlay layer.

## The feeling, second by second

**Second 0–3 — Arrival.**
The visitor lands mid-air. The hero sting (5s loop: an ascent through indigo
clouds toward a floating glass academy) plays behind the headline while the
glitch-reveal spells "Mental Wealth Academy". No motion demands anything of
them yet — the page breathes. Feeling: *calm awe. "I've stepped somewhere
else."*

**Second 3–10 — First pull.**
The first scroll input meets Lenis resistance — weighted, expensive-feeling.
The hero content parallaxes up and away slightly slower than the scroll,
the vignette deepens, and the first act tint (indigo) fades in. Feeling:
*the page is responding to me, not just moving.*

**Second 15 — The promise (Act I · Simulate).**
B-roll band one: branching luminous paths forming worlds. The three feature
cards rise as glass panels, staggered, each catching light. Copy beats:
Simulate your world → B.L.U.E. designs your quests → become a researcher.
Feeling: *curiosity hardening into agency. "I could actually do this."*

**Second 25 — The world (Act II · Ecosystem).**
Tint shifts indigo → teal (#44E990 accents). B-roll band two: orbital glass
structures, a living network. Ecosystem section reveals with a slow
scale-settle. Feeling: *scale. This is a place, not a product.*

**Second 40 — The people (Act III · Belonging).**
Tint warms (amber #FF7729 wash at 6–8%). B-roll band three: light through a
library atrium, drifting pages. Founder, testimonials, key figures — human
proof. Cards reveal one-by-one at reading pace; scroll pacing loosens here
(sections get taller, triggers scrub slower). Feeling: *trust. "These are my
people."*

**Second 55–60 — The invitation (Act IV · Ascend).**
Tint returns to indigo, brighter. B-roll band four: sunrise breaking over a
cloud sea, light ascending. Cohort section, then the final CTA pinned briefly
— the only pin on the page, a held breath before the button. Feeling:
*resolve. Enter the academy.*

## Motion assets

| Asset | Placement | Prompt theme |
|---|---|---|
| `hero-sting.mp4` | Hero background | ascent through indigo clouds to floating glass academy |
| `broll-simulate.mp4` | Act I band | branching luminous simulation paths forming worlds |
| `broll-ecosystem.mp4` | Act II band | orbital glass structures, teal network of light |
| `broll-belonging.mp4` | Act III band | warm light through library atrium, drifting pages |
| `broll-ascend.mp4` | Act IV band | sunrise over cloud sea, ascending light |

All 5s, 1080p, muted, autoplay-on-visible, `playsinline`, poster frames for
mobile-data fallback. No text, no faces in any clip.

## Craft rules

- Film grain (animated SVG noise), vignette, and act tints live in one fixed
  `CinematicLayer`; sections never own their own overlays.
- Particles: sparse drifting motes on canvas, capped at 40, paused off-screen.
- Everything respects `prefers-reduced-motion`: Lenis off, triggers become
  simple fades, videos show posters.
- Reveals use `power3.out`, 0.9–1.2s, 60–90px travel, 0.08–0.12s stagger.
- One pin maximum (final CTA). Scrub only on tints/parallax, never on reveals.
