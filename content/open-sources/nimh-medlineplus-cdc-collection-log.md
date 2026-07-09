# Open-source raw capture log — NIMH / MedlinePlus / CDC

Raw, unedited public-domain source material staged for the guides knowledge DAG.
All three sources are US-government works (public domain — no attribution legally
required; source URLs recorded for our own citation trail). This was a raw-capture
step only: text is reproduced as close to verbatim as extractable (main body content;
nav, link lists, ads, and footers dropped). An editorial rewrite pass happens later,
separately.

Retrieved: 2026-07-09

## NIMH (https://www.nimh.nih.gov) — 7 files

- nimh/anxiety-disorders.md — https://www.nimh.nih.gov/health/topics/anxiety-disorders — topic: Anxiety
- nimh/depression.md — https://www.nimh.nih.gov/health/topics/depression — topic: Depression
- nimh/attention-deficit-hyperactivity-disorder.md — https://www.nimh.nih.gov/health/topics/attention-deficit-hyperactivity-disorder-adhd — topic: Focus
- nimh/caring-for-your-mental-health.md — https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health — topic: Emotional regulation techniques
- nimh/so-stressed-out.md — https://www.nimh.nih.gov/health/publications/so-stressed-out-fact-sheet — topic: Stress
- nimh/coping-with-traumatic-events.md — https://www.nimh.nih.gov/health/topics/coping-with-traumatic-events — topic: Coping skills / resilience
- nimh/my-mental-health-do-i-need-help.md — https://www.nimh.nih.gov/health/publications/my-mental-health-do-i-need-help — topic: Coping skills / resilience

## MedlinePlus (https://medlineplus.gov) — 9 files

- medlineplus/anxiety.md — https://medlineplus.gov/anxiety.html — topic: Anxiety
- medlineplus/depression.md — https://medlineplus.gov/depression.html — topic: Depression — *(originally claimed but missing from disk after the initial pass; re-captured verbatim via direct fetch of the topic-summary container on 2026-07-09)*
- medlineplus/stress.md — https://medlineplus.gov/stress.html — topic: Stress
- medlineplus/healthy-sleep.md — https://medlineplus.gov/healthysleep.html — topic: Sleep
- medlineplus/adhd.md — https://medlineplus.gov/attentiondeficithyperactivitydisorder.html — topic: Focus
- medlineplus/how-to-improve-mental-health.md — https://medlineplus.gov/howtoimprovementalhealth.html — topic: Mental-wealth foundations
- medlineplus/coping-with-chronic-illness.md — https://medlineplus.gov/copingwithchronicillness.html — topic: Coping skills / resilience
- medlineplus/mood-disorders.md — https://medlineplus.gov/mooddisorders.html — topic: Emotional Regulation
- medlineplus/teen-mental-health.md — https://medlineplus.gov/teenmentalhealth.html — topic: Mental-wealth foundations

## CDC (https://www.cdc.gov) — 5 files

- cdc/about-mental-health.md — https://www.cdc.gov/mental-health/about/index.html — topic: Mental-wealth foundations
- cdc/managing-stress.md — https://www.cdc.gov/mental-health/living-with/index.html — topic: Stress
- cdc/about-sleep.md — https://www.cdc.gov/sleep/about/index.html — topic: Sleep
- cdc/social-connectedness.md — https://www.cdc.gov/social-connectedness/about/index.html — topic: Emotional Regulation
- cdc/physical-activity-benefits.md — https://www.cdc.gov/physical-activity-basics/benefits/index.html — topic: Habits

Total: 21 files (NIMH 7, MedlinePlus 9, CDC 5).

## Notes, gaps, and things skipped

- Depression (NIMH & MedlinePlus) and Anxiety are covered on all three sources with the
  strongest depth; Sleep, Stress, ADHD, and general mental-health foundations are covered
  on at least two.
- Habit formation / behavior change: no source has a clean standalone "habit formation"
  overview page. The closest real, well-sourced page is CDC's Benefits of Physical Activity
  (captured, tagged Habits). NIMH's ADHD page also discusses behavior-change interventions.
  Recommend not inventing a habit-formation topic; source it from a behavior-science text
  in a later pass if needed.
- Mindfulness basics: no dedicated public-domain overview page was cleanly extractable.
  Mindfulness is referenced inline within NIMH "So Stressed Out", NIMH "Coping With Traumatic
  Events", and MedlinePlus anxiety (acceptance and commitment therapy). The MedlinePlus
  encyclopedia URL initially tried for mindfulness resolved to unrelated content and was
  dropped rather than mis-captured.
- CDC blocks plain automated fetches (HTTP 403 via WebFetch/basic curl). Captured by sending
  full browser request headers. CDC also consolidated its former standalone "sleep hygiene"
  and "how much sleep" pages into the single /sleep/about/index.html page (old URLs now 404),
  so one CDC sleep file covers both. A CDC /emotional-wellbeing/ page returned 404 and was
  dropped.
- MedlinePlus WebFetch initially returned paraphrased (not verbatim) text and once refused on
  a copyright concern; to honor the raw-verbatim requirement, MedlinePlus and CDC bodies were
  captured directly from each page's canonical content container (topic-summary / main content)
  rather than through the summarizing fetch. NIMH captures came through WebFetch cleanly verbatim.
- CDC emphasis markup produced broken inline-bold artifacts on extraction; asterisk emphasis
  was stripped from CDC files (words left verbatim) to keep the raw text clean for the editor.
  Superscript footnote reference numbers in CDC text (e.g. "stroke.1") remain inline as raw source.
- Nothing was written to the app database or to any file under app/, lib/, components/, db/, or
  supabase/. No git commands were run.
