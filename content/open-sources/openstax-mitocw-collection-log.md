# Collection log — OpenStax Psychology 2e + MIT OpenCourseWare (2026-07-09)

Raw capture pass for the guides knowledge DAG. Nothing here has been written to the app database or touched anything under `app/`, `lib/`, `components/`, `db/`, or `supabase/`. No paraphrasing was done at collection time — see each file's header for exact source URL, license, and retrieval date.

## OpenStax Psychology 2e (`openstax-psychology/`) — CC BY 4.0

Base book: https://openstax.org/details/books/psychology-2e — chapter/section pages live at `https://openstax.org/books/psychology-2e/pages/<slug>`.

| File | Source URL | Notes |
|---|---|---|
| `ch04-states-of-consciousness.md` | https://openstax.org/books/psychology-2e/pages/4-introduction | Full chapter outline + section 4.1 (What Is Consciousness?) captured verbatim/near-verbatim. Sections 4.2-4.6 (sleep stages, sleep disorders, substance use, other altered states) NOT individually fetched — only outline titles + URLs recorded. |
| `ch06-learning.md` | https://openstax.org/books/psychology-2e/pages/6-introduction | Full chapter outline + section 6.3 (Operant Conditioning) captured — highest-value section for a future "Habits" topic. Sections 6.1, 6.2, 6.4 NOT individually fetched. |
| `ch07-thinking-and-intelligence.md` | https://openstax.org/books/psychology-2e/pages/7-introduction | Full chapter outline + section 7.1 (What Is Cognition?) captured. Sections 7.2-7.6 (language, problem solving, intelligence/creativity, IQ measures, source of intelligence) NOT individually fetched. |
| `ch08-memory.md` | https://openstax.org/books/psychology-2e/pages/8-introduction | Full chapter outline + section 8.4 (Ways to Enhance Memory) captured. Sections 8.1-8.3 NOT individually fetched. |
| `ch10-motivation-and-emotion.md` | https://openstax.org/books/psychology-2e/pages/10-introduction | Full chapter outline + section 10.4 (Emotion) captured — directly relevant to Emotional Regulation subject. Sections 10.1-10.3 (motivation, hunger/eating, sexuality/gender) NOT individually fetched. |
| `ch11-personality.md` | https://openstax.org/books/psychology-2e/pages/11-introduction | Full chapter outline + section 11.1 (What Is Personality?) captured. Sections 11.2-11.9 (Freud, neo-Freudians, learning/humanistic/biological approaches, trait theory, culture, assessment) NOT individually fetched. |
| `ch14-stress-lifestyle-and-health.md` | https://openstax.org/books/psychology-2e/pages/14-introduction | Full chapter outline + section 14.4 (Regulation of Stress) captured — directly relevant to a future Stress/Coping subject. Sections 14.1-14.3, 14.5 (what is stress, stressors, stress and illness, pursuit of happiness) NOT individually fetched. |

**Skipped chapters (deliberate):** Ch. 2 Psychological Research (methods/statistics, not a content topic), Ch. 3 Biopsychology (deep neuroanatomy, not core to mental-wealth topics), Ch. 5 Sensation and Perception (largely sensory-organ physiology), Ch. 9 Lifespan Development, Ch. 12 Social Psychology, Ch. 13 Industrial-Organizational Psychology, Ch. 15 Psychological Disorders, Ch. 16 Therapy and Treatment — the latter two skipped intentionally given the no-clinical-claims guardrail noted in project memory; flag for editorial/product review before sourcing clinical-disorder content.

**Fetch issues:** None blocked outright — all 7 targeted chapters returned usable content via WebFetch. Only one section per chapter (plus the chapter-level outline) was pulled to stay within a reasonable pass; remaining section URLs are listed inside each file for a follow-up deeper capture if needed.

## MIT OpenCourseWare (`mit-ocw/`) — CC BY-NC-SA (NonCommercial, verify per-course)

| File | Source URL | Notes |
|---|---|---|
| `9-00sc-introduction-to-psychology.md` | https://ocw.mit.edu/courses/9-00sc-introduction-to-psychology-fall-2011/ | Broad survey course; full topic/unit list captured from course landing page. The dedicated `/pages/syllabus/` URL returned "too many redirects" via WebFetch (tried both the short and `brain-and-cognitive-sciences/`-prefixed legacy path) — landing page used as fallback, so week-by-week reading list is not captured, only unit list. Emotion & Motivation sub-unit separately confirmed via search summaries. |
| `9-70-social-psychology.md` | https://ocw.mit.edu/courses/9-70-social-psychology-spring-2013/pages/syllabus/ | Fetched cleanly. Note: this course has no fixed lecture calendar (study-group/journal format), so there is no week-by-week topic list to extract beyond the thematic areas listed. |
| `9-65-cognitive-processes.md` | https://ocw.mit.edu/courses/9-65-cognitive-processes-spring-2004/pages/syllabus/ | Fetched cleanly. Topic list, textbook, and grading captured; no separate week-by-week calendar was present in the fetched content. |
| `14-13-psychology-and-economics.md` | https://ocw.mit.edu/courses/14-13-psychology-and-economics-spring-2020/pages/syllabus/ | Fetched cleanly, full 24-lecture calendar captured — best ordering signal of the five MIT courses. |
| `mas-630-affective-computing.md` | https://ocw.mit.edu/courses/mas-630-affective-computing-fall-2015/pages/syllabus/ | Fetched cleanly. Grad-level, project-driven course — topic list captured but weak for prerequisite ordering since it's not a fixed lecture sequence. |

**Other courses found but not captured (candidates for a follow-up pass):** 9.10 Cognitive Neuroscience (Spring 2006), 9.13 The Human Brain (Spring 2019), 9.66J Computational Cognitive Science (Fall 2004), 9.63 Laboratory in Cognitive Science (Fall 2002), 9.69 Foundations of Cognition (Spring 2003), 9.012 The Brain and Cognitive Sciences II (Spring 2002) — all surfaced in search but skipped either as too neuroanatomy-heavy or too niche/methods-focused for the current DAG scope.

**Fetch issues:** Only the 9.00SC syllabus page hit a redirect-loop error; worked around via the course landing page as noted above.

## Summary counts

- OpenStax Psychology 2e: 7 chapter files
- MIT OpenCourseWare: 5 course files
- Total new files: 12 content files + this log
