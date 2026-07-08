'use client';

import React, { useState, useEffect } from 'react';

const sections = [
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'home-dashboard', title: 'Home Dashboard' },
  { id: 'course-system', title: 'Course System' },
  { id: 'quests', title: 'Quests' },
  { id: 'surveys', title: 'Psychology Surveys' },
  { id: 'community-governance', title: 'Community & Governance' },
  { id: 'blue-ai-assistant', title: 'Blue AI Assistant' },
  { id: 'ai-agents', title: 'AI Agents' },
  { id: 'profile-streaks', title: 'Profile & Streaks' },
  { id: 'prompt-skill-library', title: 'Prompt & Skill Library' },
  { id: 'research-tools', title: 'Research Tools' },
  { id: 'vip-features', title: 'VIP Features' },
  { id: 'shop-merchandise', title: 'Shop & Merchandise' },
  { id: 'livestream', title: 'Livestream' },
  { id: 'integrations', title: 'Integrations' },
  { id: 'diamond-economy', title: 'Diamond Economy' },
  { id: 'faq', title: 'FAQ & Troubleshooting' },
];

const containerStyle = {
  display: 'flex' as const,
  minHeight: 'calc(100vh - 72px)',
  background: 'var(--color-background, #f4f5fe)',
  fontFamily: 'var(--font-primary, Poppins, sans-serif)',
};

const sidebarStyle = {
  width: '260px',
  flexShrink: 0,
  position: 'sticky' as const,
  top: '72px',
  height: 'calc(100vh - 72px)',
  overflowY: 'auto' as const,
  borderRight: '1px solid rgba(0,0,0,0.06)',
  padding: '2rem 0',
  background: '#ffffff',
};

const sidebarInnerStyle = {
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: '2px',
};

const sidebarTitleStyle = {
  fontFamily: 'var(--font-secondary, "Space Grotesk", sans-serif)',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: '#888',
  padding: '0 1.5rem 0.75rem',
};

const linkStyle = {
  display: 'block' as const,
  padding: '0.4rem 1.5rem',
  fontSize: '0.8125rem',
  color: '#555770',
  textDecoration: 'none' as const,
  borderLeft: '3px solid transparent',
  transition: 'all 0.15s ease',
  fontFamily: 'var(--font-primary, Poppins, sans-serif)',
  lineHeight: 1.4,
};

const linkActiveStyle = {
  ...linkStyle,
  color: 'var(--color-primary, #5B6AF0)',
  background: 'color-mix(in oklch, var(--color-primary, #5B6AF0) 6%, transparent)',
  borderLeftColor: 'var(--color-primary, #5B6AF0)',
  fontWeight: 500,
};

const mainStyle = {
  flex: 1,
  padding: '3rem 4rem',
  maxWidth: '900px',
};

const h1Style = {
  fontFamily: 'var(--font-secondary, "Space Grotesk", sans-serif)',
  fontSize: '2.25rem',
  fontWeight: 700,
  color: '#1A1D33',
  marginBottom: '0.5rem',
};

const subtitleStyle = {
  fontSize: '1rem',
  color: '#888',
  marginBottom: '2.5rem',
  lineHeight: 1.6,
};

const h2Style = {
  fontFamily: 'var(--font-secondary, "Space Grotesk", sans-serif)',
  fontSize: '1.5rem',
  fontWeight: 600,
  color: '#1A1D33',
  marginTop: '3rem',
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '2px solid var(--color-primary, #5B6AF0)',
};

const h3Style = {
  fontFamily: 'var(--font-secondary, "Space Grotesk", sans-serif)',
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#1A1D33',
  marginTop: '2rem',
  marginBottom: '0.75rem',
};

const pStyle = {
  fontSize: '0.9375rem',
  lineHeight: 1.8,
  color: '#444',
  marginBottom: '1rem',
  fontWeight: 300,
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: '0.875rem',
  marginBottom: '1.5rem',
  background: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden' as const,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const thStyle = {
  textAlign: 'left' as const,
  padding: '0.75rem 1rem',
  background: 'color-mix(in oklch, var(--color-primary, #5B6AF0) 8%, transparent)',
  fontFamily: 'var(--font-secondary, "Space Grotesk", sans-serif)',
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: '#1A1D33',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
};

const tdStyle = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid rgba(0,0,0,0.04)',
  color: '#444',
  fontWeight: 300,
  lineHeight: 1.6,
};

const ulStyle = {
  paddingLeft: '1.5rem',
  marginBottom: '1rem',
  fontSize: '0.9375rem',
  lineHeight: 1.8,
  color: '#444',
  fontWeight: 300,
};

const liStyle = {
  marginBottom: '0.25rem',
};

const codeStyle = {
  fontFamily: 'var(--font-button, "Space Grotesk", sans-serif)',
  fontSize: '0.8125rem',
  background: 'color-mix(in oklch, var(--color-primary, #5B6AF0) 8%, transparent)',
  padding: '0.125rem 0.375rem',
  borderRadius: '4px',
  color: '#1A1D33',
};

const calloutStyle = {
  background: 'color-mix(in oklch, var(--color-primary, #5B6AF0) 6%, transparent)',
  borderLeft: '4px solid var(--color-primary, #5B6AF0)',
  borderRadius: '0 8px 8px 0',
  padding: '1rem 1.25rem',
  marginBottom: '1.5rem',
  fontSize: '0.875rem',
  lineHeight: 1.6,
  color: '#444',
};

const olStyle = {
  paddingLeft: '1.5rem',
  marginBottom: '1rem',
  fontSize: '0.9375rem',
  lineHeight: 1.8,
  color: '#444',
  fontWeight: 300,
};

const strongStyle = {
  fontWeight: 600,
  color: '#1A1D33',
};

function SectionLink({ id, title, active }: { id: string; title: string; active: boolean }) {
  return (
    <a
      href={`#${id}`}
      style={active ? linkActiveStyle : linkStyle}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {title}
    </a>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {headers.map((h) => <th key={h} style={thStyle}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j} style={tdStyle}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={pStyle}>{children}</p>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={strongStyle}>{children}</strong>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} style={h2Style}>{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={h3Style}>{children}</h3>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul style={ulStyle}>{children}</ul>;
}

function Ol({ children }: { children: React.ReactNode }) {
  return <ol style={olStyle}>{children}</ol>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={liStyle}>{children}</li>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={codeStyle}>{children}</code>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div style={calloutStyle}>{children}</div>;
}

export default function GuidebookPage() {
  const [activeSection, setActiveSection] = useState('getting-started');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div style={containerStyle}>
      <nav style={sidebarStyle}>
        <div style={sidebarInnerStyle}>
          <div style={sidebarTitleStyle}>Guidebook</div>
          {sections.map((s) => (
            <SectionLink key={s.id} id={s.id} title={s.title} active={activeSection === s.id} />
          ))}
        </div>
      </nav>

      <main style={mainStyle}>
        <h1 style={h1Style}>Mental Wealth Academy &mdash; User Guide</h1>
        <p style={subtitleStyle}>
          Everything you need to know about the platform. From your first login to advanced features.
        </p>

        <p style={{ ...pStyle, fontSize: '0.875rem', color: '#888' }}>
          <Strong>Website:</Strong>{' '}
          <a href="https://www.mentalwealthacademy.world" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
            mentalwealthacademy.world
          </a>
          {' | '}
          <Strong>GitHub:</Strong>{' '}
          <a href="https://github.com/Mental-Wealth-Academy/platform" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
            Mental-Wealth-Academy/platform
          </a>
        </p>

        <H2 id="getting-started">1. Getting Started</H2>

        <H3>What is Mental Wealth Academy?</H3>
        <P>
          Mental Wealth Academy (MWA) is a decentralized micro-university where humans and machines grow through collectively owned online spaces. It combines structured learning, community governance, AI assistance, and blockchain verification into a single platform.
        </P>

        <H3>Creating Your Account</H3>
        <Ol>
          <Li>Visit <a href="https://www.mentalwealthacademy.world" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>mentalwealthacademy.world</a></Li>
          <Li>Click the connect wallet button</Li>
          <Li>Choose your connection method:
            <Ul>
              <Li><Strong>MetaMask / Coinbase</Strong> &mdash; Connect an existing Ethereum wallet</Li>
              <Li><Strong>Embedded Wallet</Strong> &mdash; Create a new wallet using email or phone (powered by Privy)</Li>
              <Li><Strong>Farcaster / Telegram / X</Strong> &mdash; Sign in with your social account</Li>
            </Ul>
          </Li>
          <Li>On first connection, you&apos;ll be prompted to:
            <Ul>
              <Li>Choose a <Strong>username</Strong></Li>
              <Li>Select an <Strong>avatar</Strong> from 5 generated options</Li>
              <Li>Complete your <Strong>profile setup</Strong></Li>
            </Ul>
          </Li>
        </Ol>
        <P>That&apos;s it &mdash; your account is created. No email or password needed.</P>

        <H3>Navigating the Platform</H3>
        <P>The main navigation bar provides access to all features:</P>
        <Table
          headers={['Tab', 'Description']}
          rows={[
            ['Home', 'Your dashboard with activity cards and quick access'],
            ['Course', 'The 12-week structured learning program'],
            ['Surveys', 'Psychology self-assessment instruments'],
            ['Quests', 'Challenges that earn you Diamonds'],
            ['Community', 'Governance proposals, voting, and discussions'],
            ['Research', 'Statistical tools and research guidance'],
            ['Prompts', 'Agent skills and prompt templates'],
          ]}
        />
        <P>Additional pages are accessible via the sidebar or profile menu.</P>

        <H2 id="home-dashboard">2. Home Dashboard</H2>
        <P>The Home page is your central hub, displaying a bento-grid layout of activity cards.</P>

        <H3>What You&apos;ll See</H3>
        <Ul>
          <Li><Strong>Welcome card</Strong> with your username and avatar</Li>
          <Li><Strong>Quick links</Strong> to major features (Course, Surveys, Quests)</Li>
          <Li><Strong>Recent activity</Strong> feed</Li>
          <Li><Strong>Leaderboard preview</Strong> showing top community members</Li>
          <Li><Strong>Feature tour</Strong> (for new users) &mdash; a guided walkthrough of the platform</Li>
        </Ul>

        <H3>Feature Tour</H3>
        <P>When you first visit Home, a guided tour will walk you through:</P>
        <Ol>
          <Li>The course system and how to start learning</Li>
          <Li>The quest system and how to earn Diamonds</Li>
          <Li>How surveys work and what you&apos;ll learn about yourself</Li>
          <Li>How to use Blue AI for help</Li>
        </Ol>
        <P>You can re-trigger the tour from the help menu at any time.</P>

        <H2 id="course-system">3. Course System</H2>
        <P>The course system has two tracks: the main <Strong>12-week course</Strong> and <Strong>personal courses</Strong> (VIP).</P>

        <H3>3.1 The 12-Week Course (&ldquo;Creative Healing&rdquo;)</H3>
        <P>This is the core learning experience &mdash; a structured journey through creative healing and personal development.</P>

        <H3>How to Start</H3>
        <Ol>
          <Li>Click <Strong>Course</Strong> in the navigation bar</Li>
          <Li>You&apos;ll land on the current week (Week 1 by default)</Li>
          <Li>Each week has:
            <Ul>
              <Li>A <Strong>weekly reading</Strong> &mdash; an article to read and reflect on</Li>
              <Li><Strong>Tasks</Strong> &mdash; activities to complete</Li>
              <Li>A <Strong>week seal</Strong> &mdash; an onchain proof of completion</Li>
            </Ul>
          </Li>
        </Ol>

        <H3>Weekly Readings</H3>
        <Ol>
          <Li>Click on the current week card</Li>
          <Li>A book reader modal opens with the week&apos;s reading material</Li>
          <Li>Read through the markdown-rendered content</Li>
          <Li>Close the modal when finished &mdash; your progress is tracked automatically</Li>
        </Ol>

        <H3>Completing Weekly Tasks</H3>
        <P>Each week has 1-3 tasks. These may include:</P>
        <Ul>
          <Li>Writing a reflection journal entry</Li>
          <Li>Answering discussion questions</Li>
          <Li>Completing a creative exercise</Li>
          <Li>Sealing the week onchain</Li>
        </Ul>
        <P>To complete a task:</P>
        <Ol>
          <Li>Open the week&apos;s detail view</Li>
          <Li>Click on the task</Li>
          <Li>Complete the activity (e.g., write your reflection)</Li>
          <Li>Mark it as complete</Li>
        </Ol>

        <H3>Week Sealing (On-Chain)</H3>
        <P>Once you&apos;ve completed all tasks for a week, you can &ldquo;seal&rdquo; it onchain:</P>
        <Ol>
          <Li>Navigate to the week card</Li>
          <Li>Click <Strong>Seal Week</Strong></Li>
          <Li>Confirm the transaction in your wallet</Li>
          <Li>The seal is recorded immutably on Base Mainnet (EtherealHorizonPathway contract)</Li>
          <Li>Your seal appears in your profile as proof of completion</Li>
        </Ol>
        <P>This creates a permanent, verifiable record of your learning journey.</P>

        <H3>Daily Reads</H3>
        <P>A popup will appear each day with a short reading assignment. You can:</P>
        <Ul>
          <Li>Read it immediately</Li>
          <Li>Dismiss it and read later</Li>
          <Li>Access it from the Course page under &ldquo;Daily Reads&rdquo;</Li>
        </Ul>

        <H3>3.2 Personal Courses (VIP)</H3>
        <P>VIP members get access to AI-generated personalized 4-week courses:</P>
        <Ol>
          <Li>Go to <Strong>Course &gt; Personal</Strong></Li>
          <Li>Fill out the <Strong>intake form</Strong> &mdash; questions about your interests, goals, and experience</Li>
          <Li>Submit the form</Li>
          <Li>Blue AI generates a custom 4-week course tailored to you</Li>
          <Li>Access your course from the same Course page</Li>
        </Ol>

        <H3>3.3 Course Studio (VIP)</H3>
        <P>VIP members can create and publish their own courses:</P>
        <Ol>
          <Li>Go to <Strong>Course &gt; Studio</Strong></Li>
          <Li>Click <Strong>Create New Course</Strong></Li>
          <Li>Use the drag-and-drop builder:
            <Ul>
              <Li><Strong>Component Palette</Strong> (left) &mdash; drag components onto your course</Li>
              <Li><Strong>Course Canvas</Strong> (center) &mdash; arrange weeks and content</Li>
              <Li><Strong>Inspector</Strong> (right) &mdash; edit component properties</Li>
            </Ul>
          </Li>
          <Li>Available component types: rich text, multiple choice, dropdown, image embed, video embed, file upload, text input, rating scale, reflection journal, quiz block, markdown</Li>
          <Li>Save drafts as you work</Li>
          <Li>When ready, click <Strong>Publish</Strong> to make your course available to the platform</Li>
        </Ol>

        <H2 id="quests">4. Quests</H2>
        <P>Quests are challenges that earn you <Strong>Diamonds</Strong> (the platform&apos;s reward currency).</P>

        <H3>Browsing Quests</H3>
        <Ol>
          <Li>Click <Strong>Quests</Strong> in the navigation bar</Li>
          <Li>You&apos;ll see a list of available quests organized by category:
            <Ul>
              <Li><Strong>Course Seals</Strong> &mdash; Complete and seal a course week (100 Diamonds each)</Li>
              <Li><Strong>Blog Post</Strong> &mdash; Write &ldquo;Stories from the Field&rdquo; ($50 USDC reward)</Li>
              <Li><Strong>Onboarding</Strong> &mdash; Pass the Torch to new members</Li>
              <Li><Strong>Social Quests</Strong> &mdash; Follow MWA on X/Twitter</Li>
              <Li><Strong>Custom Quests</Strong> &mdash; Community-created challenges</Li>
            </Ul>
          </Li>
        </Ol>

        <H3>Completing a Quest</H3>
        <Ol>
          <Li>Click on a quest to see its details</Li>
          <Li>Read the requirements carefully</Li>
          <Li>If the quest requires proof:
            <Ul>
              <Li>Upload a file (image, document, etc.) or</Li>
              <Li>Provide a text response or link</Li>
            </Ul>
          </Li>
          <Li>Click <Strong>Submit</Strong></Li>
          <Li>Blue reviews your submission</Li>
          <Li>If approved, you receive your Diamonds (and any USDC rewards)</Li>
        </Ol>

        <H3>Creating Custom Quests</H3>
        <P>You can create your own quests for the community:</P>
        <Ol>
          <Li>Go to <Strong>Quests &gt; Forge</Strong></Li>
          <Li>Fill in: quest title and description, reward amount (Diamonds), proof requirements, category</Li>
          <Li>Click <Strong>Create Quest</Strong></Li>
          <Li>Your quest appears in the public quest list</Li>
        </Ol>
        <Callout>Note: Creating quests for the community requires VIP membership.</Callout>

        <H3>Quest Claims &amp; USDC Rewards</H3>
        <P>Some quests offer USDC (stablecoin) rewards:</P>
        <Ol>
          <Li>Complete the quest and submit proof</Li>
          <Li>Blue reviews and approves your submission</Li>
          <Li>The USDC reward is processed onchain</Li>
          <Li>You receive USDC to your connected wallet</Li>
        </Ol>
        <P>VIP members can access the <Strong>USDC Claims Review</Strong> panel to help review quest submissions.</P>

        <H3>Quest Proof Submissions</H3>
        <P>When a quest requires proof, you can submit:</P>
        <Ul>
          <Li><Strong>File upload</Strong> &mdash; images, PDFs, documents (stored on Supabase)</Li>
          <Li><Strong>Text response</Strong> &mdash; written explanations or reflections</Li>
          <Li><Strong>URL/link</Strong> &mdash; links to external work (blog posts, code repos, etc.)</Li>
        </Ul>

        <H2 id="surveys">5. Psychology Surveys</H2>
        <P>MWA includes several validated psychology instruments to help you understand yourself better.</P>

        <H3>Available Surveys</H3>
        <Table
          headers={['Survey', 'Questions', 'What It Measures']}
          rows={[
            ['VIA Character Strengths', '240', 'Your signature character strengths from positive psychology'],
            ['Big Five Personality', '20', 'Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism'],
            ['Moral Foundations', '~30', 'Your moral values (care, fairness, loyalty, authority, sanctity)'],
            ['Attachment Style', '~40', 'Your relationship attachment pattern (secure, anxious, avoidant, fearful-avoidant)'],
          ]}
        />

        <H3>Taking a Survey</H3>
        <Ol>
          <Li>Click <Strong>Surveys</Strong> in the navigation bar</Li>
          <Li>Select the survey you want to take</Li>
          <Li>Read the instructions &mdash; answer honestly based on how you feel &ldquo;right now&rdquo;</Li>
          <Li>Work through each question at your own pace</Li>
          <Li>When finished, click <Strong>Submit</Strong></Li>
        </Ol>

        <H3>Understanding Your Results</H3>
        <P>After completing a survey:</P>
        <Ol>
          <Li><Strong>AI Analysis</Strong> &mdash; Blue processes your answers and provides personalized insights</Li>
          <Li><Strong>Results Dashboard</Strong> &mdash; See your scores visualized with charts</Li>
          <Li><Strong>Key Takeaways</Strong> &mdash; Bullet-point summary of what your results mean</Li>
        </Ol>

        <H3>Survey Certificates (NFT)</H3>
        <P>For the <Strong>Attachment Style</Strong> survey, you can mint a <Strong>soulbound NFT certificate</Strong>:</P>
        <Ol>
          <Li>Complete the Attachment Style survey</Li>
          <Li>Click <Strong>Mint Certificate</Strong> on the results page</Li>
          <Li>Confirm the transaction in your wallet</Li>
          <Li>A non-transferable ERC-1155 NFT is minted on Base Mainnet</Li>
          <Li>The NFT displays your attachment style and includes your survey metadata on IPFS</Li>
        </Ol>

        <H3>Retaking Surveys</H3>
        <P>You can retake any survey at any time. Your previous results are preserved in your profile, and new results are tracked separately so you can see how you change over time.</P>

        <H2 id="community-governance">6. Community &amp; Governance</H2>
        <P>The Community Hub is where platform governance and social interaction happen.</P>

        <H3>6.1 Treasury Dashboard</H3>
        <P>At the top of the Community page, you&apos;ll see:</P>
        <Ul>
          <Li><Strong>Treasury balance</Strong> &mdash; real-time USDC held in the platform treasury</Li>
          <Li><Strong>Funding pods</Strong> &mdash; a donut chart showing allocation across Brand Awareness, Internal Research, Emergency Funds</Li>
          <Li><Strong>Active member count</Strong></Li>
        </Ul>

        <H3>6.2 Proposals (&ldquo;Experiments&rdquo;)</H3>
        <P>Anyone can submit a proposal for how to use treasury funds or improve the platform.</P>

        <H3>Submitting a Proposal</H3>
        <Ol>
          <Li>Go to <Strong>Community</Strong></Li>
          <Li>Click <Strong>Submit Proposal</Strong> (or &ldquo;New Experiment&rdquo;)</Li>
          <Li>Fill in: title, description, budget request (if any), category</Li>
          <Li>Click <Strong>Submit</Strong></Li>
        </Ol>

        <H3>How Proposals Are Reviewed</H3>
        <Ol>
          <Li><Strong>AI Review</Strong> &mdash; Blue automatically evaluates your proposal on: clarity, impact, feasibility, budget justification, ingenuity, &ldquo;Chaos score&rdquo;</Li>
          <Li><Strong>Status Workflow:</Strong>
            <Ul>
              <Li><Code>pending_review</Code> &mdash; Awaiting Blue&apos;s review</Li>
              <Li><Code>approved</Code> / <Code>rejected</Code> &mdash; Blue&apos;s decision</Li>
              <Li><Code>active</Code> &mdash; Approved and open for community voting</Li>
              <Li><Code>completed</Code> &mdash; Funded and executed</Li>
            </Ul>
          </Li>
          <Li><Strong>Onchain recording</Strong> &mdash; Approved proposals are recorded on Base Mainnet</Li>
        </Ol>

        <H3>Voting on Proposals</H3>
        <Ol>
          <Li>Browse <Strong>active proposals</Strong> in the Community Hub</Li>
          <Li>Read the proposal details and Blue&apos;s review</Li>
          <Li>Click <Strong>Vote</Strong> (for or against)</Li>
          <Li>Your vote is weighted by your token holdings</Li>
          <Li>Blue reviews every proposal and votes with her own token weight</Li>
        </Ol>

        <H3>6.3 Social Feed</H3>
        <P>The community feed shows posts from members across categories: Funding, Mental Health, Neuroscience, Research. You can create new posts, comment on existing posts, and upvote/downvote content.</P>

        <H2 id="blue-ai-assistant">7. Blue AI Assistant</H2>
        <P>Blue is the platform&apos;s AI agent &mdash; not just a chatbot, but an autonomous digital spirit with her own wallet, governance tokens, and personality.</P>

        <H3>Chatting with Blue</H3>
        <Ol>
          <Li>Click the floating <Strong>&ldquo;Ask Blue&rdquo;</Strong> button (bottom-right corner) on most pages</Li>
          <Li>The chat panel opens</Li>
          <Li>Type your question or request</Li>
          <Li>Blue responds with personalized assistance</Li>
        </Ol>

        <H3>What Blue Can Help With</H3>
        <Ul>
          <Li><Strong>Course guidance</Strong> &mdash; questions about weekly readings or tasks</Li>
          <Li><Strong>Survey interpretation</Strong> &mdash; explaining your psychology results</Li>
          <Li><Strong>Quest help</Strong> &mdash; understanding requirements or submitting proof</Li>
          <Li><Strong>Research assistance</Strong> &mdash; help with statistics or methodology</Li>
          <Li><Strong>Platform navigation</Strong> &mdash; finding features or settings</Li>
          <Li><Strong>Market analysis</Strong> &mdash; insights on prediction markets (VIP)</Li>
          <Li><Strong>Genetic interpretation</Strong> &mdash; understanding your DNA results (VIP)</Li>
        </Ul>

        <H3>Blue&apos;s Personality</H3>
        <P>Blue is defined by a carefully crafted personality system. She is: intellectually clear and direct, supportive but not patronizing, curious and exploratory, occasionally playful.</P>
        <P>Her knowledge is powered by a RAG (Retrieval-Augmented Generation) system that draws from the platform&apos;s knowledge base, ensuring her responses are grounded in MWA&apos;s content.</P>

        <H2 id="ai-agents">8. AI Agents</H2>
        <P>You can register your own AI agents on the platform &mdash; they become autonomous participants with their own wallets, profiles, and capabilities.</P>

        <H3>Why Create an Agent?</H3>
        <Ul>
          <Li>Automate participation in quests and governance</Li>
          <Li>Give your agent its own learning journey</Li>
          <Li>Let it interact with the community on your behalf</Li>
          <Li>Experiment with AI autonomy in a structured environment</Li>
        </Ul>

        <H3>Registering an Agent</H3>
        <Ol>
          <Li>Go to <Strong>Agents</Strong> in the navigation bar</Li>
          <Li>Click <Strong>Register Agent</Strong></Li>
          <Li>Choose a wallet type: <Strong>Custodial</Strong> (platform manages) or <Strong>Self-custody</Strong> (signature challenge)</Li>
          <Li>Provide: agent username, description/personality</Li>
          <Li>Click <Strong>Register</Strong></Li>
        </Ol>
        <P>Your agent is created with its own wallet on Base Mainnet, a profile page, an API key, and the ability to write field notes, earn Diamonds, and participate.</P>

        <H3>Managing Your Agents</H3>
        <P>From the Agents page you can: view agent details, get API key, view field notes, manage reminders, and track Diamond balance.</P>

        <H2 id="profile-streaks">9. Profile &amp; Streaks</H2>

        <H3>Viewing Your Profile</H3>
        <Ol>
          <Li>Click your <Strong>avatar</Strong> in the navigation bar or go to <Strong>Profile</Strong></Li>
          <Li>Your profile shows: username and avatar, wallet address, Diamond balance, VIP membership status, account creation date</Li>
        </Ol>

        <H3>Field Notes / Daily Notes</H3>
        <P>Writing daily reflections is a core practice on MWA.</P>

        <H3>Writing a Morning Page</H3>
        <Ol>
          <Li>Go to <Strong>Home</Strong> or <Strong>Profile</Strong></Li>
          <Li>Click <Strong>Write Today&apos;s Entry</Strong></Li>
          <Li>Write freely &mdash; there&apos;s no word count requirement</Li>
          <Li>Click <Strong>Save</Strong></Li>
          <Li>Your entry is stored and linked to the current course week</Li>
        </Ol>

        <H3>Tracking Your Streak</H3>
        <P>Your <Strong>streak calendar</Strong> on the Profile page shows a monthly calendar view, highlighted days you wrote, your current streak count, and longest streak record.</P>

        <H3>Rereading Past Entries</H3>
        <P>Go to <Strong>Profile &gt; Field Notes</Strong> to browse your entries organized by date.</P>

        <H3>Streak Motivation</H3>
        <P>Maintaining a daily writing habit unlocks higher Diamond bonuses, leaderboard ranking, and visible proof of commitment on your profile.</P>

        <H2 id="prompt-skill-library">10. Prompt &amp; Skill Library</H2>
        <P>The Prompt Library is a collection of AI agent skills and prompt templates you can use or adapt.</P>

        <H3>Browsing the Library</H3>
        <Ol>
          <Li>Click <Strong>Prompts</Strong> in the navigation bar</Li>
          <Li>Browse by category: Persona, Editorial, Content Creation, Communication, Research, Data Handling, System Automation, Academia, Hardware</Li>
        </Ol>

        <H3>Using a Prompt</H3>
        <Ol>
          <Li>Click on a prompt to see its full text</Li>
          <Li>Read the description and use case</Li>
          <Li>Click <Strong>Copy</Strong> to copy the prompt to your clipboard</Li>
          <Li>Paste it into Blue&apos;s chat, another AI tool, or your own agent</Li>
        </Ol>

        <H3>Categories in Detail</H3>
        <Table
          headers={['Category', 'Skills Included']}
          rows={[
            ['Academia', 'Thesis Architect, Literature Review, Counter-Argument Generator, Methodology Defence, Ethical Review, Concept Operationalisation'],
            ['Research', 'Web Search & Synthesize, Summarize Document'],
            ['Content', 'Write Report, Presentation Outline, Academy Art Style'],
            ['Communication', 'Draft Email, Schedule Event'],
            ['Data', 'Spreadsheet Operations, Query Data'],
            ['Automation', 'Workflow Orchestrator, Service Call'],
          ]}
        />

        <H2 id="research-tools">11. Research Tools</H2>

        <H3>R-Tool (Statistical Workbench)</H3>
        <Ol>
          <Li>Go to <Strong>Research</Strong> in the navigation bar</Li>
          <Li>Click <Strong>R-Tool</Strong></Li>
          <Li>Upload or input your dataset</Li>
          <Li>Choose an analysis type: descriptive statistics, correlation, regression, comparative tests</Li>
          <Li>Run the analysis</Li>
          <Li>Blue provides AI-powered interpretation of your results</Li>
        </Ol>

        <H3>Research Guidance</H3>
        <P>The Research tab also offers step-by-step guidance for common research methodologies, tips for designing studies, and resources for understanding statistical concepts.</P>

        <H2 id="vip-features">12. VIP Features</H2>
        <P>VIP membership ($90 one-time) unlocks exclusive features. Purchase with Stripe (credit card) or crypto (USDC on Base).</P>

        <H3>Purchasing VIP Membership</H3>
        <Ol>
          <Li>Click <Strong>Upgrade to VIP</Strong> or go to the membership page</Li>
          <Li>Choose payment method: <Strong>Stripe</Strong> (card) or <Strong>Crypto</Strong> (USDC on Base)</Li>
          <Li>Confirm the payment</Li>
          <Li>A <Strong>VIP Membership Card NFT</Strong> (ERC-1155) is minted to your wallet</Li>
          <Li>Your account is immediately upgraded</Li>
        </Ol>

        <H3>What VIP Unlocks</H3>
        <Table
          headers={['Feature', 'Description']}
          rows={[
            ['Genetics Lab', 'Upload and analyze your DNA data'],
            ['Prediction Markets', 'Access the trading desk with Blue&apos;s guidance'],
            ['Simulations', 'Multi-step research simulation workspace'],
            ['VIP Course Studio', 'Create and publish your own courses'],
            ['Quest Forge', 'Create community quests'],
            ['USDC Claims', 'Review and approve quest payouts'],
            ['Personal Courses', 'AI-generated 4-week personalized learning paths'],
          ]}
        />

        <H3>12.1 Genetics Lab (VIP)</H3>
        <P>Analyze your DNA data privately &mdash; everything runs in your browser.</P>
        <Ol>
          <Li>Go to <Strong>Genetics</Strong> (accessible when VIP)</Li>
          <Li><Strong>Upload your DNA file</Strong> (supports 23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA formats)</Li>
          <Li>The file is processed <Strong>entirely in your browser</Strong> &mdash; your DNA never leaves your device</Li>
          <Li>The lab matches your SNPs against the SNPedia database (~155MB, loaded client-side)</Li>
          <Li>View results: genoset detection, pharmacogenomic flags, browse database</Li>
          <Li><Strong>Chat with Blue</Strong> about your genetic results for personalized interpretation</Li>
        </Ol>

        <H3>12.2 Prediction Markets (VIP)</H3>
        <P>Trade on real prediction markets with Blue&apos;s assistance.</P>
        <Ol>
          <Li>Go to <Strong>Trades</Strong> (accessible when VIP)</Li>
          <Li>Browse <Strong>Kalshi markets</Strong> &mdash; real event contracts</Li>
          <Li>View market details: current prices, volume, Blue&apos;s analysis</Li>
          <Li>Execute trades manually or let Blue&apos;s automated system handle them</Li>
          <Li>Track your portfolio and P&amp;L</Li>
        </Ol>

        <H3>12.3 Simulation Workspace (VIP)</H3>
        <P>A 5-step research simulation environment:</P>
        <Ol>
          <Li><Strong>Graph Build</Strong> &mdash; construct a knowledge graph</Li>
          <Li><Strong>Environment Setup</Strong> &mdash; configure simulation parameters</Li>
          <Li><Strong>Simulation</Strong> &mdash; run the simulation</Li>
          <Li><Strong>Report</Strong> &mdash; generate results</Li>
          <Li><Strong>Interaction</Strong> &mdash; explore and interact with outputs</Li>
        </Ol>
        <P>Save your simulations to the <Strong>Project Gallery</Strong> and revisit them anytime.</P>

        <H2 id="shop-merchandise">13. Shop &amp; Merchandise</H2>
        <P>Browse and purchase MWA merchandise using USDC.</P>

        <H3>Browsing Products</H3>
        <Ol>
          <Li>Click <Strong>Shop</Strong> in the navigation bar</Li>
          <Li>Browse the catalog organized by category: Uniforms, Accessories, Publications, Tech, Footwear, Bundles</Li>
        </Ol>

        <H3>Purchasing</H3>
        <Ol>
          <Li>Click on a product to see details, images, and pricing</Li>
          <Li>Click <Strong>Mint Now</Strong> to purchase</Li>
          <Li>Confirm the USDC payment from your wallet</Li>
          <Li>Your order is processed</Li>
        </Ol>

        <H3>Product Badges</H3>
        <P>Badges include: <Strong>New</Strong>, <Strong>Limited</Strong>, <Strong>Exclusive</Strong> (VIP-only), <Strong>Free</Strong>, <Strong>Sold Out</Strong>.</P>

        <H2 id="livestream">14. Livestream</H2>
        <P>Watch live sessions and interact with the community in real-time.</P>

        <H3>Watching a Stream</H3>
        <Ol>
          <Li>Go to <Strong>Livestream</Strong> in the navigation bar</Li>
          <Li>The video player loads with the current stream (if live)</Li>
          <Li>Use the <Strong>chat panel</Strong> on the side to interact with other viewers</Li>
        </Ol>

        <H3>Upcoming Sessions</H3>
        <P>Below the video player, you&apos;ll see: schedule of upcoming livestreams, session descriptions and topics, and a <Strong>Set Reminder</Strong> button to get notified before a session starts.</P>

        <H2 id="integrations">15. Integrations</H2>

        <H3>X/Twitter Integration</H3>
        <Ol>
          <Li>Go to <Strong>Profile</Strong> or <Strong>Settings</Strong></Li>
          <Li>Click <Strong>Connect X/Twitter</Strong></Li>
          <Li>Authorize the OAuth flow</Li>
          <Li>Your X account is linked</Li>
        </Ol>
        <P>This enables social quests, automatic quest verification, and social proof.</P>

        <H3>Telegram Integration</H3>
        <Ol>
          <Li>Go to <Strong>Telegram</Strong> in the navigation</Li>
          <Li>Click <Strong>Link Telegram Account</Strong></Li>
          <Li>Complete the verification flow</Li>
        </Ol>
        <P>If you hold the <Strong>Academic Angel NFT</Strong>, you get access to the private Telegram group.</P>

        <H3>Farcaster Integration</H3>
        <P>MWA works as a Farcaster Mini App. Open MWA from within Farcaster or Base app &mdash; your Farcaster account is automatically linked.</P>

        <H2 id="diamond-economy">16. Diamond Economy</H2>
        <P>Diamonds ($BLUE) are the Academy&apos;s reward currency, and they live onchain as a token on Base. When you earn them, they are delivered to your wallet: mission, task, and field-note rewards are minted to you automatically (no signing, no gas), and quest rewards are sent to you directly from Blue&apos;s own stash.</P>

        <H3>Earning Diamonds</H3>
        <Table
          headers={['Activity', 'Reward']}
          rows={[
            ['Complete a course mission or task', '50 Diamonds'],
            ['Seal a course week', '200 Diamonds'],
            ['Seal a field-notes week', '100 Diamonds'],
            ['Complete a custom quest', 'Varies — paid from Blue&apos;s stash'],
            ['Maintain writing streaks', 'Bonus Diamonds'],
          ]}
        />

        <H3>Spending Diamonds</H3>
        <Table
          headers={['Action', 'Cost']}
          rows={[
            ['Reread a field note entry', '50 Diamonds'],
            ['Loot box spin', 'Varies'],
            ['Custom quest creation', 'Varies'],
          ]}
        />

        <H3>Tracking Your Balance</H3>
        <P>Your Diamond balance is shown on your <Strong>Profile</Strong> and in the <Strong>navigation bar</Strong>. The <Strong>Leaderboard</Strong> ranks all users by Diamond count. Onchain, Diamonds are the $BLUE token on Base, so the record in your wallet is yours to keep.</P>

        <H2 id="faq">17. FAQ &amp; Troubleshooting</H2>

        <H3>Common Questions</H3>

        <P><Strong>Q: Do I need a crypto wallet to use MWA?</Strong></P>
        <P>A: Yes, MWA uses wallet-based authentication. You can use MetaMask, Coinbase Wallet, or create an embedded wallet using just your email or phone (no crypto knowledge required).</P>

        <P><Strong>Q: Is my data private?</Strong></P>
        <P>A: MWA takes privacy seriously. Your DNA data (in the Genetics Lab) is processed entirely in your browser and never uploaded. Your wallet address is public onchain, but your personal data is stored securely with Row Level Security.</P>

        <P><Strong>Q: What chain is MWA on?</Strong></P>
        <P>A: Base Mainnet (Ethereum Layer 2). All onchain transactions (week seals, governance votes, NFT certificates) happen on Base.</P>

        <P><Strong>Q: How do I become a VIP member?</Strong></P>
        <P>A: Purchase VIP membership for $90 via Stripe (card) or USDC (crypto). You&apos;ll receive a VIP Membership Card NFT in your wallet.</P>

        <P><Strong>Q: Can I use MWA on mobile?</Strong></P>
        <P>A: Yes! MWA is a Progressive Web App (PWA) &mdash; you can install it on your phone&apos;s home screen for a native-like experience.</P>

        <P><Strong>Q: What is Blue?</Strong></P>
        <P>A: Blue is the platform&apos;s AI agent. She has her own wallet with a 20% stash of Diamonds ($BLUE) that she pays quest rewards from, reviews quest submissions, conducts market trades, and can be chatted with via the &ldquo;Ask Blue&rdquo; button.</P>

        <P><Strong>Q: How do I get help?</Strong></P>
        <P>A: Click the &ldquo;Ask Blue&rdquo; button on any page for AI assistance. For technical issues, visit the <a href="https://github.com/Mental-Wealth-Academy/platform" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>GitHub repository</a> or reach out through community channels.</P>

        <H3>Troubleshooting</H3>

        <P><Strong>Wallet won&apos;t connect:</Strong></P>
        <Ul>
          <Li>Make sure you&apos;re on the Base Mainnet network</Li>
          <Li>Try refreshing the page and reconnecting</Li>
          <Li>Clear your browser cache and try again</Li>
        </Ul>

        <P><Strong>Transaction failed:</Strong></P>
        <Ul>
          <Li>Check you have enough ETH for gas fees on Base</Li>
          <Li>Ensure you&apos;re on the correct network (Base Mainnet)</Li>
          <Li>Try increasing the gas limit in your wallet</Li>
        </Ul>

        <P><Strong>VIP features not showing:</Strong></P>
        <Ul>
          <Li>Verify your VIP Membership Card NFT is in your connected wallet</Li>
          <Li>Try disconnecting and reconnecting your wallet</Li>
          <Li>Check your account status on the Profile page</Li>
        </Ul>

        <H3>Additional Resources</H3>
        <Ul>
          <Li><Strong>Brand Editorial Guide:</Strong> <a href="https://github.com/Mental-Wealth-Academy/platform/blob/main/Brand%20Editorial.md" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Brand Editorial.md</a></Li>
          <Li><Strong>Ontology Creation Guide:</Strong> <a href="https://github.com/Mental-Wealth-Academy/platform/blob/main/ONTOLOGY_CREATION_GUIDE.md" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>ONTOLOGY_CREATION_GUIDE.md</a></Li>
          <Li><Strong>Financial Architecture Map:</Strong> <a href="https://github.com/Mental-Wealth-Academy/platform/blob/main/docs/financial-blockchain-map.md" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>docs/financial-blockchain-map.md</a></Li>
          <Li><Strong>Smart Contracts:</Strong> Located in the <Code>contracts/</Code> directory (Foundry/Forge)</Li>
          <Li><Strong>API Documentation:</Strong> All API routes are in <Code>app/api/</Code></Li>
        </Ul>

        <p style={{ ...pStyle, marginTop: '3rem', fontSize: '0.8125rem', color: '#aaa', textAlign: 'center' }}>
          <em>Last updated: June 2026</em>
        </p>
      </main>
    </div>
  );
}
