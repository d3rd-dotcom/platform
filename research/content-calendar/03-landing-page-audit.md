# Landing-Page Copy Audit

Audit date: 2026-07-17  
Surfaces: local `main` working tree and [mentalwealthacademy.world](https://www.mentalwealthacademy.world/)  
Editorial standard: `EDITORIAL.md` v4.0 and the `mwa-editorial` review rules

## Executive finding

The strongest usable story in the repository is:

> Curiosity sets the syllabus. A member follows connected guides, records field notes, and lets Blue use that progress to suggest the next mission. Verified contributions earn credits and strengthen the path for the next learner.

That story is concrete, differentiated, and supported by real product structure. It should anchor the content calendar.

The public domain currently tells an older story. The live hero observed on 2026-07-17 opens with “Next-Gen Cohort For Scientists & Agents,” calls Blue a “classified AI model,” and asks visitors to “Enter As Human.” The current repository instead opens with “Vibe-Learning platform for the next gen of quality education.” The live site and repository therefore describe different products, audiences, CTAs, prices, and proof figures. Content published before deployment alignment would amplify contradictions.

The repository has also accumulated proof gaps: placeholder testimonials are public copy, three key figures are hard-coded without sources, “171 topics peer-reviewed by PhD Students” is hard-coded, and the literacy sentence misstates the available national data. Several sections also expose infrastructure language forbidden by the brand book.

## What feeds the public landing page

### Route and render order

- [`app/page.tsx:1`](/Users/james/MentalWealthAcademy/app/page.tsx:1) delegates `/` to `LandingPage`.
- [`components/landing/LandingPage.tsx:1`](/Users/james/MentalWealthAcademy/components/landing/LandingPage.tsx:1) mounts the header, hero, sound layer, and deferred body.
- [`components/landing/LandingDeferredSections.tsx:93`](/Users/james/MentalWealthAcademy/components/landing/LandingDeferredSections.tsx:93) defines the public sequence: problem, features, testimonials, ecosystem, founder, how it works, membership, figures, final CTA, FAQ, magazine, rotating statement, footer, donation popup, and Blue voice widget.
- [`app/layout.tsx:62`](/Users/james/MentalWealthAcademy/app/layout.tsx:62) supplies search and social metadata. [`components/layout/RouteShell.tsx:23`](/Users/james/MentalWealthAcademy/components/layout/RouteShell.tsx:23) leaves `/` outside the authenticated shell.

### Copy-bearing components

- Navigation and entry actions: [`LandingHeader.tsx:42`](/Users/james/MentalWealthAcademy/components/landing/LandingHeader.tsx:42), [`LandingAuthButtons.tsx:12`](/Users/james/MentalWealthAcademy/components/landing/LandingAuthButtons.tsx:12), [`LandingEnterAcademyButton.tsx:13`](/Users/james/MentalWealthAcademy/components/landing/LandingEnterAcademyButton.tsx:13)
- Hero: [`HeroSection.tsx:9`](/Users/james/MentalWealthAcademy/components/landing/HeroSection.tsx:9)
- Problem and evidence map: [`ProblemStatementSection.tsx:21`](/Users/james/MentalWealthAcademy/components/landing/ProblemStatementSection.tsx:21), [`ProblemMap.tsx:197`](/Users/james/MentalWealthAcademy/components/landing/ProblemMap.tsx:197)
- Knowledge system: [`FeaturesSection.tsx:8`](/Users/james/MentalWealthAcademy/components/landing/FeaturesSection.tsx:8), [`LandingKnowledgeGraph.tsx:499`](/Users/james/MentalWealthAcademy/components/landing/LandingKnowledgeGraph.tsx:499)
- Social proof: [`TestimonialSection.tsx:7`](/Users/james/MentalWealthAcademy/components/landing/TestimonialSection.tsx:7)
- Values and Blue: [`EcosystemSection.tsx:8`](/Users/james/MentalWealthAcademy/components/landing/EcosystemSection.tsx:8), [`FounderSection.tsx:20`](/Users/james/MentalWealthAcademy/components/landing/FounderSection.tsx:20)
- Product loop: [`HowItWorksSection.tsx:6`](/Users/james/MentalWealthAcademy/components/landing/HowItWorksSection.tsx:6)
- Pricing: [`LandingMembershipSection.tsx:11`](/Users/james/MentalWealthAcademy/components/landing/LandingMembershipSection.tsx:11), [`MembershipSection.tsx:219`](/Users/james/MentalWealthAcademy/components/landing/MembershipSection.tsx:219)
- Proof strip and closing action: [`KeyFiguresSection.tsx:3`](/Users/james/MentalWealthAcademy/components/landing/KeyFiguresSection.tsx:3), [`FinalCtaSection.tsx:7`](/Users/james/MentalWealthAcademy/components/landing/FinalCtaSection.tsx:7)
- Objection handling and long-form vision: [`FAQSection.tsx:7`](/Users/james/MentalWealthAcademy/components/landing/FAQSection.tsx:7), [`MagazineSection.tsx:6`](/Users/james/MentalWealthAcademy/components/landing/MagazineSection.tsx:6)
- Brand close and overlays: [`RotatingTextSection.tsx:85`](/Users/james/MentalWealthAcademy/components/landing/RotatingTextSection.tsx:85), [`LandingFooter.tsx:3`](/Users/james/MentalWealthAcademy/components/landing/LandingFooter.tsx:3), [`DonationPopup.tsx:49`](/Users/james/MentalWealthAcademy/components/landing/DonationPopup.tsx:49), [`ElevenLabsAgentWidget.tsx:20`](/Users/james/MentalWealthAcademy/components/landing/ElevenLabsAgentWidget.tsx:20)

Supporting visual and interaction files include `LandingScene.tsx`, `CohortCubes.tsx`, `PixelCursorTrail.tsx`, `LandingSoundEffects.tsx`, `LazySection.tsx`, their CSS modules, the redlining GeoJSON files under `public/data/`, the guide-map API, the shared CTA, the web provider, and the membership modal. They shape the experience without adding the main landing narrative.

## Strongest reusable copy

These fragments are short enough to use as source material, and each points to a real feature:

- “Start with one mission.” — [`FinalCtaSection.tsx:10`](/Users/james/MentalWealthAcademy/components/landing/FinalCtaSection.tsx:10)
- “Because quality education shouldn’t rely on wealth.” — [`FeaturesSection.tsx:55`](/Users/james/MentalWealthAcademy/components/landing/FeaturesSection.tsx:55)
- “Learn Where Curiosity Leads” — [`HowItWorksSection.tsx:28`](/Users/james/MentalWealthAcademy/components/landing/HowItWorksSection.tsx:28)
- “Your curiosity sets the syllabus.” — [`HowItWorksSection.tsx:30`](/Users/james/MentalWealthAcademy/components/landing/HowItWorksSection.tsx:30)
- “Blue connects the dots.” — [`HowItWorksSection.tsx:13`](/Users/james/MentalWealthAcademy/components/landing/HowItWorksSection.tsx:13)
- “Let your work carry forward.” — [`HowItWorksSection.tsx:19`](/Users/james/MentalWealthAcademy/components/landing/HowItWorksSection.tsx:19)
- “Bring me a good question. I like those.” — [`FounderSection.tsx:26`](/Users/james/MentalWealthAcademy/components/landing/FounderSection.tsx:26)
- “The first published guides will become the roots of this map.” — [`LandingKnowledgeGraph.tsx:539`](/Users/james/MentalWealthAcademy/components/landing/LandingKnowledgeGraph.tsx:539)
- “Live from the Academy, day and night.” — current in-product Blue Radio copy at [`BlueRadio.tsx:220`](/Users/james/MentalWealthAcademy/components/blue-scene/BlueRadio.tsx:220)

The last line exposes an important omission: the landing page never explains Blue Radio. The dashboard defaults to the live view, renders Blue as a broadcasting character, and plays a wall-clock-synchronized loop about the Academy, the course, field notes, quests, the guide library, Blue, and community ([`BlueScene.tsx:94`](/Users/james/MentalWealthAcademy/components/blue-scene/BlueScene.tsx:94), [`LivestreamFeed.tsx:5`](/Users/james/MentalWealthAcademy/components/blue-scene/LivestreamFeed.tsx:5), [`blue-radio-manifest.json:4`](/Users/james/MentalWealthAcademy/lib/blue-radio-manifest.json:4)). The shipped asset is 285.93 seconds of prerecorded ElevenLabs speech generated from fixed scripts ([`generate-blue-radio.ts:35`](/Users/james/MentalWealthAcademy/scripts/generate-blue-radio.ts:35), [`generate-blue-radio.ts:153`](/Users/james/MentalWealthAcademy/scripts/generate-blue-radio.ts:153)). It supports “continuous platform-orientation broadcast” and a “VTuber-style guide” demonstration. It does not support “live AI educator,” “24-hour live stream,” “24 hours of unique programming,” or claims of real-time interaction.

## Claims and implementation check

| Landing claim | Finding | Evidence or required action |
| --- | --- | --- |
| “Average U.S. literacy is 6th grade level.” | Misstated. Grade-equivalent language is absent from the cited national proficiency framework. | NCES reports 19% of adults at Level 1 or below in 2017, and a later NCES summary estimates 23% had low English literacy when nonparticipants are included. Use a sourced proficiency statistic with year and population. See [NCES PIAAC national results](https://nces.ed.gov/surveys/piaac/2017/national_results.asp) and [NCES 2022-004](https://nces.ed.gov/pubs2022/2022004/), accessed 2026-07-17. |
| Redlining still affects educational resources. | Directionally supported as an association. | An observational study finds lower district per-pupil revenue in historically redlined areas; it does not by itself establish causation. The local map cites its geographic sources at [`ProblemMap.tsx:206`](/Users/james/MentalWealthAcademy/components/landing/ProblemMap.tsx:206). Cite the study and preserve the observational wording: [ERIC record for the Annenberg working paper](https://eric.ed.gov/?id=ED616673), accessed 2026-07-17. |
| Coin stacks imply marginalized, wealthy, and private schools receive 1:3:5 funding. | Unsupported visual claim. | The ratios are manually assigned in [`ProblemStatementSection.tsx:29`](/Users/james/MentalWealthAcademy/components/landing/ProblemStatementSection.tsx:29) and [`ProblemMap.tsx:160`](/Users/james/MentalWealthAcademy/components/landing/ProblemMap.tsx:160). Add real per-pupil figures for named geographies and years, or remove the quantitative-looking stacks. |
| “Every topic has one verified guide.” | The one-topic invariant exists; universal verification remains unproven. | `topic_title` is unique and only published guides feed the map ([`20260705090000_guides_dag.sql:21`](/Users/james/MentalWealthAcademy/supabase/migrations/20260705090000_guides_dag.sql:21), [`guides-db.ts:114`](/Users/james/MentalWealthAcademy/lib/guides-db.ts:114)). Say “one canonical guide per published topic” until every published record has completed verification. |
| “171 topics peer-reviewed by PhD Students across 11 levels.” | Unsupported and stale by design. | The sentence is a literal constant at [`LandingKnowledgeGraph.tsx:605`](/Users/james/MentalWealthAcademy/components/landing/LandingKnowledgeGraph.tsx:605), while the graph itself fetches live data at line 377. Render live counts and document reviewer credentials before using them in marketing. |
| Blue suggests the next node based on progress. | Supported with limits. | Blue Chat calls the authenticated guide-recommendation endpoint, which returns up to three published frontier guides based on recorded guide completions ([`BlueChat.tsx:710`](/Users/james/MentalWealthAcademy/components/blue-chat/BlueChat.tsx:710), [`recommend/route.ts:34`](/Users/james/MentalWealthAcademy/app/api/guides/recommend/route.ts:34)). Say “Blue can show your next unlocked guides.” Do not imply the choice is generated from field-note meaning, personal psychology, or an autonomous curriculum model. |
| Approved quests can earn cash. | Supported as a gated workflow. | Current custom-quest claims can be creator-reviewed or admin-reviewed, and the payout path records status and a transaction identifier; the unique member-and-quest constraint prevents a second claim ([`creator-review/route.ts:111`](/Users/james/MentalWealthAcademy/app/api/quests/usdc/creator-review/route.ts:111), [`review/route.ts:107`](/Users/james/MentalWealthAcademy/app/api/quests/usdc/review/route.ts:107), [`ensureQuestUsdcClaimsSchema.ts:47`](/Users/james/MentalWealthAcademy/lib/ensureQuestUsdcClaimsSchema.ts:47)). Content must name the submission, review, eligibility, and funding conditions. |
| Testimonials and earnings are real member proof. | Unsafe to publish as proof. | The file itself calls the earnings “placeholder mock-ups” at [`TestimonialSection.tsx:7`](/Users/james/MentalWealthAcademy/components/landing/TestimonialSection.tsx:7). The names and quotes also lack local consent/source records. Remove the section until verified testimonials and permission are stored. |
| “3” grants, “$40K” community funds, and “5+” case studies. | Untraceable. | All three values are hard-coded at [`KeyFiguresSection.tsx:7`](/Users/james/MentalWealthAcademy/components/landing/KeyFiguresSection.tsx:7). The live indexed page recently showed 8 awards and $20K, confirming drift. Give each figure a source, definition, and as-of date. |
| $20 monthly and $888 lifetime. | Implemented locally, but unsafe to market until policy and deployment agree. | Prices are constants at [`lib/stripe.ts:26`](/Users/james/MentalWealthAcademy/lib/stripe.ts:26), and the monthly route creates a recurring $20 checkout at [`create-subscription-session/route.ts:64`](/Users/james/MentalWealthAcademy/app/api/membership/create-subscription-session/route.ts:64). The live indexed FAQ recently showed $90 lifetime, while `EDITORIAL.md` says “No subscriptions.” Reconcile all three sources before publishing a price. |
| “Every course is free.” | Too broad for the implementation. | Custom-course access supports membership gates at [`course-access.ts:16`](/Users/james/MentalWealthAcademy/lib/course-access.ts:16). Use “Courses marked public are free to open”; name any specific free course only after checking its deployed access rule. |
| “Treasury profit sharing.” | High-risk, unsupported consumer promise. | It appears only as a tier benefit at [`MembershipSection.tsx:354`](/Users/james/MentalWealthAcademy/components/landing/MembershipSection.tsx:354). Remove until legal terms, eligibility, calculation, funding source, and operational code are complete. |

## Editorial and brand drift

Highest-priority violations:

1. The FAQ names a smart contract, wallet, supply percentage, ticker, Coinbase, payout asset, NFT, chain, and network ([`FAQSection.tsx:19`](/Users/james/MentalWealthAcademy/components/landing/FAQSection.tsx:19)). The brand book reserves all of this for technical surfaces.
2. The membership cards use “DeSci,” “on-chain,” and “NFT” ([`MembershipSection.tsx:283`](/Users/james/MentalWealthAcademy/components/landing/MembershipSection.tsx:283)). “Treasury profit sharing” adds an unsupported financial promise.
3. The magazine description says “onchain governance,” and its CTA sends visitors to an asset-collection marketplace ([`MagazineSection.tsx:13`](/Users/james/MentalWealthAcademy/components/landing/MagazineSection.tsx:13)).
4. The donation overlay leads with “cryptocurrency investments” ([`DonationPopup.tsx:62`](/Users/james/MentalWealthAcademy/components/landing/DonationPopup.tsx:62)).
5. The metadata says “Unlock your potential, reach your horizon,” a corporate-wellness abstraction explicitly rejected by the editorial rules. Its social image URL is only `https://imgur.com`, which is not a valid image asset ([`app/layout.tsx:62`](/Users/james/MentalWealthAcademy/app/layout.tsx:62)).
6. “AI Powered Learning Nodes” is mechanism-first, uses inflated AI framing, and needs a hyphen if retained ([`FeaturesSection.tsx:64`](/Users/james/MentalWealthAcademy/components/landing/FeaturesSection.tsx:64)).
7. “From the founder” labels Blue as the founder ([`FounderSection.tsx:20`](/Users/james/MentalWealthAcademy/components/landing/FounderSection.tsx:20)). The body correctly identifies her as the Academy’s autonomous agent. Rename the section category.
8. “The Problem” is rendered in all caps, against the house style ([`ProblemStatementSection.tsx:11`](/Users/james/MentalWealthAcademy/components/landing/ProblemStatementSection.tsx:11)).

The live domain contains additional drift observed on 2026-07-17: “earn while you learn,” “evolve your mental state,” “classified AI model,” an infrastructure-logo wall, and “Enter As Human.” These phrases push hype, self-help, and underlying technology ahead of the educational gameworld. Direct source: [mentalwealthacademy.world](https://www.mentalwealthacademy.world/), accessed 2026-07-17.

## CTA flow

The dominant entry CTA is internally consistent in code: “Apply to Join,” “Explore Our World,” “Enter Free,” and the final mission CTA all lead to `/dao` ([`LandingAuthButtons.tsx:12`](/Users/james/MentalWealthAcademy/components/landing/LandingAuthButtons.tsx:12), [`LandingEnterAcademyButton.tsx:13`](/Users/james/MentalWealthAcademy/components/landing/LandingEnterAcademyButton.tsx:13), [`MembershipSection.tsx:268`](/Users/james/MentalWealthAcademy/components/landing/MembershipSection.tsx:268)). The labels imply four different commitment levels while reaching the same destination. Choose one entry verb and explain what happens after the click.

Secondary CTAs fragment attention:

- Discord opens a bot-authorization URL.
- “Schedule Call” opens a strategy calendar.
- Paid membership starts checkout.
- “Collect on Zora” opens a marketplace.
- “Support on Artizen” opens fundraising.

For social content, use one conversion path per post: start a free mission, tune in to Blue Radio, open a guide, or inspect a case study. Calls, purchases, donations, and collectible media belong to separate campaigns with explicit context.

## Content pillars to carry into the 30-day calendar

1. **Curiosity sets the syllabus** — one question, one guide, one next node.
2. **Blue teaches the interface** — short clips where the VTuber educator explains a real screen, guide, mission, or member decision.
3. **Field notes make learning accountable** — show the prompt, a safe excerpt, Blue’s review, and the next step.
4. **Knowledge compounds socially** — one contribution strengthens a canonical path for later learners.
5. **Start with one mission** — small, well-scoped educational actions with clear completion criteria.
6. **Education and structural access** — sourced literacy, funding, and redlining explainers with dates and methodology.
7. **Research in public** — explain one validated assessment, case study, method, or limitation at a time.
8. **Rewards with conditions** — show review gates and real member value without infrastructure vocabulary.
9. **The living library** — guide prerequisites, levels, maps, and the reason duplicate tutorials create fatigue.
10. **Blue Radio** — continuous platform orientation, office hours, curriculum previews, and weekly research summaries.

## Publication guardrail

Before the calendar reuses a landing claim, require one of three proof forms: a live product demonstration, a repository-backed mechanism with its conditions, or a dated external source. Placeholders, hard-coded totals, reviewer credentials, member outcomes, and financial promises require evidence before publication.
