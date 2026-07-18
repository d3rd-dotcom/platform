# Blue Radio Positioning Memo

**Research cutoff:** 2026-07-17  
**Purpose:** Define a defensible role for Blue Radio in the 30-day content calendar.

## Executive Decision

Position Blue Radio as **the Academy's ambient platform field guide**: a synchronized broadcast where Blue introduces the course, field notes, quests, credits, the guide library, and the community in short chapters.

This is a distinctive, supportable experience claim. The current build does not support “live tutor,” “personalized educator,” “interactive stream,” “24 hours of programming,” or “better than a manual.” Those phrases require product work or measurement.

The strongest public line available today:

> **Blue Radio is a day-and-night broadcast hosted by Blue. Tune in anywhere in the loop for a short field guide to the Academy.**

“Day-and-night” describes the intended availability without implying 24 hours of unique material. “Field guide” fits the product’s academic register and the current scripted orientation function.

## What Exists Now

| Repo fact | Evidence | Safe interpretation |
| --- | --- | --- |
| The `/dao` dashboard opens on the Live view. | `/Users/james/MentalWealthAcademy/components/blue-scene/BlueScene.tsx:94-97`, `:266-292`; `/Users/james/MentalWealthAcademy/components/home-bento/HomeBento.tsx:7-15`; `/Users/james/MentalWealthAcademy/app/dao/page.tsx:4-13` | Blue Radio is a prominent dashboard experience, rather than a buried help page. |
| The player derives its place in the program from wall-clock time. Listeners cannot pause or seek. | `/Users/james/MentalWealthAcademy/components/blue-scene/BlueRadio.tsx:25-37`, `:85-106`, `:142-178` | People who tune in at approximately the same time hear the same chapter. Call this a synchronized broadcast. |
| The shipped manifest contains ten segments totaling 285.93 seconds, about 4 minutes 46 seconds. | `/Users/james/MentalWealthAcademy/lib/blue-radio-manifest.json:1-66` | It is a concise orientation loop. It is not 24 hours of distinct programming. |
| The script covers the Academy, mental wealth, the 12-week course, field notes, quests and credits, guides, Blue, and community. | `/Users/james/MentalWealthAcademy/scripts/generate-blue-radio.ts:33-84` | The current editorial function is platform orientation plus brand-world explanation. |
| Audio is generated as one MP3 per chapter and stored locally. | `/Users/james/MentalWealthAcademy/scripts/generate-blue-radio.ts:86-88`, `:125-198`; `/Users/james/MentalWealthAcademy/public/audio/blue-radio/` | The current program is prerecorded and repeatable. It can be revised chapter by chapter. |
| A VRM model loads when WebGL is available; a still image remains as fallback. | `/Users/james/MentalWealthAcademy/components/blue-scene/BlueRadio.tsx:197-218`; `/Users/james/MentalWealthAcademy/components/blue-scene/BlueVrmStage.tsx:45-124` | Blue has an animated broadcast presence with a resilient fallback. |
| Voice amplitude drives mouth movement; timed visemes, blinking, head motion, and body motion animate the model. Reduced-motion preferences are honored. | `/Users/james/MentalWealthAcademy/components/blue-scene/BlueVrmCanvas.tsx:99-132`, `:204-267`, `:273-297` | “Audio-reactive animated host” is accurate. “Exact lip sync” would overstate the implementation. |
| A configured external stream can replace Blue Radio. | `/Users/james/MentalWealthAcademy/components/blue-scene/LivestreamFeed.tsx:5-21` | The surface can host a true livestream later, while the current default is the prerecorded broadcast. |
| The script comments describe a planned two-hour co-hosted edition. It is not in the manifest. | `/Users/james/MentalWealthAcademy/scripts/generate-blue-radio.ts:30-32`; `/Users/james/MentalWealthAcademy/lib/blue-radio-manifest.json:2-4` | Treat the two-hour edition and co-host as roadmap material. |

One implementation discrepancy should be corrected before a behind-the-scenes post: the script comment says “roughly eight minutes,” while the generated manifest is 285.93 seconds (`/Users/james/MentalWealthAcademy/scripts/generate-blue-radio.ts:30`; `/Users/james/MentalWealthAcademy/lib/blue-radio-manifest.json:3`).

## The Defensible Difference

Most product guidance is separated from the product’s identity. Blue Radio makes orientation part of the gameworld. The same character who represents review, memory, and rewards introduces the Academy’s routines through a broadcast already embedded in its dashboard.

The differentiation has four defensible parts:

1. **Character continuity.** Blue gives courses, field notes, quests, guides, and community one recognizable voice.
2. **Ambient entry.** A member can tune in without selecting a lesson or composing a question.
3. **Shared time.** The wall-clock loop creates a lightweight sense of tuning into the same station.
4. **Product-connected subject matter.** Every current chapter explains a real Academy surface or practice.

The character should remain a meaningful product presence. The internal Blue specification assigns her authority to reviews, rewards, surveys, milestones, and story moments, while routine onboarding and help stay in the brand voice (`/Users/james/MentalWealthAcademy/.agents/skills/mwa-blue/references/appearances.md:1-31`, `:54-74`). Blue Radio can sit within that rule as a scarce broadcast and story surface. It should not expand into tooltips, generic encouragement, or customer support.

## Comparison With Adjacent Formats

| Format | What it does well | Blue Radio’s current relationship to it | Honest boundary |
| --- | --- | --- | --- |
| Searchable manual or guidebook | Exact lookup, scanning, stable reference, accessibility | Radio can provide a memorable overview and direct members toward the right surface. | The linear audio loop cannot replace precise lookup. A small software-learning experiment found participants preferred video for new material and text for missed-information lookup; generalization beyond that population is limited. |
| First-run onboarding | Guides an immediate action and can measure activation | Radio can introduce the Academy’s vocabulary and rhythms before or between actions. | It currently has no task detection, progress state, or contextual prompts. |
| Intelligent tutor | Diagnoses a learner’s state, elicits responses, gives step-level feedback, and adapts | Blue’s wider agent role may eventually connect explanation, practice, review, and memory. | Radio currently emits a fixed program. It does not receive questions or assess understanding. |
| Livestream educator | Uses real-time questions, social presence, examples, and a backchannel | Radio borrows the shared-time and recurring-host qualities. | It has no real-time host, chat response, listener shaping, or live event state. |
| Virtual creator or VTuber | Builds a consistent persona and recognizable audiovisual format | Blue already has a model, voice, authored point of view, recurring chapters, and a persistent Academy role. | Public content should disclose the prerecorded loop and AI-mediated character clearly. |
| Parasocial learning interface | May support familiarity, motivation, and return behavior | A recurring host creates a testable motivation and continuity hypothesis. | Educational-video research found a slight association with motivation and no correlation with learning growth in one large observational study. Relationship strength cannot be marketed as proof of learning. |

Research on animated pedagogical agents reports positive average effects on transfer and retention, with important moderators such as prior knowledge, subject matter, voice, and gesture. That literature supports testing Blue as a signaling and attention-guiding layer. It does not establish an effect for this implementation.

Research on intelligent tutoring systems also shows why “tutor” is a demanding category. A meta-analysis of 50 controlled evaluations reported a median 0.66-standard-deviation improvement, while also finding results depended on assessment alignment and implementation quality. The relevant mechanisms include guided practice and feedback. A looping broadcast alone does not implement them.

Live-stream learning research highlights browsing, communication, metavoicing, and relationship formation as important affordances. Blue Radio currently has browsing only in a limited sense and lacks the reciprocal affordances. Its present advantage is editorial continuity. Real-time interactivity is a product opportunity.

## Positioning Ladder

1. **Category:** A social-first gameworld for learning, research, and rewards.
2. **Feature:** Blue Radio, a synchronized broadcast inside the Academy dashboard.
3. **Function:** Ten short chapters explain the course, field notes, quests, credits, guides, Blue, and community.
4. **Practical value:** Members receive an easy first map of the Academy while reading, writing, or exploring.
5. **Experience value:** The platform feels hosted and coherent across otherwise separate features.
6. **Relationship value:** Blue becomes a recognizable academic character whose appearances connect to real product responsibilities.
7. **Brand idea:** The Academy has a host who teaches its rhythms.

## Claim Ledger

### Safe now

- “Blue Radio is a synchronized broadcast inside the Academy.”
- “Blue hosts ten short chapters about how the Academy works.”
- “Tune in to hear about courses, field notes, quests, credits, guides, and community.”
- “Blue appears as an audio-reactive animated host.”
- “The current episode runs about five minutes and loops through the day and night.”
- “A platform field guide in broadcast form.”

### Requires measurement

- “Blue Radio helps members understand the platform faster.”
- “Listeners start more courses, field notes, or quests.”
- “Blue improves feature recall, motivation, retention, or trust.”
- “The broadcast reduces support requests.”
- “Members return because Blue feels familiar.”
- “Blue Radio is a better guide than a manual.”
- “Blue Radio runs continuously” as an uptime claim.

### Requires new functionality

- “Ask Blue what to do next” requires listener input and grounded response.
- “A personalized educator” requires learner state, content selection, adaptive feedback, and evaluation.
- “A live educator” requires real-time production or interaction and clear live status.
- “Blue remembers what you heard” requires listening history and consent-aware memory.
- “Join the conversation” requires a moderated backchannel connected to the program.
- “24 hours of programming” requires a 24-hour schedule or a plainly disclosed short loop.

## Measurement Plan

Run a controlled onboarding test with three conditions: searchable text guide, Blue Radio plus transcript, and both together.

Primary measures:

- first meaningful action within 10 minutes: open a course week, create a field note, inspect a quest, or open a guide;
- unaided feature recall after the session and after 24 hours;
- task completion without help;
- time to locate a specific feature;
- next-day and seven-day return;
- support or guidebook opens.

Broadcast diagnostics:

- tune-in success, autoplay-block rate, unmute rate, and WebGL fallback rate;
- listening time and chapter completion;
- exits and actions by chapter;
- repeat listening within seven days;
- deep-link clicks from a future transcript or chapter card.

Publish outcome claims only after predefining the comparison, sample, and success threshold. Khan Academy’s 2026 account of Khanmigo development is a useful operational model: it names response latency, next-item correctness, and conversation abandonment as separate metrics rather than collapsing them into “engagement.”

## Product Work That Would Earn the Stronger Position

1. Add a visible transcript with chapter names, timestamps, and links to the exact product surfaces.
2. Label the program clearly as a prerecorded synchronized broadcast and identify Blue as an AI agent.
3. Add captions and keyboard-accessible chapter navigation while preserving the tune-in mode.
4. Rotate episodes by member stage, with explicit consent for any use of learning history.
5. Add short retrieval checks or “try it now” actions after relevant chapters.
6. Connect a moderated question queue to grounded answers from approved Academy material.
7. Add scheduled live sessions with truthful live/offline state.
8. Instrument learning and activation measures before making outcome claims.
9. Keep the searchable guidebook as the exact-reference layer.

The resulting system can become a layered interface: broadcast for orientation, transcript for lookup, product action for practice, and Blue’s agent workflow for consequential feedback.

## Content Angles For The 30-Day Calendar

| Angle | Publishable hook | Evidence asset | CTA |
| --- | --- | --- | --- |
| Tune into the same chapter | “Open Blue Radio now. Everyone tuning in meets Blue at the same point in the broadcast.” | Screen recording from two devices showing the same chapter title | “Tune in from the Live tab.” |
| The five-minute field guide | “Five minutes. Ten chapters. One map of the Academy.” | Manifest duration plus chapter montage | “Listen once, then choose one feature to open.” |
| What Blue teaches | “Courses, field notes, quests, credits, guides, and community each get a chapter.” | Chapter title carousel | “Which chapter should become a full episode?” |
| The host inside the product | “Blue introduces the Academy from inside the dashboard where members use it.” | `/dao` capture moving from radio to a named feature | “Open the Academy and follow one route.” |
| How the avatar moves | “Blue’s voice level drives her mouth and broadcast motion.” | Transparent dev clip showing audio waveform and avatar | “Watch one chapter with sound.” |
| A shared station | “The program follows the clock, so tuning in feels like arriving somewhere already in motion.” | Clock plus player demo | “Compare your chapter with a friend.” |
| Field notes chapter | “Blue’s daily writing chapter gives the blank page a place in the wider Academy.” | Excerpt followed by the real field-notes screen | “Write one field note.” |
| Quest boundaries | “Blue explains why reviews and rewards have rules.” | Quest chapter plus review/reward product evidence | “Read an open quest.” |
| The guide-library map | “One radio chapter introduces a library where ideas unlock other ideas.” | Guide map capture | “Open one published guide.” |
| Building the evidence | “Can a character-led field guide help people find their first action faster? We are measuring it.” | Experiment design and later results | “Join the test.” |
| Broadcast plus reference | “Listen for the map. Use the transcript for the exact turn.” | Future transcript prototype | “Save the chapter you need.” |
| Episode two in public | “The first loop is under five minutes. Help shape the next edition.” | Current chapter list and proposed additions | “Vote on one next topic.” |

Avoid urgency bait, fabricated audience size, countdowns, hidden synthetic identity, and learning or mental-health promises. The content strength comes from showing a real, unusual interface and measuring what it changes.

## External Evidence

All sources accessed 2026-07-17.

1. Verena Käfer, Daniel Kulesz, and Stefan Wagner, **“What Is the Best Way For Developers to Learn New Software Tools? An Empirical Comparison Between a Text and a Video Tutorial”** (published 2017-04-01). Experiment with 42 software-engineering students; text was faster to consume, video was faster to apply, and participants preferred video for new content plus text for lookup. Scope is narrow and should inform a layered design rather than a universal claim. https://doi.org/10.22152/programming-journal.org/2017/1/17
2. Fuxing Wang, Wenjing Li, and Tingting Zhao, **“Multimedia Learning with Animated Pedagogical Agents”** (online 2021-11-19; print 2021). Handbook review and meta-analysis reports `g=.45` for transfer and `g=.23` for retention, with effects moderated by learner, material, voice, and gesture characteristics. https://doi.org/10.1017/9781108894333.047
3. Jacob Beautemps and André Bresges, **“The influence of the parasocial relationship on the learning motivation and learning growth with educational YouTube videos in self regulated learning”** (published 2022-12-19). Original study retained 2,643 participants; parasocial relationship correlated slightly with motivation and did not correlate with learning growth. https://doi.org/10.3389/feduc.2022.1021798
4. Mingxia Jia et al., **“How vicarious learning increases users’ knowledge adoption in live streaming: The roles of parasocial interaction, social media affordances, and knowledge consensus”** (March 2024). Three-wave survey across four Chinese platforms linked knowledge adoption to vicarious learning, parasocial interaction, and affordances including communication and metavoicing. It is observational evidence rather than a causal test of Blue Radio. https://doi.org/10.1016/j.ipm.2023.103599
5. James A. Kulik and J. D. Fletcher, **“Effectiveness of Intelligent Tutoring Systems: A Meta-Analytic Review”** (first published 2016-03-01). Fifty controlled evaluations produced a median effect of 0.66 standard deviations, with strong dependence on assessment alignment and implementation quality. https://doi.org/10.3102/0034654315581420
6. Neo Molemane, Moeketsi Mosia, and Felix O. Egara, **“Effectiveness of AI-based tutoring and assessment systems in mathematics education: a systematic review”** (published 2026-07-09). Twelve included studies suggested benefits varied by context and implementation; direct achievement evidence for generative AI remained limited. https://doi.org/10.1007/s44217-026-01872-5
7. Rachel Esther Lim and So Young Lee, **“‘You are a virtual influencer!’: Understanding the impact of origin disclosure and emotional narratives on parasocial relationships and virtual influencer credibility”** (November 2023). Two experiments found origin disclosure and emotional narrative changed perceived humanness, parasocial interaction, and credibility. The practical lesson is transparent identity plus carefully grounded characterization. https://doi.org/10.1016/j.chb.2023.107897
8. UNESCO, **“Guidance for generative AI in education and research”** (published 2023-09-07; page updated 2026-01-16). Recommends human-centered, privacy-protective, age-appropriate, pedagogically validated use. https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research
9. Khan Academy, **“How Khan Academy Is Building a Better AI Tutor: Our Most Recent Learnings”** (published 2026-05-06). Primary product-development account describing tests and separate measures including latency, next-item correctness, and abandonment. Treat it as company-reported evidence. https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/

