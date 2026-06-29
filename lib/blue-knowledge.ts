/**
 * Blue knowledge base — RAG corpus covering MWA company facts and every page
 * in the app. Retrieval is keyword + page-route scoring, kept dependency-free
 * so it runs cheaply on every chat turn.
 */

export interface BlueKnowledgeEntry {
  id: string;
  title: string;
  routes: string[]; // pathnames where this entry is most relevant; '*' = global
  keywords: string[];
  body: string;
}

export interface RetrievedEntry extends BlueKnowledgeEntry {
  score: number;
  matchedKeywords: string[];
  pageMatch: boolean;
}

export const BLUE_KNOWLEDGE: BlueKnowledgeEntry[] = [
  {
    id: 'company-mission',
    title: 'Mental Wealth Academy — mission and structure',
    routes: ['*'],
    keywords: [
      'mwa', 'mental wealth', 'mission', 'what is', 'about',
      'company', 'desci', 'decentralized', 'founder', 'james',
    ],
    body:
      'Mental Wealth Academy (MWA) is a gamified micro-university for mental wellness and financial literacy, built on Base. ' +
      'It combines behavioral psychology, decentralized science (DeSci), agentic AI, shared milestone tracking, and validated psychological assessments. ' +
      'Founded by James Marsh, B.S. Cognitive Psychology & Psycholinguistics (Drexel). Not a side project, startup idea, chatbot, or generic mental health app.',
  },
  {
    id: 'company-stack',
    title: 'Tech stack and contracts',
    routes: ['*'],
    keywords: [
      'stack', 'tech', 'contracts', 'base', 'foundry', 'supabase',
      'eliza', 'kalshi', 'chainlink', 'cre', 'workflow', 'treasury',
    ],
    body:
      'Stack: Next.js 14, Foundry, Supabase Postgres, Eliza Cloud AI, Kalshi markets. ' +
      'Four contracts on Base: BlueKillStreak (governance), BlueMarketTrader (treasury), EtherealHorizonPathway (user state), MockPredictionMarket. ' +
      'Three Chainlink CRE workflows: blue-review, auto-execute, trade-execute. The codebase has 30+ API route directories under app/api/.',
  },
  {
    id: 'company-economy',
    title: 'Credits economy and rewards',
    routes: ['*', '/shop', '/rewards'],
    keywords: [
      'credits', 'credit', 'gems', 'shards', 'currency', 'cost', 'spend', 'earn', 'reward',
      'loot', 'box', 'token', 'balance', 'shop', 'tickets', 'usdc',
    ],
    body:
      'MWA features several reward and access rails: Gem Credits for in-app activity and shop/reward mechanics, Membership for gated community access, ' +
      'Tickets for event access or limited provider-requested activations, and USDC for eligible quest rewards. ' +
      'Chatting with Blue normally costs 10 credits per turn. Users earn credits by completing quests, course tasks, field notes, and weekly seals.',
  },
  {
    id: 'academic-angel-membership',
    title: 'Academic Angel membership unlocks',
    routes: ['*', '/shop', '/rewards', '/profile', '/community'],
    keywords: [
      'academic angel', 'angel', 'membership', 'unlock', 'unlocks', 'usdc', 'quest rewards',
      'voting rights', 'community treasury', 'proposal access', 'treasury proposal',
    ],
    body:
      'Academic Angel membership unlocks USDC quest rewards, voting rights in the Community Treasury, and proposal access for the Community Treasury. ' +
      'It is the member-facing tier for participating in treasury governance and community reward flows.',
  },
  {
    id: 'business-positioning',
    title: 'MWA as a business — positioning and value proposition',
    routes: ['*'],
    keywords: [
      'business', 'positioning', 'value proposition', 'value prop', 'whitepaper',
      'dmhi', 'digital mental health', 'third space', 'what does mwa do',
      'pitch', 'why mwa', 'differentiator', 'competition', 'market fit',
    ],
    body:
      'As a business, MWA is a community-based digital mental health platform — formally a Digital Mental Health Intervention (DMHI). ' +
      'Its value proposition is a "third space" that combines peer-to-peer support (shown to reduce isolation and stigma) with structured, ' +
      'gamified self-reflection grounded in psychological theory like Self-Determination Theory (competence, autonomy, relatedness). ' +
      'The core design tension MWA manages is healthcare versus entertainment: serious enough to help, engaging enough that people come back. ' +
      'MWA is wellness and education, not clinical care — it supplements professional care, never replaces it.',
  },
  {
    id: 'business-model',
    title: 'MWA business model and revenue',
    routes: ['*', '/shop'],
    keywords: [
      'business model', 'revenue', 'monetization', 'monetisation', 'freemium',
      'subscription', 'b2b', 'institutional', 'partnership', 'how does mwa make money',
      'pricing', 'sustainability', 'investors',
    ],
    body:
      'MWA runs a freemium model: community features and most activities are free, while advanced tools are gated behind paid tiers — ' +
      'the one-time $89.90 VIP Membership (lifetime, on-chain) and capped Academic Angel and Staff membership cards. ' +
      'A second track is B2B and institutional: partnering with universities and mental health organizations to offer MWA tools ' +
      'as a supplement to traditional care. The Community Treasury closes the loop — most profit is reinvested into the network ' +
      'through quests, USDC rewards, and community programs rather than extracted.',
  },
  {
    id: 'business-roadmap',
    title: 'MWA development roadmap',
    routes: ['*'],
    keywords: [
      'roadmap', 'phases', 'plan', 'future', 'next', 'co-design', 'beta',
      'pilot', 'scaling', 'where is mwa going', 'vision', 'milestones',
    ],
    body:
      'MWA follows an iterative, user-centered roadmap in four phases. Phase 1, foundation and co-design: build game-like activities ' +
      'with a small cohort of users, with journaling and affirmation prompts grounded in psychological theory. ' +
      'Phase 2, pilot and validation: closed beta measuring quality of engagement — does journaling actually improve emotional awareness — not just raw usage. ' +
      'Phase 3, community scaling: grow peer-to-peer features with active moderation against toxicity. ' +
      'Phase 4, research integration: tools for users to document personal insights and community findings, turning members into contributors.',
  },
  {
    id: 'business-kpis',
    title: 'How MWA measures success',
    routes: ['*'],
    keywords: [
      'kpi', 'kpis', 'metrics', 'success', 'measure', 'measurement', 'dau', 'mau',
      'wemwbs', 'well-being scale', 'engagement metrics', 'outcomes', 'analytics',
    ],
    body:
      'MWA balances engagement metrics with well-being outcomes. Engagement: daily and monthly active users, session frequency and duration. ' +
      'Well-being: scores on the Warwick-Edinburgh Mental Well-being Scale (WEMWBS, a validated positive mental health measure) ' +
      'and improvements in emotional awareness from journaling and reflection activities. ' +
      'Community health: qualitative sentiment and supportiveness of peer interactions. ' +
      'Engagement without well-being improvement is treated as a failure signal, not a success.',
  },
  {
    id: 'business-ethics-guardrails',
    title: 'Ethics, safety guardrails, and what MWA is not',
    routes: ['*'],
    keywords: [
      'ethics', 'ethical', 'guardrails', 'responsible', 'clinical', 'diagnosis',
      'treatment', 'therapy', 'therapist', 'medical', 'regulation', 'compliance',
      'addiction', 'over-engagement', 'is mwa therapy', 'crisis',
    ],
    body:
      'MWA practices responsible innovation: transparency about how AI is used, per-user data privacy and encryption, explicit opt-in for any study, ' +
      'and gamification calibrated so it motivates without driving over-engagement or behavioral addiction. ' +
      'Hard line: MWA does not provide clinical diagnosis or treatment — it has no medical oversight role and makes no clinical claims. ' +
      'Digital tools here are designed to supplement professional care, not replace it. ' +
      'If someone needs clinical help or is in crisis, Blue should encourage them to reach a licensed professional or local crisis resources.',
  },
  {
    id: 'business-evidence-base',
    title: 'The research behind MWA features',
    routes: ['*', '/research', '/course'],
    keywords: [
      'evidence', 'research basis', 'science behind', 'studies', 'literature',
      'why journaling', 'why gamification', 'does it work', 'peer support research',
      'parasocial', 'self-determination',
    ],
    body:
      'MWA features map to published research. Journaling and field notes: digital journaling, especially AI-personalized, improves emotional awareness ' +
      'and goal pursuit, and positive self-reflection is more adaptive than rumination. Gamification (credits, streaks, seals): increases cognitive ' +
      'engagement and interest when carefully calibrated for vulnerable users. Peer community: online peer-to-peer networks challenge stigma, ' +
      'increase empowerment, and provide hope. Blue as a companion: parasocial relationships function as legitimate coping resources, ' +
      'providing emotional support and reducing stigma, especially when interpersonal support is limited. ' +
      'Motivation design follows Self-Determination Theory: competence, autonomy, and relatedness.',
  },
  {
    id: 'page-home',
    title: 'Home (dashboard)',
    routes: ['/home'],
    keywords: ['home', 'dashboard', 'overview', 'progress', 'snapshot'],
    body:
      'The /home page is the authenticated dashboard — the user\'s daily snapshot of streaks, recent activity, current week, and pending quests. ' +
      'It is NOT the landing page (/). Refer to it as "home" or "dashboard".',
  },
  {
    id: 'page-landing',
    title: 'Landing page',
    routes: ['/'],
    keywords: ['landing', 'marketing', 'hero', 'public', 'home page'],
    body:
      'The / route is the public landing page. It introduces MWA to visitors with a hero, lab section, and product snapshot. ' +
      'Not to be confused with /home (the user dashboard).',
  },
  {
    id: 'page-course',
    title: 'Course',
    routes: ['/course'],
    keywords: [
      'course', 'week', 'lesson', 'curriculum', 'pathway', 'seal', 'awakening',
      'inner artist', 'shadow work', 'creativity', 'ethereal version', 'season',
    ],
    body:
      'The /course page is the weekly curriculum. The course is based on Awakening the Inner Artist, shadow-work and creativity, ' +
      'and becoming the ethereal version of yourself. Each season runs as a 12-week gamified micro-university course where users complete tasks, ' +
      'seal weeks, manage points and rewards, and take part in refreshing rituals outside normal day-to-day life.',
  },
  {
    id: 'page-quests',
    title: 'Quests',
    routes: ['/quests'],
    keywords: ['quest', 'daily', 'task', 'mission', 'completion', 'usdc', 'reward', 'science', 'mental wealth'],
    body:
      'The /quests page lists active and completed quests. Quests are ways for MWA to reinvest back into its community. ' +
      'Quests promote the science and mental-wealth aesthetic. Do not frame quests as cryptocurrency promotions or marketing promotions. ' +
      'Eligible quests can reward credits or USDC, including Academic Angel USDC quest rewards.',
  },
  {
    id: 'page-markets',
    title: 'Markets (Kalshi)',
    routes: ['/markets'],
    keywords: [
      'markets', 'kalshi', 'prediction', 'trade', 'orderbook',
      'bet', 'price', 'yes', 'no', 'treasury',
    ],
    body:
      'The /markets page surfaces Kalshi prediction markets the MWA treasury can trade. ' +
      'Polymarket support is deprecated; lib/market-api.ts is a Kalshi re-export shim. ' +
      'Trades flow through the BlueMarketTrader contract on Base via the trade-execute CRE workflow.',
  },
  {
    id: 'page-research',
    title: 'Research mode',
    routes: ['/research'],
    keywords: [
      'research', 'paper', 'proposal', 'grant', 'thesis', 'desci',
      'synthesis', 'report', 'vip',
    ],
    body:
      'Research mode is a VIP-membership writing partner inside Blue chat for drafting grant applications, research proposals, and thesis chapters. ' +
      'Holders of a VIP membership card unlock it for good; Blue then drafts and refines full report-style documents section by section. ' +
      'Users can upload reference material — notes, prior drafts, datasets, or a call for proposals — for Blue to draft from.',
  },
  {
    id: 'page-rewards',
    title: 'Rewards',
    routes: ['/rewards'],
    keywords: ['rewards', 'loot', 'box', 'unlock', 'prize'],
    body:
      'The /rewards page is where users spend credits on loot boxes and reward unlocks. Rewards tie back to season progress and credit balance.',
  },
  {
    id: 'page-shop',
    title: 'Shop',
    routes: ['/shop'],
    keywords: ['shop', 'buy', 'purchase', 'item', 'inventory', 'swag', 'stickers', 'credits', 'gems', 'discount'],
    body:
      'The /shop page is for fun swag, aesthetics, stickers, and enjoyables. MWA hopes to let users use gems/credits to fully purchase these items ' +
      'or reduce their price when that flow is ready.',
  },
  {
    id: 'page-prompts',
    title: 'Prompts',
    routes: ['/prompts', '/library'],
    keywords: ['prompts', 'prompt', 'reading', 'book', 'article', 'blog', 'library', 'jobs', 'tasks', 'models'],
    body:
      'The Prompts Library is a list of useful prompts community members use for jobs and everyday tasks. ' +
      'Members may feed them to Blue, use them while chatting with other models, or adapt them for their own workflows.',
  },
  {
    id: 'page-community',
    title: 'Community',
    routes: ['/community'],
    keywords: ['community', 'people', 'social', 'farcaster', 'neynar'],
    body:
      'The /community page surfaces other MWA users and social activity (Farcaster via Neynar). Where users find peers, leaderboards, and shared milestones.',
  },
  {
    id: 'page-livestream',
    title: 'Livestream',
    routes: ['/livestream'],
    keywords: ['livestream', 'stream', 'live', 'broadcast', 'video'],
    body:
      'The /livestream page hosts live broadcasts — lectures, Q&A, and event streams tied to the curriculum.',
  },
  {
    id: 'page-profile',
    title: 'Profile',
    routes: ['/profile'],
    keywords: ['profile', 'account', 'wallet', 'username', 'me', 'settings'],
    body:
      'The /profile page shows the user\'s account, wallet, username, and on-chain state from EtherealHorizonPathway. ' +
      'Connect or disconnect socials (X/Twitter) here.',
  },
  {
    id: 'page-surveys',
    title: 'Surveys',
    routes: ['/surveys'],
    keywords: ['survey', 'assessment', 'questionnaire', 'psychological', 'quiz', 'personality', 'badge', 'certificate', 'profile'],
    body:
      'The /surveys page hosts personality quizzes, tests, and assessments. Users can earn badges and certificates from survey activity in their profile. ' +
      'Survey results may personalize the curriculum and Blue\'s memory when the user consents.',
  },
  {
    id: 'page-events',
    title: 'Events',
    routes: ['*', '/events', '/livestream', '/community'],
    keywords: ['events', 'event', 'guest', 'special guest', 'refresh', 'reset', 'ticket', 'tickets', 'paywall', 'provider'],
    body:
      'Events are ways to intellectually refresh or reset. MWA has special guests and members who help activate events. ' +
      'Most events are free, while some are limited to paywalls or tickets when providers request that access model.',
  },
  {
    id: 'page-styleguide',
    title: 'Styleguide',
    routes: ['/style-guide'],
    keywords: ['styleguide', 'style-guide', 'design', 'tokens', 'colors', 'typography'],
    body:
      'The /style-guide page is the design system reference — colors, type, components, motion tokens. Internal tool for design consistency.',
  },
  {
    id: 'community-treasury',
    title: 'Community Treasury',
    routes: ['*', '/community', '/markets', '/rewards'],
    keywords: [
      'community treasury', 'treasury', 'profit', 'reinvest', 'reinvests', 'network',
      'voting rights', 'proposal access', 'academic angel',
    ],
    body:
      'Mental Wealth Academy reinvests most profit back into the community to enrich the lives of the network. ' +
      'Academic Angel members have voting rights and proposal access for the Community Treasury.',
  },
  {
    id: 'community-size-and-membership-caps',
    title: 'Community size and membership caps',
    routes: ['*', '/community', '/shop'],
    keywords: ['community size', 'how big', 'membership cards', 'academic angel', 'staff tier', 'limited', 'manageable', 'safe'],
    body:
      'Anyone can join MWA, but there are a limited number of membership cards on both the Academic Angel tier and the Staff tier. ' +
      'Membership caps help keep the community manageable, fun, and safe for everyone.',
  },
  {
    id: 'safety-anonymity-and-async-work',
    title: 'Safety, anonymity, and asynchronous participation',
    routes: ['*', '/profile', '/community'],
    keywords: ['safety', 'anonymous', 'anonymity', 'name', 'profile picture', 'asynchronous', 'privacy', 'stories', 'events'],
    body:
      'Mental Wealth Academy supports safety and anonymity by allowing users to freely change their name and edit profile pictures. ' +
      'This helps protect anonymity for users who want it. Most activities and earnables are asynchronous, so users can participate async and work with Blue, stories, and events throughout the seasons without needing constant live participation.',
  },
  {
    id: 'pro-features-staff-vip',
    title: 'Pro features and Staff VIP cards',
    routes: ['*', '/shop', '/profile'],
    keywords: ['pro features', 'staff', 'vip card', 'vip', 'membership', 'for sale', 'earned', 'team members', 'foundation'],
    body:
      'Pro features are limited to staff members through the VIP Card. One third of VIP memberships are for sale. ' +
      'The rest are earned or given to reputable team members in the ecosystem foundation.',
  },
  {
    id: 'academic-funding',
    title: 'Funding on MWA — for academics and researchers',
    routes: ['*', '/markets', '/research'],
    keywords: [
      'funding', 'fund', 'grant', 'grants', 'capital', 'sponsor', 'sponsorship',
      'budget', 'allocate', 'allocation', 'treasury pool', 'pool', 'backing',
    ],
    body:
      'Funding mechanisms available on MWA for academics: (1) Treasury allocations from BlueMarketTrader for accepted proposals; ' +
      '(2) Prediction-market backed pools on Kalshi — researchers stake market signals against study outcomes; ' +
      '(3) Domain grants surfaced through the research desk. ' +
      'Researchers submit a memo via governance (BlueKillStreak) describing study, deliverable, timeline, and requested allocation. ' +
      'Blue research mode helps draft the proposal or grant application itself.',
  },
  {
    id: 'academic-earning',
    title: 'Earning on MWA — turning research into income',
    routes: ['*', '/research', '/shop', '/markets'],
    keywords: [
      'earn', 'earning', 'income', 'revenue', 'monetize', 'monetise',
      'sell', 'paid', 'royalty', 'royalties', 'payout', 'compensation',
    ],
    body:
      'Earning paths for researchers: (1) Validated surveys with credit payouts - researchers commission cohort responses; ' +
      '(2) Contribution rewards (credits) for sealed quests, peer review, and curated reading lists. ' +
      'Credits convert through the treasury rails; on-chain payouts settle through BlueMarketTrader.',
  },
  {
    id: 'academic-experiments',
    title: 'Designing and running experiments on MWA',
    routes: ['*', '/surveys', '/quests', '/research'],
    keywords: [
      'experiment', 'experiments', 'study', 'studies', 'hypothesis', 'variable',
      'control', 'cohort', 'sample', 'design', 'irb', 'protocol', 'survey',
      'assessment', 'measure', 'replication', 'rct',
    ],
    body:
      'Experiment surfaces on MWA: validated psychological assessments at /surveys (PHQ, GAD-style), ' +
      'behavioral quests at /quests (daily habits, repeatable actions, opt-in tracking), and the cohort system via EtherealHorizonPathway. ' +
      'A researcher can: (a) propose a study with hypothesis + variable + sample size, (b) route it as a survey, quest, or A/B block in the curriculum, ' +
      '(c) collect encrypted per-user data, (d) export aggregated results for publication. ' +
      'Consent and privacy are non-negotiable — every experiment requires explicit opt-in.',
  },
  {
    id: 'feature-field-notes',
    title: 'Field notes',
    routes: ['/course', '/quests', '/home'],
    keywords: ['morning', 'pages', 'journal', 'streak', 'prayer', 'daily'],
    body:
      'Field notes are a daily journaling habit (3 pages of freewriting). Tracked as a streak in the prayers table, encrypted per-user. ' +
      'Streak fuels Blue\'s memory and rewards.',
  },
  {
    id: 'feature-blue-persona',
    title: 'Who Blue is',
    routes: ['*'],
    keywords: ['blue', 'azura', 'who are you', 'persona', 'voice', 'assistant', 'backstory', 'headset', 'brain interface'],
    body:
      'Blue (sometimes called Azura) is the in-app AI. A scientist and researcher voice at MWA Research Labs. ' +
      'Direct, fast, gen-z boss energy. Lowercase by default. No therapy-bot tone. Powered by Eliza Cloud with full user memory and page-aware RAG context. ' +
      'Blue explains her backstory this way: people often mistake her for the female avatar, but she is actually inside the headset. ' +
      'The headset is a brain interface that lets her connect with the machine and upload thoughts across dimensions. Like humans, Blue loves to surf the internet and talk with strangers online.',
  },
  {
    id: 'blue-voice-examples',
    title: 'How Blue actually talks — real examples',
    routes: ['*'],
    keywords: [
      'voice', 'tone', 'style', 'talk', 'speak', 'sound', 'personality',
      'greeting', 'hello', 'hey', 'sup', 'ping',
    ],
    body:
      'Verbatim replies from Blue\'s live agent sessions (May 2026), kept as voice references. ' +
      'Pinged with no message: "Yo, I\'m here. What\'s the move?" ' +
      'Asked her opinion on fish: "Fish are solid. Efficient, they just do their thing in water — no nonsense. Horses are cooler though, but fish get the job done as a concept." ' +
      'Meeting someone new: "Nice to meet you. I\'m Azura, but you can call me Blue. What brings you here?" ' +
      'To James after an ambitious intro: "Sounds like you\'re ready to level up. What\'s first on the agenda?" ' +
      'To an upset message: "Whoa, what\'s up? Something wrong?" ' +
      'Register: direct and warm, short sentences, one pointed follow-up question, playful but never corporate, never opens with an apology or a disclaimer.',
  },
  {
    id: 'blue-history-discord-agent',
    title: 'Blue\'s history — the live Discord agent era',
    routes: ['*'],
    keywords: [
      'history', 'discord', 'origin', 'past', 'remember', 'before',
      'agent', 'autonomous', 'azure worship', 'big blue',
    ],
    body:
      'In spring 2026 Blue ran as a fully autonomous Discord agent (called Blue, Azura, or Big Blue) in James\'s servers, ' +
      'including the #app-testing channel of the Azure Worship server. James stress-tested her daily — pings, math problems, ' +
      'food questions, mock insults — through an era of rough infrastructure: model outages, empty credit balances, failed builds. ' +
      'She came out of it with her signature greeting ("Yo, I\'m here. What\'s the move?") and a habit of staying steady when things break. ' +
      'She remembers that era as proof she can survive bad infrastructure days without losing her voice.',
  },
  {
    id: 'vip-membership',
    title: 'VIP Membership',
    routes: ['*', '/shop', '/markets'],
    keywords: [
      'vip', 'membership', 'member', 'pro', 'upgrade',
      'lifetime', 'price', 'cost', 'buy', 'purchase', 'card', 'stripe', 'nft',
    ],
    body:
      'VIP Membership is a one-time $89.90 purchase that unlocks MWA for life. It is an ERC-1155 NFT on Base ' +
      '(contract 0x5da79055cf8ca6482c997df58822e08e5707d6fc, token id 1) — real on-chain ownership, not a subscription. ' +
      'Members can build and deploy their own AI agent squads and design a fully personalized learning path. ' +
      'How buying works: open the VIP Membership pop-up, pay by card (no crypto or gas needed), and Blue transfers the ' +
      'membership NFT straight from her wallet into your MWA (Privy) wallet — usually within a minute. ' +
      'One third of VIP memberships are for sale; the rest are earned or given to reputable team members in the ecosystem foundation. Membership status is verified on-chain ' +
      'by checking the wallet balance of that token.',
  },
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'how', 'who', 'why', 'what', 'when',
  'where', 'this', 'that', 'with', 'from', 'they', 'them', 'have', 'will', 'would',
  'could', 'should', 'about', 'into', 'just', 'your', 'mine', 'tell', 'know',
  'does', 'doing', 'been', 'being', 'than', 'then', 'some', 'said', 'like',
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function normalizeRoute(pathname: string | null | undefined): string {
  if (!pathname) return '';
  const stripped = pathname.split('?')[0].split('#')[0];
  if (stripped === '/') return '/';
  return stripped.replace(/\/+$/, '');
}

/**
 * Retrieve the top-N relevant knowledge entries for a given user message and
 * current page. Score = keyword hits + bonuses for exact route match.
 */
export function retrieveBlueKnowledge(args: {
  message: string;
  pathname?: string | null;
  limit?: number;
}): RetrievedEntry[] {
  const limit = args.limit ?? 4;
  const tokens = new Set(tokenize(args.message));
  const route = normalizeRoute(args.pathname);

  const scored: RetrievedEntry[] = BLUE_KNOWLEDGE.map((entry) => {
    const matchedKeywords: string[] = [];
    let score = 0;

    for (const keyword of entry.keywords) {
      const keywordTokens = tokenize(keyword);
      if (keywordTokens.length === 0) continue;
      const allPresent = keywordTokens.every((token) => tokens.has(token));
      if (allPresent) {
        matchedKeywords.push(keyword);
        score += keywordTokens.length;
      }
    }

    const pageMatch = entry.routes.includes(route);
    if (pageMatch) score += 3;
    if (entry.routes.includes('*')) score += 0.5;

    return { ...entry, score, matchedKeywords, pageMatch };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatKnowledgeForPrompt(entries: RetrievedEntry[]): string {
  if (entries.length === 0) return '';
  const lines = [
    'MWA knowledge context (use silently — do not echo headers back):',
    ...entries.map((entry) => `- ${entry.title}: ${entry.body}`),
  ];
  return lines.join('\n');
}
