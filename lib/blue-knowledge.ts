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
    title: 'Shards economy and rewards',
    routes: ['*', '/shop', '/rewards'],
    keywords: [
      'shards', 'currency', 'cost', 'spend', 'earn', 'reward',
      'loot', 'box', 'token', 'balance', 'shop',
    ],
    body:
      'Shards are MWA\'s in-app currency. Chatting with Blue normally costs 10 shards per turn; research mode and other premium actions cost more. ' +
      'Users earn shards by completing quests, course tasks, morning pages, and weekly seals. ' +
      'Insufficient shards triggers the purchase modal. Shop and rewards pages spend shards on cosmetic and functional upgrades.',
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
    keywords: ['course', 'week', 'lesson', 'curriculum', 'pathway', 'seal'],
    body:
      'The /course page is the weekly curriculum. Each week has multiple sections (tasks) the user completes, then seals the week. ' +
      'Completing a week unlocks the next. The full sequence forms the EtherealHorizon pathway tracked on-chain.',
  },
  {
    id: 'page-quests',
    title: 'Quests',
    routes: ['/quests'],
    keywords: ['quest', 'daily', 'task', 'mission', 'completion'],
    body:
      'The /quests page lists active and completed quests. Quests are short, repeatable actions that reward shards and reinforce daily habits. ' +
      'Includes morning pages, twitter quests, and curriculum-tied tasks.',
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
      'research', 'paper', 'source', 'evidence', 'desci',
      'synthesis', 'gpu', 'discover',
    ],
    body:
      'The /research page is Blue\'s DeSci research mode. Users discover sources, fetch payable papers via x402, and get Blue\'s synthesis grounded in evidence. ' +
      'GPU-backed deep reads cost more shards but produce sourced syntheses for public-facing decentralized science work.',
  },
  {
    id: 'page-rewards',
    title: 'Rewards',
    routes: ['/rewards'],
    keywords: ['rewards', 'loot', 'box', 'unlock', 'prize'],
    body:
      'The /rewards page is where users spend shards on loot boxes and reward unlocks. Rewards tie back to season progress and shard balance.',
  },
  {
    id: 'page-shop',
    title: 'Shop',
    routes: ['/shop'],
    keywords: ['shop', 'buy', 'purchase', 'item', 'inventory'],
    body:
      'The /shop page sells cosmetic and functional items for shards. Used for inventory upgrades and purchasable boosts.',
  },
  {
    id: 'page-library',
    title: 'Library',
    routes: ['/library'],
    keywords: ['library', 'reading', 'book', 'article', 'blog'],
    body:
      'The /library page collects readings, articles, and blog posts (Paragraph integration). Curated material that supports the curriculum and DeSci themes.',
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
    keywords: ['survey', 'assessment', 'questionnaire', 'psychological', 'phq', 'gad'],
    body:
      'The /surveys page hosts validated psychological assessments (PHQ, GAD-style). Results feed into Blue\'s memory and personalize the curriculum.',
  },
  {
    id: 'page-styleguide',
    title: 'Styleguide',
    routes: ['/styleguide'],
    keywords: ['styleguide', 'design', 'tokens', 'colors', 'typography'],
    body:
      'The /styleguide page is the design system reference — colors, type, components, motion tokens. Internal tool for design consistency.',
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
      '(3) Domain grants surfaced through the research desk; (4) x402 paywall pre-sales of unreleased papers and datasets. ' +
      'Researchers submit a memo via governance (BlueKillStreak) describing study, deliverable, timeline, and requested allocation.',
  },
  {
    id: 'academic-earning',
    title: 'Earning on MWA — turning research into income',
    routes: ['*', '/research', '/shop', '/markets'],
    keywords: [
      'earn', 'earning', 'income', 'revenue', 'monetize', 'monetise', 'paywall',
      'x402', 'sell', 'paid', 'royalty', 'royalties', 'payout', 'compensation',
    ],
    body:
      'Earning paths for researchers: (1) x402 paywalled papers — readers pay per fetch via /api/research/fetch; ' +
      '(2) Paid syntheses — Blue research-desk synthesis fees pass-through to the original author; ' +
      '(3) GPU deep-read commissions — premium synthesis jobs; ' +
      '(4) Validated surveys with shard payouts — researchers commission cohort responses; ' +
      '(5) Contribution rewards (shards) for sealed quests, peer review, and curated reading lists. ' +
      'Shards convert through the treasury rails; on-chain payouts settle through BlueMarketTrader.',
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
    id: 'feature-morning-pages',
    title: 'Morning pages',
    routes: ['/course', '/quests', '/home'],
    keywords: ['morning', 'pages', 'journal', 'streak', 'prayer', 'daily'],
    body:
      'Morning pages are a daily journaling habit (3 pages of freewriting). Tracked as a streak in the prayers table, encrypted per-user. ' +
      'Streak fuels Blue\'s memory and rewards.',
  },
  {
    id: 'feature-blue-persona',
    title: 'Who Blue is',
    routes: ['*'],
    keywords: ['blue', 'azura', 'who are you', 'persona', 'voice', 'assistant'],
    body:
      'Blue (sometimes called Azura) is the in-app AI. A scientist and researcher voice at MWA Research Labs. ' +
      'Direct, fast, gen-z boss energy. Lowercase by default. No therapy-bot tone. Powered by Eliza Cloud with full user memory and page-aware RAG context.',
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
      'The whole supply of memberships is held by Blue; each purchase grants one. Membership status is verified on-chain ' +
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
