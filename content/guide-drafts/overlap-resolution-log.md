# Overlap resolution (2026-07-09)

Per user decision: pick the best draft per overlapping topic, drop the rest.
Also replaced all US-specific crisis-line references (988, 911, SAMHSA) across
every draft with generic, locale-neutral guidance ("contact a local crisis
line or emergency service") — MWA's audience isn't US-only.

## Resolved

| Topic | Kept | Dropped | Why |
|---|---|---|---|
| Focus / ADHD | `medlineplus/adhd.md` | `nimh/attention-deficit-hyperactivity-disorder.md` | MedlinePlus version normalizes better ("it's normal to sometimes have trouble focusing"), has more concrete everyday-behavior detail, less treatment-forward |
| Stress | `cdc/managing-stress.md` | `nimh/so-stressed-out.md`, `medlineplus/stress.md` | CDC version is the most actionable — concrete numbers (7+ hrs sleep, 2.5 hrs/week movement), non-clinical self-care framing |
| Sleep | `medlineplus/healthy-sleep.md` | `cdc/about-sleep.md` | MedlinePlus version is more complete — explains sleep mechanism, covers shift-work, more practice tips |
| Mental-wealth foundations | `medlineplus/how-to-improve-mental-health.md` | `cdc/about-mental-health.md`, `medlineplus/teen-mental-health.md` | MedlinePlus version is action-oriented (concrete self-care practices) matching the existing guide DAG's style; CDC version leaned sociological (risk/protective factors) and closed by pointing to CDC's own resource directory, awkward for our app; teen-mental-health.md is audience-mismatched (MWA's core audience is 21-28, not teens) |
| Depression | `medlineplus/depression.md` | `nimh/depression.md` | MedlinePlus version has richer, more grounded content — symptom variance by demographic, concrete symptom list |
| Anxiety | `medlineplus/anxiety.md` | `nimh/anxiety-disorders.md` | MedlinePlus version normalizes anxiety better (small doses can help focus), has risk factors and concrete symptoms NIMH's version lacked |

## Kept as separate (not true duplicates despite shared tag)

- `nimh/caring-for-your-mental-health.md` (tagged "Emotional regulation techniques") vs.
  `medlineplus/how-to-improve-mental-health.md` (tagged "Mental-wealth foundations") — different
  angle: self-care habits vs. foundational definition + why-it-matters.
- `nimh/coping-with-traumatic-events.md` vs. `nimh/my-mental-health-do-i-need-help.md` — both
  tagged "Coping skills / resilience" but cover different subjects (trauma-specific coping vs.
  a general self-check-in).
- `medlineplus/mood-disorders.md` vs. `cdc/social-connectedness.md` — both tagged "Emotional
  Regulation" but cover different subjects (mood disorders vs. social connection).

## Result

25 drafts remain (down from 33): NIMH 3, MedlinePlus 7, CDC 3, OpenStax Psychology 7, MIT OCW 5.
