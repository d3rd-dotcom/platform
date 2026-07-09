# Reformat log — NIMH / MedlinePlus / CDC plain-reformat pass

Date: 2026-07-09
Pass type: mechanical plain-reformat (NOT voice-edited). Follows the approved
`nimh/so-stressed-out.md` pattern: no body headings, plain-language lede,
**bold** section labels, clinical/diagnostic language stripped, crisis lines
kept. Voice rewrite happens later.

## Files produced (20)

### NIMH (content/guide-drafts/nimh/)
- `anxiety-disorders.md` — Dropped "anxiety disorder" framing, NIMH-research/funding
  paragraphs, and the "types of anxiety disorders" diagnostic list (reframed as
  "common forms it takes"). Kept 988 crisis line.
- `attention-deficit-hyperactivity-disorder.md` — Dropped "developmental disorder"
  diagnostic framing and the "diagnosed in children / co-occurs" clinical passages;
  reframed treatments as "what can help" (removed medication/psychosocial-intervention
  clinical detail). No crisis-line content in source; none added.
- `caring-for-your-mental-health.md` — Dropped "mental illness / treatment and recovery"
  clinical framing and the "psychologist, psychiatrist, clinical social worker" referral
  detail (kept generic "health care provider"). Kept the 2-week symptom watch-list and
  988 crisis line.
- `coping-with-traumatic-events.md` — Dropped PTSD diagnosis language and the
  "personal/family history of mental illness or substance use" risk paragraph; kept the
  reactions/signs lists as educational, not diagnostic. Kept 988 line + SAMHSA Disaster
  Distress Helpline.
- `depression.md` — Dropped "major depressive disorder / clinical depression / illness"
  labels, the NIMH-research and "treatment-resistant depression / medications / brain
  stimulation" clinical detail. Kept 988 crisis line.
- `my-mental-health-do-i-need-help.md` — Source is close to a self-screening checklist;
  softened the two symptom lists from a diagnostic instrument into general
  "how you're feeling" prompts, dropped "common treatment options include therapy and
  medication." Kept 988 crisis line (source's core safety content).

### MedlinePlus (content/guide-drafts/medlineplus/)
- `adhd.md` — Heavily trimmed. Dropped the entire "How is ADHD diagnosed" section
  (DSM-style criteria: symptom counts, age-12 onset, 6-month duration, settings test —
  a diagnostic instrument) and medication/psychotherapy clinical detail. Kept type
  descriptions and lifestyle/school supports. No crisis line in source.
- `anxiety.md` — Dropped "anxiety disorders" diagnostic framing, the diagnosis section
  (psychological evaluation, lab tests) and medication classes (anti-anxiety meds,
  antidepressants). Kept CBT/ACT described plainly. No crisis line in source.
- `coping-with-chronic-illness.md` — Light reformat; source is short and non-clinical.
  Nothing diagnostic to strip. No crisis line in source.
- `depression.md` — Dropped the "types of depression" diagnostic taxonomy (major
  depression, persistent depressive disorder/dysthymia, SAD, bipolar, depression with
  psychosis), the "How is depression diagnosed" section (2-week most-of-the-day criteria,
  medical tests, mental-health evaluation), and the medication/ECT/rTMS treatment detail.
  Kept the symptom list as educational and kept the 911 crisis instruction.
- `healthy-sleep.md` — Non-clinical; trimmed the full age table down to teen/adult rows
  (ICP-relevant) and condensed health-effects lists. No crisis line in source.
- `how-to-improve-mental-health.md` — Non-diagnostic self-help content; condensed the long
  nested lists (meditation, relaxation techniques). No crisis line in source.
- `mood-disorders.md` — Very short source. Dropped "depression and bipolar disorder / manic
  depression" diagnostic naming and "medication, psychotherapy" clinical list (reframed as
  "what can help"). No crisis line in source.
- `stress.md` — Dropped PTSD naming; kept the 2-week symptom watch-list and the
  suicide/crisis escalation. Added 988 line explicitly (source referenced "get help right
  away" for suicidal thoughts but named no line — 988 is the standard safety resource, so
  preserved as a safety reference, not a diagnostic claim).
- `teen-mental-health.md` — Softened the warning-signs list from screening language toward
  "signs it may be time to reach out." Source names no crisis line; kept its
  "talk to parents / school counselor / provider" guidance.

### CDC (content/guide-drafts/cdc/)
- `about-mental-health.md` — Dropped the "Mental health conditions" section (prevalence
  stats, named disorders, DSM reference, "diagnosed condition") and the CDC-org/public-health
  program passages. Kept the risk/protective factors framing as educational. No crisis line
  in source; pointed to its resource list generically.
- `about-sleep.md` — Non-clinical; trimmed the full age table to teen/adult rows and dropped
  the "What CDC is doing" surveillance section. Kept sleep-disorder mention as a
  "see a provider" prompt, not a diagnosis. No crisis line in source.
- `managing-stress.md` — Non-diagnostic self-help; condensed. Dropped "mental health
  conditions" clinical phrasing and CDC resource-link list. No crisis line in source.
- `physical-activity-benefits.md` — Non-clinical; heavily trimmed the long
  disease-risk/statistics body to the ICP-relevant benefits. Softened "depression and
  anxiety" to "low mood and anxiety." No crisis line in source.
- `social-connectedness.md` — Non-clinical; condensed. Softened "depression and anxiety" to
  "low mood or anxiety." No crisis line in source.

## Topic overlaps flagged for the later consolidation decision

Multiple source files cover the same subject. Per instructions these were kept as
separate drafts; flagging here so the user can decide later whether to merge:

- **Depression** — nimh/depression.md, medlineplus/depression.md (also touched by
  medlineplus/mood-disorders.md).
- **Anxiety** — nimh/anxiety-disorders.md, medlineplus/anxiety.md.
- **ADHD / Focus** — nimh/attention-deficit-hyperactivity-disorder.md,
  medlineplus/adhd.md.
- **Stress** — nimh/so-stressed-out.md (the template), medlineplus/stress.md,
  cdc/managing-stress.md. Three sources on one topic.
- **Sleep** — medlineplus/healthy-sleep.md, cdc/about-sleep.md.
- **Mental-health foundations / general self-care** — medlineplus/how-to-improve-mental-health.md,
  medlineplus/teen-mental-health.md, cdc/about-mental-health.md, and nimh/caring-for-your-mental-health.md
  overlap on the "ways to care for your mental health" self-care list.
- **Emotional regulation** — medlineplus/mood-disorders.md and cdc/social-connectedness.md
  both carry the "Emotional Regulation" source topic tag but cover different subjects
  (mood disorders vs. social connection); likely should NOT be merged despite the shared tag.

## Notes
- Crisis lines preserved wherever the source had one (988 and/or 911, SAMHSA Disaster
  Distress Helpline). Where a source had no crisis content, none was invented — the one
  exception is medlineplus/stress.md, where the source already escalated suicidal thoughts
  to "get help right away" and 988 was added as the standard safety line.
- All 20 outputs use the template header with
  `draft_stage: plain-reformat (not voice-edited; approved pattern 2026-07-09)` and copied
  source/source_url/topic from the originals.

## Post-batch correction (2026-07-09)
Two files still read as self-screening instruments after the initial pass and were
tightened further per user review:
- `nimh/my-mental-health-do-i-need-help.md` — dropped the "<2 weeks vs. 2+ weeks" symptom
  split (that duration threshold is literally the DSM depression diagnostic criterion);
  merged into one general "signs you might be running low" list.
- `medlineplus/adhd.md` — dropped "The three types" section (the clinical ADHD subtypes:
  inattentive / hyperactive-impulsive / combined); kept "What it can look like" and
  "What can help."
