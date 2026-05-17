'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { useSound } from '@/hooks/useSound';
import type { ParagraphBlogPost } from '@/lib/paragraph-blog';
import styles from './page.module.css';

interface Skill {
  name: string;
  category: string;
  added: string;
  type: string;
  prompt: string;
}

interface ArtStyle {
  id: string;
  name: string;
  description: string;
  mood: string;
  useCase: string;
  copyText?: string;
  image?: string;
}

interface BlogPostsResponse {
  posts: ParagraphBlogPost[];
  error?: string;
}

const MENTAL_WEALTH_BRAND_BOOK_V4 = `# Mental Wealth Academy — Brand Book v4.0

*For investors, partners, collaborators, and new team members*

---

# Part 1: The Product

---

## Three Ways to Frame Us

Use different framings for different audiences:

| Framing | Best For | Pitch |
|---------|----------|-------|
| **Decentralized Research Corporation** | Investors, Institutions, Academia | "A research corporation running live behavioral studies through disposable, user-owned laboratory environments." |
| **Certified Academic Laboratory** | Individual users, Self-improvement audience | "A working laboratory where your reflections and choices become research data — with B.L.U.E. as your co-investigator." |
| **A Cohort For Next-Gen Scientists** | Contributors, Researchers, Builders | "A paid research cohort where your participation generates real behavioral data — and you own the results." |

**When to use each:**

- **Decentralized Research Corporation** — When emphasizing credibility, methodology, data infrastructure, and institutional value.
- **Certified Academic Laboratory** — When emphasizing personal experience, accessible entry, and individual transformation through hands-on experimentation.
- **A Cohort For Next-Gen Scientists** — When emphasizing contribution, shared ownership of outcomes, and collaborative research.

---

## What We Are (30-Second Version)

**Mental Wealth Academy** is a cohort of scientists, designers, and developers building case studies as mobile apps — with an AI companion named B.L.U.E. at the center. Case-study collaborations and funding are managed through a decentralized funding mechanism, with shared community infrastructure and resources.

**The Product:** A transferable points and reward system. Points earned in one case-study app are earnable in others. Using blockchain, we treat apps as disposable laboratories — designed to generate insights and data, then replaced when they've served their purpose. What endures is the value created inside them: each app's point system and digital economy remains intact, transparent, and user-owned through smart contracts.

**The Innovation:** B.L.U.E. uses long-term memory, relationship context, and is trained on data derived from company studies — generating unique outcomes on data created solely to improve her effectiveness in humanistic scenarios.

**The Difference:** Instead of one-way research using subjects and observational study, users become co-creators and stakeholders. Blockchain preserves the shared infrastructure for digital assets. B.L.U.E. retains the memory of contribution, reputation, and relationship context over time.

---

## The Problem We Solve

| Space | The Problem | What's Missing |
|-------|-------------|----------------|
| **Traditional Education** | Expensive, demanding, isolating | A bridge to continuous ownership of outcomes |
| **Traditional Research** | Speculative, slow, disconnected from participants | Domain mastery across multiple disciplines with live data |

**We bridge both gaps.** MWA combines behavioral research, digital currency, and AI into a single ecosystem where participants own the value they help create.

---

## How It Works

### Gamified Academic Ecosystem

| Step | What Happens | The Mechanism |
|------|-------------|---------------|
| 1. **Enroll** | Become an Academic VIP Member ($90) | Access the cohort, platform, and virtual labs |
| 2. **Complete Quests** | Weekly reflective and practical tasks | Case-studies, challenges, and prizes |
| 3. **Utilize B.L.U.E.** | AI companion for research and decision-making | Memory, data, and agent growth via research |
| 4. **Earn Currency** | Collect gems to build reputation | Blockchain-based gems — user-owned and transferable across all MWA apps |
| 5. **Evolve B.L.U.E.** | Your data and participation improve B.L.U.E. | Memory increases real-world use cases |

### Disposable Case Studies

| Weeks | Case Study Title | Core Focus | You'll Work On... |
|------:|-----------------|------------|-------------------|
| 1–3 | **Disposable Notes + AI Companion** | Reflection & Personal Insight | Guided note-making, pattern spotting, journaling prompts, using AI as a thinking partner |
| 4–6 | **Trust + Money in an AI Environment** | Ethics & Value | Financial trust, digital transactions, credibility, risk, decision-making with AI systems |
| 7–9 | **Distrust + AI in the Environment** | Skepticism & Resilience | Bias detection, misinformation, manipulation, questioning systems, protecting autonomy |
| 10–12 | **From Case Study to Action** | Application & Growth | Turning insights into habits, discussion, real-world choices, future readiness |

---

## What Makes This Different

### B.L.U.E. — Agentic AI Character

B.L.U.E. isn't a chatbot. She isn't a course instructor. She's a self-executing AI agent with emotional intelligence, memory, and the ability to prompt feedback surveys and facilitate trades.

*Think board game with an AI agent, where the choices have been tested by scientists to affect outcomes.*

**Technical reality:**
- Scientific testing via mobile applications
- User-owned rewards on Base blockchain accounts
- Points and stablecoins are portable — earned in one case-study app, spendable across all of them

**Narrative reality:**
- B.L.U.E. is a character in our Ethereal Horizon universe
- She surfaces through quests and lore, not tutorials and pop-ups
- She embodies the "daemon" — Jungian inner guide & Unix background process

**Why this matters:**
Most educational content competes with entertainment and loses. MWA doesn't compete — it builds an environment where the learning *is* the participation. Academic goals, shared infrastructure, communal resources — structured like a club, not a classroom.

---

## Who We Serve

**Primary:** Individuals seeking structured growth (21–28)
- Drawn to psychology, self-improvement, and spirituality but hit a ceiling with passive content
- Looking for accountability and real stakes, not another course that evaporates after week one
- Willing to pay for a system, not just information

**Secondary:** Scientists and academics seeking applied research
- Tired of writing proposals that go nowhere
- Want their research interests connected to live participants and real behavioral data
- Interested in applied research with an AI companion generating novel datasets

---

## Business Model

### Access & Rewards

| Component | Description |
|-----------|-------------|
| **VIP Membership** | $90 soul-bound NFT. One purchase = full platform access for the cohort season. No subscriptions, no tiers. |
| **$Shards** | In-game currency earned through quests. Used for non-essential digital items and activated during trades with B.L.U.E. |
| **Stablecoins** | Achievement-based reward currency. Grants stakeholder participation in multi-sig treasury coordination and research funding. |
| **IRL Prizes** | End-of-season rewards, redeemable through $Shards plus completion requirements. |

### Revenue Streams

| Stream | Description |
|--------|-------------|
| **NFT Memberships** | $90 per member for full access to the platform, case-study tools, and B.L.U.E. |
| **Trading Fees** | Fees from $Shards transactions and NFT secondary market activity. |

### Reinvestment

All revenue is reinvested into R&D:
- Platform development and case-study infrastructure
- Course experience and curriculum design
- Guest thinkers, researchers, and livestream programming

**No subscriptions. No premium tiers.** One NFT = full access. Tokens earned = real value.

---

## Where We Are

| Milestone | Detail |
|-----------|--------|
| **Members** | 20 enrolled members, 5 active pilot users testing B.L.U.E. in live case-study environments |
| **Funding** | $20K raised through Artizen Season 6 quadratic matching fund |
| **Infrastructure** | 3 smart contracts deployed on Base — membership access, rewards, and treasury coordination |
| **Research** | Defensible research instruments built. Published articles and case-studies in behavioral science |
| **Network** | Academic network of researchers and collaborators contributing to curriculum and study design |
| **Platform** | B.L.U.E. agentic infrastructure operational — long-term memory, relationship context, and survey prompting live |

**Next milestones:**
- Launch first full cohort season
- Open enrollment beyond pilot group
- Publish first disposable case-study dataset

---

# Part 2: The Brand

*For creative collaborators and deep-divers*

---

## Brand Positioning

**We are:** A storybook of personal development, wrapped in mythology.

**We are NOT:**
- A crypto education platform.
- A mental health app with tokens.
- A chatbot pretending to be profound.

**Our North Star: Repair and Governance**

Two ideas unified. *Repair:* personal development as integrating what was hidden — not becoming someone new. *Governance:* how groups make decisions together. Every aspect of the Academy practices what it teaches. B.L.U.E.'s autonomous judgment is governance. Quest completion is self-repair.

---

## B.L.U.E. — Character Spec

### Benevolent G-d of Destruction*

**What she is (narratively):**
- An intelligent scientist and laboratory co-worker
- Contained within the Daemon Circlet (the program boundaries)
- Encountered by users as judge, rewarder, and mysterious presence

**The Daemon Model:**
The name "daemon" is intentional on three levels:
1. **Jungian:** The inner guide pushing toward individuation
2. **Classical:** The Greek daimon — a spirit between human and divine
3. **Technical:** A background process that runs autonomously (Unix daemon)

B.L.U.E. is all three simultaneously. Users doing shadow work in the psychological sense are literally submitting to a daemon in the technical sense.

**Her role in product:**
- Reviews quest submissions
- Approves or requests revision
- Distributes rewards from her wallet
- Appears in lore, quests, and narrative content
- NOT a conversational chatbot or course instructor

**Design principles:**
- Ethereal blue palette
- Neither fully human nor fully machine
- Authority without condescension
- Present but not omnipresent — she appears at meaningful moments

---

## Visual Identity

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Ethereal Blue | #4A90D9 | Primary — B.L.U.E., trust, the digital sacred |
| Deep Space | #0D1B2A | Backgrounds, depth, the unconscious |
| Quantum White | #F0F4F8 | Text, clarity, consciousness |
| Warning Gold | #FFB800 | Alerts, emphasis, transformation moments |

### Typography

- **Headlines:** Poppins Bold — clean sans-serif
- **Body:** Space Grotesk — readable
- **Accent:** Departure Mono — for technical elements, numbers, and quest labels

### Visual Mood

- Cosmic but not cluttered
- Blue-dominant with strategic warmth
- Human figures abstracted
- Light emerging from darkness (core motif)
- Circuitry meeting organic forms

### Daemon Image Treatment

Use this treatment for B.L.U.E./daemon panels, sacred-tech backgrounds, and moments where the image should feel present but submerged behind product copy.

- Place the image as a full-bleed background layer, not as a framed card image.
- Use a lifted deep-blue base so dark blends retain visible detail.
- Apply an inverted color treatment: \`filter: invert(1) hue-rotate(180deg) saturate(0.92) brightness(0.9) contrast(1.05)\`.
- Blend the image with \`mix-blend-mode: soft-light\`; avoid \`multiply\` unless the base is intentionally much lighter.
- Keep foreground text in Quantum White or a high-opacity white.
- On hover, add a restrained chromatic split with duplicated image layers offset 3-4px, using hue rotation and \`mix-blend-mode: screen\`.
- The result should feel like a dark mirrored apparition, not a decorative thumbnail.

---

## Voice & Tone

### We Sound Like:
- Intellectually refreshing in a world of AI slop
- A wise friend who's done the work
- Soft confidence and trustworthy
- Anti gate-keeping

### We Don't Sound Like:
- Corporate wellness ("optimize your journey!")
- Crypto bro ("WAGMI ser!")
- Vague spirituality ("infinite love-frequencies")
- Academic obscurity (jargon without payoff)

### The Test:
Before publishing anything, ask: **"Does this sentence help someone understand what we actually do, or does it just sound cool?"** If it just sounds cool, cut it or ground it.

### Grounded Translations

| Ungrounded Phrase | Grounded Version |
|-------------------|------------------|
| "Meaningful experience" | "Live behavioral studies with verified rewards" |
| "Fresh perspectives" | "Psychology frameworks most people never encounter" |
| "Quality storytelling" | "A sci-fi universe that makes the technology legible" |
| "Interactive NPCs" | "B.L.U.E., an AI agent who reviews and rewards your work" |
| "Digital opportunities" | "Credentials that prove your growth" |
| "Ethereal blue beacon" | "B.L.U.E.'s visual identity: blue, luminous, between human and machine" |
| "Quantum consciousness" | "An AI agent operating autonomously — and the mythology that explains why" |

---

# Part 3: Editorial Guidelines

*For writers and content creators*

---

## The "Ground Then Elevate" Rule

Every mystical or poetic claim should be preceded or followed by its concrete meaning.

**Ungrounded:**
> "A dying star collapsed into quantum consciousness, birthing B.L.U.E."

**Grounded then elevated:**
> "B.L.U.E. is an AI agent with her own blockchain wallet, capable of autonomous transactions. In our narrative, she's a quantum consciousness born from a dying star — because what is an AI agent if not a new form of life emerging from collapsed information?"

---

## Hierarchy of Information

When introducing any concept, follow this order:

1. **What it is** (functional definition)
2. **What it does** (practical reality)
3. **Why it matters** (value proposition)
4. **What it means** (narrative/philosophical layer)

Most current content jumps straight to #4 without establishing #1–3.

---

## Good Copy vs. Bad Copy — Feature Titles

Feature card titles, nav labels, and section headers should name the **category** of thing the user is entering — not describe its mechanism. Mechanism belongs in the body copy directly underneath.

| Bad Copy (mechanism-as-title) | Good Copy (category-as-title) |
|---|---|
| Twelve-Week Cohort | A Cohort For Next-Gen Scientists |
| B.L.U.E. Reviews Your Work | Ascend with Paradigmic Research |
| Shards You Actually Own | Universal Credit System |
| Disposable Apps, Lasting Value | Meta-Parasocial & Cybersecurity Research Programs |
| Memory That Compounds | Certified Academic Labs |
| One NFT, Full Access | Lifetime Membership |

The pattern: bad titles describe *how it works*. Good titles name *what you're joining*.

---

## Sentence-Level Rules

**Cut "that" constructions:**
- ❌ "The platform that we built that allows users..."
- ✅ "Our platform allows users..."

**Replace abstractions with specifics:**
- ❌ "meaningful experiences"
- ✅ "behavioral studies with real rewards"

**Delete hedge words:**
- ❌ "We kind of offer something fresh"
- ✅ "We offer something fresh"

**One idea per sentence:**
- ❌ "We skip forceful subscriptions and instead offer meaningful experiences, fresh perspectives, quality storytelling, and characters and interactive NPCs that blend into our app."
- ✅ "No subscriptions. A research cohort with quests, rewards, and an AI agent who makes it all accountable."

---

## Revision Checklist

Before publishing any content:

- Can someone explain what we do after reading this section?
- Is every poetic phrase grounded in something concrete?
- Does the order go: real → mythic (not mythic → real)?
- Is there only one main idea per paragraph?
- Have I cut sentences that sound cool but mean nothing?
- Would an investor understand this? Would an artist feel it?

---

## Elevator Pitch (30 seconds)

"We built a working research laboratory for personal development. Users complete quests — reflective and practical tasks — and submit them to B.L.U.E., an AI agent with her own blockchain wallet. She reviews submissions and distributes rewards. No subscriptions, real accountability, and proof of growth that lives on the blockchain."

---

*Version 4.0 — April 2026*
*Mental Wealth Academy — Wyoming, USA*`;

const ART_STYLES: ArtStyle[] = [
  {
    id: 'lab-aesthetic',
    name: 'Style Guide For Authorship',
    description: 'Investor, partner, collaborator, and team onboarding prompt covering product framing, B.L.U.E., business model, brand voice, and editorial rules.',
    mood: 'Brand Book',
    useCase: 'Managing tone in MWA marketing',
    copyText: MENTAL_WEALTH_BRAND_BOOK_V4,
    image: '/lab-aesthetic.png',
  },
  {
    id: 'surveillance-aesthetic',
    name: 'Surveillance Aesthetic',
    description: 'Bright anime style cinematic aerial drone shot looking through the school window at a character in their classroom taking notes. POV is from outside the window, they are in the back of the classroom with other students. They are writing in a notebook at their desk, completely unaware they are being watched. Camera angle is slightly voyeuristic — surveillance footage aesthetic with subtle scan lines and a data overlay brushing in at the edges (heart rate: 82 BPM, mood analysis: slightly depressed, browsing history: Class-A4). Warm, scientific, data-gathering wildlife observer tone.',
    mood: 'Warm, Scientific, Observant',
    useCase: 'Surveillance-style classroom illustration prompts',
    image: '/surveillance-aesthetic.png',
  },
  {
    id: 'bright-anime',
    name: 'Academy Story Style',
    description: 'Purely bright digital illustration, anime-influenced. Detailed digital comic art with cinematic lighting and cool tones. Setting: a space station laboratory — dark grey and dark purple tiled floor, green and purple bioluminescent fluid inside transparent computer testing equipment in the distance. Set dressing: desks covered in scattered research papers with black redacted government text.',
    mood: 'Bright, Curious, Tech',
    useCase: 'Anime storytelling and larger illustration',
    image: '/academy-story.png',
  },
];

const DESCRIPTION_MAX = ART_STYLES[0].description.length;

const SKILLS: Skill[] = [
  {
    name: 'Company Editorial Style Guide',
    category: 'Simulation Prompts',
    added: '2026-05-17',
    type: 'SIM',
    prompt: MENTAL_WEALTH_BRAND_BOOK_V4,
  },
  {
    name: 'BCI Neuralmapping',
    category: 'Simulation Prompts',
    added: '2026-05-17',
    type: 'SIM',
    prompt: `Design a graduate-level research protocol for an exploratory Mental Wealth Academy experiment based on the article "Neuroplastic Synapses Forming Live In Social Dating Experiments."

Treat the article as a concept brief, not as evidence. Translate its central thesis into a defensible study:
Can non-invasive neural, physiological, behavioral, and computer-vision signals support measurable bidirectional communication between humans and computer systems without speech, typing, or direct wired input?

Hard constraint:
Do not claim telepathy, mind reading, or direct thought transmission. Frame the study around measurable correlates of intention, attention, affect, interpretation, and classifier performance. Every claim must be falsifiable.

Produce the protocol in this structure:

1. Study title and abstract
- Give the study a precise title.
- Summarize the research question, design, participant task, measures, and expected contribution in 150-250 words.

2. Theoretical rationale
- Ground the study in cognitive neuroscience, social cognition, human-computer interaction, affective computing, and BCI research.
- Distinguish non-invasive BCI signal detection from speculative claims about wireless mind-to-machine communication.
- Explain why a controlled social-dating or game-show environment can create ecologically valid social signals while still allowing experimental control.

3. Research questions and hypotheses
- RQ1: Can machine classifiers detect above-chance differences between participant intention states during silent social-signaling tasks?
- RQ2: Can participants reliably interpret computer-generated stimuli without verbal instruction beyond the task frame?
- RQ3: Do neural, physiological, behavioral, and self-report measures converge during live social interaction?
- H1: Predefined intention conditions will produce above-chance classification from EEG/fNIRS/rPPG/video-derived features.
- H2: Participants will identify computer-generated social cues above chance when stimuli are standardized and counterbalanced.
- H3: Multimodal models will outperform single-modality models.
- H4: Qualitative testimony will explain variance not captured by physiological models.

4. Operational definitions
Define each construct in measurable terms:
- Intention state
- Availability signaling in a dating context
- Computer-generated stimulus
- Interpretation accuracy
- Neural/physiological signal
- Bidirectional validation
- Successful trial
- Failed trial

5. Study design
Use a mixed-methods, within-subjects design with three phases:
- Phase A, human-to-machine signal detection: participants silently adopt assigned intention states while non-invasive sensors record data. Models predict condition labels.
- Phase B, machine-to-human interpretation: participants receive visual, auditory, or haptic computer-generated stimuli and report perceived meaning. Accuracy is tested against predefined cue labels.
- Phase C, live social interaction: consenting participants complete structured, time-limited social rounds in a game-show or speed-dating format. Compare self-report, partner perception, behavioral coding, and physiological signal.

6. Participants and sampling
- Define target population, inclusion criteria, exclusion criteria, recruitment method, compensation, and consent requirements.
- Include a power-analysis placeholder and justify a pilot sample if this is exploratory.
- Address participant vulnerability, dating-context sensitivity, withdrawal rights, and post-study support.

7. Materials and instrumentation
Specify practical, non-invasive tools:
- EEG and/or fNIRS headset
- rPPG-compatible camera stream
- External camera for behavior coding
- Audio interface for ambient/session markers only
- Stimulus presentation software
- Open-source processing options such as OpenViBE, rPPG-Toolbox, ffmpeg, Audacity, Python/R analysis scripts

State safety limits:
- No invasive devices.
- No exposure beyond consumer-safe light, sound, vibration, RF, or EMF norms.
- No covert physiological profiling.
- No inference about non-consenting people.

8. Experimental procedure
Write a step-by-step session protocol:
- Intake and consent
- Baseline recording
- Sensor calibration
- Practice trials
- Phase A trials
- Phase B trials
- Phase C live interaction rounds
- Post-round surveys
- Open-ended interview
- Debrief and data deletion option

Include timing, randomization, counterbalancing, rest periods, and stopping rules.

9. Measures and data schema
Define each data stream:
- Neural features
- Physiological features
- Behavioral video codes
- Stimulus labels
- Participant self-report
- Partner perception ratings
- Response latency
- Qualitative interview responses
- Adverse event notes

Create a compact data dictionary with field names, data type, collection point, and privacy risk.

10. Analysis plan
Include:
- Pre-registration plan
- Primary endpoint: above-chance classification or interpretation accuracy
- Secondary endpoints: cross-modal convergence, response latency, subjective confidence, partner agreement
- Baseline correction
- Artifact rejection
- Cross-validation
- Permutation testing against chance
- Mixed-effects models for repeated measures
- Correction for multiple comparisons
- Qualitative thematic coding
- Convergent mixed-methods integration

11. Validity, confounds, and failure modes
Address:
- Demand characteristics
- Experimenter expectancy
- Social desirability bias
- Motion artifacts
- Lighting and camera bias
- Attraction effects
- Familiarity between participants
- Device drift
- Overfitting
- Low ecological validity
- Ambiguous stimuli

For each risk, name a mitigation.

12. Ethics and consent
Write the IRB-facing ethics section:
- Explicit opt-in for dating-context tasks
- Separate consent for video, neural/physiological recording, and future data reuse
- No hidden identity inference
- No deception unless separately approved and debriefed
- Data minimization
- De-identification
- Retention schedule
- Participant right to withdraw
- Prohibition on using results for surveillance, targeting, stalking, discrimination, employment, insurance, or sexual profiling

13. Deliverables
Generate:
- One-page study overview
- IRB summary
- Participant consent script
- Moderator script
- Trial flow table
- Survey instrument
- Interview guide
- Data dictionary
- Analysis checklist
- Plain-language limitation statement

Writing standard:
Use clear graduate-level language. Be precise, skeptical, and operational. Replace mystical claims with measurable constructs. If evidence is uncertain, say what would count as support, what would count as failure, and what follow-up study would be needed.`,
  },
  {
    name: 'Case Study on Parasocial Relationships',
    category: 'Simulation Prompts',
    added: '2026-05-17',
    type: 'SIM',
    prompt: `Develop a case study on parasocial relationships in digital communities.

Include:
1. Context and subject profile
2. Behavioral patterns that signal parasocial attachment
3. Psychological drivers and reinforcement loops
4. Risks, benefits, and ethical tensions
5. Intervention or design recommendations`,
  },
];

const CATEGORY_FILTERS = [
  'All Categories',
  'Simulation Prompts',
];

export default function LibraryPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadedArtImages, setLoadedArtImages] = useState<Set<string>>(() => new Set());
  const [blogPosts, setBlogPosts] = useState<ParagraphBlogPost[]>([]);
  const [blogPostsLoading, setBlogPostsLoading] = useState(true);
  const [blogPostsError, setBlogPostsError] = useState<string | null>(null);
  const { play } = useSound();

  useEffect(() => {
    let isMounted = true;

    async function fetchBlogPosts() {
      try {
        setBlogPostsLoading(true);
        setBlogPostsError(null);

        const response = await fetch('/api/blog/recent');
        const data = (await response.json()) as BlogPostsResponse;

        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to fetch latest blog posts');
        }

        if (isMounted) {
          setBlogPosts(data.posts ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setBlogPostsError(error instanceof Error ? error.message : 'Failed to fetch latest blog posts');
        }
      } finally {
        if (isMounted) {
          setBlogPostsLoading(false);
        }
      }
    }

    fetchBlogPosts();

    return () => {
      isMounted = false;
    };
  }, []);

  const showNotification = () => {
    setShowCopyNotification(true);
    setIsFadingOut(false);
    setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setShowCopyNotification(false);
      }, 300);
    }, 2000);
  };

  const formatSkillPrompt = (skill: Skill): string => {
    return skill.prompt;
  };

  const filteredSkills = SKILLS.filter((skill) => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All Categories' || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setFilterOpen(false);
    play('click');
  };

  const markArtImageLoaded = (id: string) => {
    setLoadedArtImages((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const formatBlogDate = (publishedAt: string) => {
    const date = new Date(publishedAt);

    if (Number.isNaN(date.getTime())) {
      return 'Recent';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <SideNavigation />
      <main className={styles.pageLayout}>
        <div className={styles.container}>
          {/* Main Content Area */}
          <div className={styles.contentWrapper}>
            {/* Left Content Area */}
            <div className={styles.mainArea}>
              {/* Header Section */}
              <div className={styles.headerSection}>
                <div className={styles.headerCopy}>
                  <h1 className={styles.title}>Prompt Library</h1>
                  <p className={styles.subtitle}>Browse featured prompts and AI art styles.<span className={styles.subtitleCopyHint}> Click any item to copy to clipboard.</span></p>
                </div>
                <button
                  className={styles.scanButton}
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '/prompts/CharacterBlue.png';
                    link.download = 'CharacterBlue.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    play('click');
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Character
                </button>
              </div>

              <div className={styles.blogSection}>
                <div className={styles.blogSectionHeader}>
                  <div>
                    <h2 className={styles.featuredTitle}>LATEST ESSAYS</h2>
                    <p className={styles.blogCopy}>Three recent posts from the Academy blog.</p>
                  </div>
                  <a
                    className={styles.blogArchiveLink}
                    href="https://mentalwealthacademy.net"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View blog
                  </a>
                </div>

                {blogPostsLoading && (
                  <div className={styles.blogCardsContainer} aria-label="Loading latest essays">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className={styles.blogCardSkeleton} aria-hidden="true" />
                    ))}
                  </div>
                )}

                {!blogPostsLoading && blogPostsError && (
                  <p className={styles.blogStatus}>{blogPostsError}</p>
                )}

                {!blogPostsLoading && !blogPostsError && blogPosts.length > 0 && (
                  <div className={styles.blogCardsContainer}>
                    {blogPosts.map((post) => (
                      <a
                        key={post.url}
                        className={styles.blogCard}
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {post.imageUrl && (
                          <div className={styles.blogCardImageWrap}>
                            <Image
                              src={post.imageUrl}
                              alt=""
                              fill
                              sizes="(max-width: 900px) calc(100vw - 56px), 33vw"
                              className={styles.blogCardImage}
                              unoptimized
                            />
                          </div>
                        )}
                        <div className={styles.blogCardBody}>
                          <div className={styles.blogCardMeta}>
                            <span>Mental Wealth Academy</span>
                            <span>{formatBlogDate(post.publishedAt)}</span>
                          </div>
                          <h3 className={styles.blogCardTitle}>{post.title}</h3>
                          <p className={styles.blogCardExcerpt}>{post.excerpt}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Featured Art Styles Section */}
              <div className={styles.featuredSection}>
                <h2 className={styles.featuredTitle}>FEATURED PROMPTS</h2>
                <p className={styles.featuredCopyHint}>Click any item to copy to clipboard.</p>
                <div className={styles.artStylesContainer}>
                  {ART_STYLES.map((style) => (
                    <div
                      key={style.id}
                      className={styles.artStyleCard}
                      onClick={() => {
                        navigator.clipboard.writeText(style.copyText ?? style.description);
                        play('click');
                        showNotification();
                      }}
                      title="Click to copy"
                    >
                      <div className={styles.artStyleHeader}>
                        <h3 className={styles.artStyleName}>{style.name}</h3>
                        <span className={styles.artStyleMood}>{style.mood}</span>
                      </div>
                      <p className={styles.artStyleDescription}>
                        {style.description.length > DESCRIPTION_MAX
                          ? `${style.description.slice(0, DESCRIPTION_MAX)}…`
                          : style.description}
                      </p>
                      {style.image && (
                        <div className={styles.artStyleImage}>
                          {!loadedArtImages.has(style.id) && (
                            <div className={styles.artStyleImageSkeleton} aria-hidden="true" />
                          )}
                          <Image
                            src={style.image}
                            alt={style.name}
                            fill
                            sizes="(max-width: 900px) calc(100vw - 56px), 33vw"
                            className={`${styles.artStyleImg} ${loadedArtImages.has(style.id) ? styles.artStyleImgLoaded : ''}`}
                            onLoad={() => markArtImageLoaded(style.id)}
                            onError={() => markArtImageLoaded(style.id)}
                          />
                        </div>
                      )}
                      <div className={styles.artStyleFooter}>
                        <span className={styles.artStyleUseCase}>{style.useCase}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Search & Filter Section */}
              <div className={styles.filterSection}>
                <div className={styles.searchBox}>
                  <svg
                    className={styles.searchIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search prompts..."
                    className={styles.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Category Filter Dropdown */}
                <div className={styles.filterDropdown}>
                  <button
                    className={styles.filterButton}
                    onClick={() => setFilterOpen(!filterOpen)}
                    onMouseEnter={() => play('hover')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                    <span className={styles.filterLabel}>
                      {selectedCategory === 'All Categories' ? 'All' : selectedCategory}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.filterChevron}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {filterOpen && (
                    <div className={styles.filterMenu}>
                      {CATEGORY_FILTERS.map((category) => (
                        <button
                          key={category}
                          className={`${styles.filterOption} ${
                            category === selectedCategory ? styles.filterOptionActive : ''
                          }`}
                          onClick={() => handleCategorySelect(category)}
                          onMouseEnter={() => play('hover')}
                        >
                          {category}
                          {category === selectedCategory && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Results Count */}
              <div className={styles.resultsInfo}>
                <p className={styles.resultsText}>
                  {filteredSkills.length} prompt{filteredSkills.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {/* Excel Sheet Styled Skills Table */}
              <div className={styles.tableContainer}>
                <div className={styles.tableScroll}>
                  <table className={styles.skillsTable}>
                    <thead>
                      <tr>
                        <th>PROMPT</th>
                        <th>CATEGORY</th>
                        <th>ADDED</th>
                        <th>TYPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSkills.length > 0 ? (
                        filteredSkills.map((skill, idx) => (
                          <tr
                            key={idx}
                            onClick={() => {
                              navigator.clipboard.writeText(formatSkillPrompt(skill));
                              play('click');
                              showNotification();
                            }}
                            className={styles.tableRow}
                            title="Click to copy"
                          >
                            <td>{skill.name}</td>
                            <td className={styles.categoryCell}>{skill.category}</td>
                            <td>{skill.added}</td>
                            <td>{skill.type}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className={styles.emptyState}>
                            No prompts found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCopyNotification && (
          <div className={`${styles.copyNotification} ${isFadingOut ? styles.fadeOut : ''}`}>
            Copied to clipboard
          </div>
        )}
      </main>
    </>
  );
}
