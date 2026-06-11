'use client';

import { useDeferredValue, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, FormEvent } from 'react';
import Image from 'next/image';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { HowToButton } from '@/components/treasury-how-to/TreasuryHowTo';
import ProMembershipModal from '@/components/pro-membership-modal/ProMembershipModal';
import CtaButton from '@/components/shared/CtaButton';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './page.module.css';
import type { CoinPrice, TreasuryBalance, CategorizedMarkets, MarketCategory, MarketRow, AppleTokenStats as ShardTokenStats } from '@/lib/market-api';

// ── Helpers ──

function formatPrice(n: number): string {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(4);
}

function formatVol(raw: number | string | null): string {
  const n = Number(raw);
  if (!n || isNaN(n)) return '--';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

function parseOutcomePrices(raw: string): [number, number] {
  try {
    const arr = JSON.parse(raw);
    return [Number(arr[0]) || 0, Number(arr[1]) || 0];
  } catch {
    return [0, 0];
  }
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  return Math.floor(s / 60) + 'm ago';
}

function useLiveTick(intervalMs: number, enabled = true) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return tick;
}

function SkeletonLine({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span className={`${styles.skeleton} ${className}`} style={style} aria-hidden="true" />;
}

function ShardValueSkeleton({ className = '' }: { className?: string }) {
  return <SkeletonLine className={`${styles.shardBarValueSkeleton} ${className}`} />;
}

function MarketListSkeleton() {
  return (
    <div className={styles.marketList} aria-label="Loading markets">
      {MARKET_CATEGORIES.map((cat) => (
        <div key={cat} className={styles.marketSection}>
          <SkeletonLine className={styles.marketSectionLabelSkeleton} />
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${styles.marketItem} ${styles.marketItemSkeleton}`}>
              <SkeletonLine className={i === 1 ? styles.marketQuestionSkeletonWide : styles.marketQuestionSkeleton} />
              <SkeletonLine className={styles.marketBarSkeleton} />
              <div className={styles.marketMeta}>
                <SkeletonLine className={styles.marketMetaSkeleton} />
                <SkeletonLine className={styles.marketVolumeSkeleton} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TreasuryQuickSkeleton() {
  return (
    <>
      <div className={styles.treasuryQuickPrimary}>
        <SkeletonLine className={styles.balanceHeroSkeleton} />
        <SkeletonLine className={styles.balanceLabelSkeleton} />
      </div>
      <div className={styles.treasuryQuickSpark}>
        <SkeletonLine className={styles.sparklineSkeleton} />
        <SkeletonLine className={styles.sparklineSkeleton} />
      </div>
    </>
  );
}

// ── Model Constants ──

const SIGMA = 0.50;
const T_EXP = 0.0000095;
const R_FREE = 0.0433;
const GAMMA = 0.10;
const SIGMA_B = 0.328;
const K_DECAY = 1.50;
const EDGE_THRESHOLD = 3.0;
const FALLBACK_MKT_PRICE = 53.78;

// ── Live Trading Log Entry Type ──

interface ExecutionLogEntry {
  action: 'SCAN' | 'TRADE' | 'SKIP' | 'HALT' | 'ERROR' | 'SIGNAL';
  asset?: string;
  details: string;
  timestamp: number;
}

// ── Live Position Type ──

interface LivePosition {
  asset: string;
  side: 'BUY' | 'SELL' | 'YES' | 'NO';
  price: string;
  size: string;
  sizeMatched: string;
  status: string;
}

interface TradeChatMessage {
  role: 'user' | 'blue';
  text: string;
  timestamp: number;
}

interface AccountStatusResponse {
  hasLinkedAccount?: boolean;
  hasVipMembershipCard?: boolean;
  walletAddress?: string;
}

// ── Math Helpers ──

/** Abramowitz & Stegun approximation for the standard normal CDF */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/** Find a BTC-related Kalshi market, return Yes price as % */
function findBtcMarket(markets: CategorizedMarkets | null): number | null {
  if (!markets) return null;
  const allMarkets = Object.values(markets).flat() as MarketRow[];
  const match = allMarkets.find((m: MarketRow) =>
    /^KXBTC/i.test(m.event_ticker || m.ticker) ||
    /btc|bitcoin/i.test(m.question),
  );
  if (!match) return null;
  const [yes] = parseOutcomePrices(match.outcomePrices);
  return yes > 0 ? yes * 100 : null;
}

function formatTradeTime(ts: string): string {
  try {
    const d = new Date(Number(ts) * 1000 || ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--';
  }
}

const CATEGORY_LABELS: Record<MarketCategory, string> = {
  elections: 'Elections',
  politics: 'Politics',
  culture: 'Culture',
  science: 'Science',
};

const MARKET_CATEGORIES: MarketCategory[] = ['elections', 'politics', 'culture', 'science'];

const TRADE_CHAT_SUGGESTIONS = [
  "What's the estimate?",
];
const INITIAL_VISIBLE_MARKETS = 3;
const MARKET_LOAD_MORE_STEP = 3;
const CHAT_SPOTLIGHT_KEY = 'mwa-trades-chat-daemon-seen';

const INITIAL_TRADE_CHAT: TradeChatMessage[] = [
  {
    role: 'blue',
    text: "Ask me about any market and I'll give you Blue's current estimate.",
    timestamp: Date.now(),
  },
];

const CATEGORY_AVATARS: Record<MarketCategory, string> = {
  elections: '/icons/governance.svg',
  politics: '/icons/debate.svg',
  culture: '/icons/nav-gallery.svg',
  science: '/icons/atom.svg',
};

// ── Live Ticker Line ──

const TICKER_LEN = 80;
const TICKER_DRIFT = 0.25;   // upward bias per tick
const TICKER_VOL = 0.6;      // small random noise

function TickerLine({ drift = TICKER_DRIFT, vol = TICKER_VOL, stroke = 'var(--color-primary)', strokeWidth = 2.5, opacity = 0.8, speed = 300 }: {
  drift?: number; vol?: number; stroke?: string; strokeWidth?: number; opacity?: number; speed?: number;
}) {
  const buf = useRef<number[]>((() => {
    const arr: number[] = [];
    let v = 0;
    for (let i = 0; i < TICKER_LEN; i++) {
      v += drift + (Math.random() - 0.5) * vol;
      arr.push(v);
    }
    return arr;
  })());
  const [points, setPoints] = useState<string>('');

  useEffect(() => {
    function tick() {
      const arr = buf.current as number[];
      const last = arr[arr.length - 1];
      arr.push(last + drift + (Math.random() - 0.5) * vol);
      if (arr.length > TICKER_LEN) arr.shift();

      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const range = max - min || 1;
      const w = 400;
      const h = 28;
      const pad = 2;

      const pts = arr
        .map((v, i) => {
          const x = (i / (arr.length - 1)) * w;
          const y = h - pad - ((v - min) / range) * (h - pad * 2);
          return `${x},${y}`;
        })
        .join(' ');
      setPoints(pts);
    }

    tick();
    const id = setInterval(tick, speed);
    return () => clearInterval(id);
  }, [drift, vol, speed]);

  if (!points) return null;

  return (
    <svg className={styles.sparklineSvg} viewBox="0 0 400 28" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={opacity}
      />
    </svg>
  );
}

function LastUpdatedLabel({ timestamp }: { timestamp: number }) {
  useLiveTick(5000, timestamp > 0);

  if (timestamp <= 0) return null;

  return <span className={styles.lastUpdated}>updated {timeAgo(timestamp)}</span>;
}

// ── Market Debate ──

interface DebatePost {
  id: string;
  stance: 'yes' | 'no';
  body: string;
  created_at: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  is_own: boolean;
}

function debateTimeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function MarketDebate({ marketId, marketTitle }: { marketId: string; marketTitle: string }) {
  const [posts, setPosts] = useState<DebatePost[] | null>(null);
  const [stance, setStance] = useState<'yes' | 'no'>('yes');
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/treasury/market-debate?marketId=${encodeURIComponent(marketId)}`);
        if (!res.ok) throw new Error();
        const data: { posts?: DebatePost[] } = await res.json();
        if (!cancelled) setPosts(data.posts || []);
      } catch {
        if (!cancelled) setPosts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [marketId]);

  const yesCount = posts?.filter((post) => post.stance === 'yes').length ?? 0;
  const noCount = (posts?.length ?? 0) - yesCount;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    setError(null);

    try {
      const res = await fetch('/api/treasury/market-debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId, marketTitle, stance, body }),
      });
      const data: { post?: DebatePost; error?: string } = await res.json();

      if (!res.ok || !data.post) {
        setError(res.status === 401 ? 'Sign in to join the debate.' : (data.error || 'Could not post your take.'));
        return;
      }

      setPosts((current) => [data.post as DebatePost, ...(current || [])]);
      setDraft('');
    } catch {
      setError('Could not post your take.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    setPosts((current) => (current || []).filter((post) => post.id !== postId));
    try {
      await fetch('/api/treasury/market-debate', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
    } catch {
      // Optimistic removal stands; the post will reappear on next open if the delete failed.
    }
  };

  return (
    <div className={styles.debateSection}>
      <div className={styles.debateHeader}>
        <span className={styles.debateTitle}>Debate</span>
        <span className={styles.debateTally}>
          <span className={styles.debateTallyYes}>{yesCount} yes</span>
          <span className={styles.debateTallyNo}>{noCount} no</span>
        </span>
      </div>

      <form className={styles.debateComposer} onSubmit={handleSubmit}>
        <div className={styles.debateStanceToggle} role="radiogroup" aria-label="Your stance">
          <button
            type="button"
            role="radio"
            aria-checked={stance === 'yes'}
            className={`${styles.debateStanceButton} ${stance === 'yes' ? styles.debateStanceButtonYes : ''}`}
            onClick={() => setStance('yes')}
          >
            Yes
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={stance === 'no'}
            className={`${styles.debateStanceButton} ${stance === 'no' ? styles.debateStanceButtonNo : ''}`}
            onClick={() => setStance('no')}
          >
            No
          </button>
        </div>
        <textarea
          className={styles.debateInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Make your case..."
          rows={2}
          maxLength={500}
          disabled={isPosting}
        />
        <button type="submit" className={styles.debateSubmit} disabled={!draft.trim() || isPosting}>
          {isPosting ? 'Posting...' : 'Post'}
        </button>
      </form>
      {error && <p className={styles.debateError}>{error}</p>}

      <div className={styles.debateList}>
        {posts === null && <p className={styles.debateEmpty}>Loading the debate...</p>}
        {posts !== null && posts.length === 0 && (
          <p className={styles.debateEmpty}>No takes yet. Stake out the first position.</p>
        )}
        {posts?.map((post) => (
          <div key={post.id} className={styles.debatePost}>
            {post.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.avatar_url} alt="" className={styles.debateAvatar} width={26} height={26} />
            ) : (
              <span className={`${styles.debateAvatar} ${styles.debateAvatarFallback}`} aria-hidden="true" />
            )}
            <div className={styles.debatePostMain}>
              <div className={styles.debatePostMeta}>
                <span className={styles.debateAuthor}>{post.username || 'member'}</span>
                <span className={post.stance === 'yes' ? styles.debateStanceYes : styles.debateStanceNo}>
                  {post.stance === 'yes' ? 'Yes' : 'No'}
                </span>
                <span className={styles.debateTime}>{debateTimeAgo(post.created_at)}</span>
                {post.is_own && (
                  <button type="button" className={styles.debateDelete} onClick={() => void handleDelete(post.id)}>
                    Delete
                  </button>
                )}
              </div>
              <p className={styles.debateBody}>{post.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──

export default function Markets() {
  const [prices, setPrices] = useState<CoinPrice[] | null>(null);
  const [balance, setBalance] = useState<TreasuryBalance | null>(null);
  const [kalshiMarkets, setKalshiMarkets] = useState<CategorizedMarkets | null>(null);
  const [shardStats, setShardStats] = useState<ShardTokenStats | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [livePositions, setLivePositions] = useState<LivePosition[]>([]);
  const [balanceError, setBalanceError] = useState(false);
  const [kalshiError, setKalshiError] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<number>(0);
  const [tradeChatMessages, setTradeChatMessages] = useState<TradeChatMessage[]>(INITIAL_TRADE_CHAT);
  const [tradeChatInput, setTradeChatInput] = useState('');
  const [isTradeChatSending, setIsTradeChatSending] = useState(false);
  const [isTradeExecuting, setIsTradeExecuting] = useState(false);
  const [isMembershipOpen, setIsMembershipOpen] = useState(false);
  const [isModelDetailsOpen, setIsModelDetailsOpen] = useState(false);
  // The quant column is pinned open on wide screens; the drawer toggle only
  // matters below the desktop breakpoint.
  const [isDesktopModels, setIsDesktopModels] = useState(false);
  const [hasVipMembershipCard, setHasVipMembershipCard] = useState<boolean | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<{ category: MarketCategory; market: MarketRow } | null>(null);
  // Modal visibility is intentionally separate from the selection: closing the
  // pop-up keeps the market featured (highlighted + pinned) in the feed.
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  // Cakes (the voting token) staked on the selected market. Conviction here is
  // what ultimately fuels Blue's trader mode once a debate resolves.
  const [stakeCakes, setStakeCakes] = useState(15);
  // One-time Daemon spotlight that flags this chat as the community trading desk
  // (not the usual Blue companion). Persisted via safe-storage so it shows once.
  const [showChatSpotlight, setShowChatSpotlight] = useState(false);
  const [visibleMarketCounts, setVisibleMarketCounts] = useState<Record<MarketCategory, number>>({
    elections: INITIAL_VISIBLE_MARKETS,
    politics: INITIAL_VISIBLE_MARKETS,
    culture: INITIAL_VISIBLE_MARKETS,
    science: INITIAL_VISIBLE_MARKETS,
  });
  const tradeChatScrollRef = useRef<HTMLDivElement | null>(null);
  const deferredKalshiMarkets = useDeferredValue(kalshiMarkets);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/treasury/prices');
      if (!res.ok) throw new Error();
      const data: CoinPrice[] = await res.json();
      setPrices(data);
      setLastPriceUpdate(Date.now());
    } catch {
      // The pricing model has stable fallbacks, so the page can keep operating.
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/treasury/balance');
      if (!res.ok) throw new Error();
      const data: TreasuryBalance = await res.json();
      setBalance(data);
      setBalanceError(false);
    } catch {
      setBalanceError(true);
    }
  }, []);

  const fetchKalshi = useCallback(async () => {
    try {
      const res = await fetch('/api/treasury/kalshi');
      if (!res.ok) throw new Error();
      const data: CategorizedMarkets = await res.json();
      setKalshiMarkets(data);
      setKalshiError(false);
    } catch {
      setKalshiError(true);
    }
  }, []);

  const fetchShardStats = useCallback(async () => {
    try {
      const res = await fetch('/api/treasury/apple-stats');
      if (!res.ok) return;
      const data: ShardTokenStats = await res.json();
      setShardStats(data);
    } catch { /* silent */ }
  }, []);

  const fetchExecutionLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/treasury/execution-logs');
      if (!res.ok) return;
      const data = await res.json();
      if (data.logs) setExecutionLogs(data.logs);
      if (data.positions) setLivePositions(data.positions);
    } catch { /* silent */ }
  }, []);

  const fetchAccountStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/account/status');
      if (!res.ok) {
        setHasVipMembershipCard(false);
        return;
      }

      const data: AccountStatusResponse = await res.json();
      setHasVipMembershipCard(Boolean(data.hasVipMembershipCard));
    } catch {
      setHasVipMembershipCard(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchPrices();
    fetchBalance();
    fetchKalshi();

    // Polling intervals
    const priceInterval = setInterval(fetchPrices, 30_000);
    const balanceInterval = setInterval(fetchBalance, 60_000);
    const kalshiInterval = setInterval(fetchKalshi, 60_000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(balanceInterval);
      clearInterval(kalshiInterval);
    };
  }, [fetchPrices, fetchBalance, fetchKalshi]);

  useEffect(() => {
    void fetchAccountStatus();
  }, [fetchAccountStatus]);

  useEffect(() => {
    setVisibleMarketCounts({
      elections: INITIAL_VISIBLE_MARKETS,
      politics: INITIAL_VISIBLE_MARKETS,
      culture: INITIAL_VISIBLE_MARKETS,
      science: INITIAL_VISIBLE_MARKETS,
    });
  }, [kalshiMarkets]);

  useEffect(() => {
    if (!isModelDetailsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModelDetailsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModelDetailsOpen]);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1101px)');
    const sync = () => setIsDesktopModels(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Surface the Daemon spotlight once, a beat after load, if it hasn't been seen.
  useEffect(() => {
    if (getStorageItem(CHAT_SPOTLIGHT_KEY) === '1') return;
    const timer = setTimeout(() => setShowChatSpotlight(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  const dismissChatSpotlight = useCallback(() => {
    setShowChatSpotlight(false);
    setStorageItem(CHAT_SPOTLIGHT_KEY, '1');
  }, []);

  // Fetch credit stats and execution logs
  useEffect(() => {
    fetchShardStats();
    fetchExecutionLogs();
    const shardInterval = setInterval(fetchShardStats, 60_000);
    const logsInterval = setInterval(fetchExecutionLogs, 30_000);
    return () => {
      clearInterval(shardInterval);
      clearInterval(logsInterval);
    };
  }, [fetchShardStats, fetchExecutionLogs]);

  // Fast tick for live model parameter animation
  const modelTick = useLiveTick(1200);

  // ── Derived values from live prices + Kalshi ──
  const derived = useMemo(() => {
    const jitter = (base: number, scale: number, seed: number) =>
      base + Math.sin(modelTick * 0.55 + seed) * scale;

    // Jittered model parameters
    const sigma = jitter(SIGMA, 0.005, 0.7);
    const sigma_b = jitter(SIGMA_B, 0.003, 1.3);
    const lambda_jump = jitter(2.46, 0.05, 2.1);
    const mu_J = jitter(0.071, 0.003, 2.9);
    const q_inv = Math.round(jitter(-1187, 15, 3.6));

    // Step 1-2: Spot & strike (ATM) with micro-movement
    const S = jitter(prices?.find(c => c.symbol === 'BTC')?.usd ?? 66235, 8, 4.2);
    const K = S;

    // Step 3: d2 (ATM: ln(S/K)=0)
    const sqrtT = Math.sqrt(T_EXP);
    const d2 = (R_FREE - 0.5 * sigma * sigma) * T_EXP / (sigma * sqrtT);

    // Step 4-5: N(d2) and C_bin
    const Nd2 = normalCDF(d2);
    const C_bin = Math.exp(-R_FREE * T_EXP) * Nd2;

    // Step 6-7: Logit transform
    const p_t = C_bin;
    const x_t = Math.log(p_t / (1 - p_t));

    // Step 8: A-S half-spread (using jittered sigma_b)
    const delta_x = GAMMA * sigma_b * sigma_b * T_EXP / 2 + (1 / GAMMA) * Math.log(1 + GAMMA / K_DECAY);

    // Step 9: Bid/ask probabilities
    const p_bid = 1 / (1 + Math.exp(-(x_t - delta_x)));
    const p_ask = 1 / (1 + Math.exp(-(x_t + delta_x)));

    // Step 10-11: Edge detection
    const model_fair = C_bin * 100;
    const mkt_price = findBtcMarket(kalshiMarkets) ?? FALLBACK_MKT_PRICE;

    // Step 12-13: Divergence & signal
    const divergence = model_fair - mkt_price;
    const signal = Math.abs(divergence) > EDGE_THRESHOLD ? 'TRADE' : 'SKIP';

    // Step 14: Fee
    const fee = (p_t * (1 - p_t) + 0.0625) * 100;

    return {
      S, K, d2, Nd2, C_bin, p_t, x_t, delta_x,
      p_bid, p_ask, model_fair, mkt_price, divergence,
      signal, fee,
      sigma, sigma_b, lambda_jump, mu_J, q_inv,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, kalshiMarkets, modelTick]);

  const mixedMarkets = useMemo(() => {
    if (!deferredKalshiMarkets) return [];

    const perCategory = MARKET_CATEGORIES.map((category) => ({
      category,
      items: (deferredKalshiMarkets[category] || []).slice(0, visibleMarketCounts[category] ?? INITIAL_VISIBLE_MARKETS),
    }));

    const maxLength = Math.max(0, ...perCategory.map(({ items }) => items.length));
    const mixed: Array<{ category: MarketCategory; market: MarketRow }> = [];

    for (let index = 0; index < maxLength; index += 1) {
      for (const entry of perCategory) {
        const market = entry.items[index];
        if (market) mixed.push({ category: entry.category, market });
      }
    }

    return mixed;
  }, [deferredKalshiMarkets, visibleMarketCounts]);

  const hasMoreMixedMarkets = useMemo(() => {
    if (!deferredKalshiMarkets) return false;
    return MARKET_CATEGORIES.some((category) => {
      const total = deferredKalshiMarkets[category]?.length ?? 0;
      return total > (visibleMarketCounts[category] ?? INITIAL_VISIBLE_MARKETS);
    });
  }, [deferredKalshiMarkets, visibleMarketCounts]);

  // The selected market is pinned to the top of the feed as the featured card.
  // If a feed refresh has a fresher snapshot of it, prefer that one.
  const orderedMarkets = useMemo(() => {
    if (!selectedMarket) return mixedMarkets;
    const selectedId = selectedMarket.market.id;
    const fresh = mixedMarkets.find((entry) => entry.market.id === selectedId);
    const rest = mixedMarkets.filter((entry) => entry.market.id !== selectedId);
    return [fresh ?? selectedMarket, ...rest];
  }, [mixedMarkets, selectedMarket]);

  useEffect(() => {
    const node = tradeChatScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [tradeChatMessages, isTradeChatSending]);


  const buildBlueTradingMessage = useCallback((userMessage: string) => {
    const priceSnapshot = prices?.slice(0, 6).map((coin) => (
      `${coin.symbol}: ${formatPrice(coin.usd)}, 24h volume ${formatVol(coin.usd_24h_vol)}`
    )).join('\n') || 'price feed not loaded';

    const signalMarkets = deferredKalshiMarkets
      ? MARKET_CATEGORIES
        .flatMap((cat) => (deferredKalshiMarkets[cat] || []).slice(0, 2).map((market) => {
          const [yes, no] = parseOutcomePrices(market.outcomePrices);
          return `${CATEGORY_LABELS[cat]}: ${market.question} | yes ${Math.round(yes * 100)}% no ${Math.round(no * 100)}% volume ${formatVol(market.volume)}`;
        }))
        .slice(0, 6)
        .join('\n')
      : 'Kalshi feed not loaded';

    const recentExecution = executionLogs.slice(0, 5).map((log) => (
      `${formatTradeTime(String(log.timestamp / 1000))} ${log.action}${log.asset ? ` ${log.asset}` : ''}: ${log.details}`
    )).join('\n') || 'no recent execution logs';

    const openPositionSummary = livePositions.length > 0
      ? livePositions.map((position) => (
        `${position.asset} ${position.side} @ ${Math.round(parseFloat(position.price) * 100)}c size ${position.sizeMatched || position.size} status ${position.status}`
      )).join('\n')
      : 'no open positions';

    return [
      'You are Blue responding inside the /markets trading desk.',
      'The user wants Blue to trade for them. Treat direct trade requests as trading instructions for the protected trading engine.',
      'If the user asks to "stage the highest-conviction trade", treat that as the strongest staging request and explicitly weigh trade size, the price gap threshold, live asks, open positions, and execution safety before answering.',
      'Execution is VIP-gated. Only the verified VIP Membership Card wallet can submit a live Kalshi order.',
      'Do not claim an order filled unless the execution log confirms it. If execution is not confirmed, say you are routing, monitoring, or preparing the trade.',
      'When useful, answer with the intended market, direction, sizing posture, risk check, and next execution step. Keep it concise and conversational.',
      '',
      'Live model snapshot:',
      `signal: ${derived.signal}`,
      `Blue estimate: ${derived.model_fair.toFixed(2)}%`,
      `market price: ${derived.mkt_price.toFixed(2)}%`,
      `price gap: ${derived.divergence >= 0 ? '+' : ''}${derived.divergence.toFixed(2)}%`,
      `size cap: 0.25x`,
      `USDC markets balance: ${balance ? '$' + balance.formatted : 'not loaded'}`,
      `Credits price: ${shardStats ? formatPrice(shardStats.price) : 'not loaded'}`,
      '',
      'Price snapshot:',
      priceSnapshot,
      '',
      'Signal markets:',
      signalMarkets,
      '',
      'Open positions:',
      openPositionSummary,
      '',
      'Recent execution:',
      recentExecution,
      '',
      `User command: ${userMessage}`,
    ].join('\n');
  }, [shardStats, balance, deferredKalshiMarkets, derived, executionLogs, livePositions, prices]);

  const generateLocalTradeResponse = useCallback((userMessage: string) => {
    const command = userMessage.toLowerCase();
    const posture = Math.abs(derived.divergence) > EDGE_THRESHOLD ? 'actionable' : 'below threshold';
    const direction = derived.divergence >= 0 ? 'yes/upside' : 'no/downside';

    if (command.includes('trade') || command.includes('buy') || command.includes('sell') || command.includes('size')) {
      return `I'm reading that as a ${direction} instruction, but the signal is still ${posture}. Blue's estimate is ${derived.model_fair.toFixed(2)}%, the market price is ${derived.mkt_price.toFixed(2)}%, and I'll keep size capped at 0.25x until the protected route confirms the order.`;
    }

    return `Current read: ${derived.signal.toLowerCase()}. Blue's estimate is ${derived.model_fair.toFixed(2)}%, the market price is ${derived.mkt_price.toFixed(2)}%, and the price gap is ${derived.divergence >= 0 ? '+' : ''}${derived.divergence.toFixed(2)}%.`;
  }, [derived]);

  const sendTradeChatMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isTradeChatSending) return;

    setTradeChatMessages((current) => [
      ...current,
      { role: 'user', text, timestamp: Date.now() },
    ]);
    setTradeChatInput('');
    setIsTradeChatSending(true);

    try {
      const res = await fetch('/api/chat/blue-markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: buildBlueTradingMessage(text),
        }),
      });

      const data: { response?: string; error?: string; message?: string } = await res.json();
      const responseText = (res.ok && data.response) ? data.response : generateLocalTradeResponse(text);

      setTradeChatMessages((current) => [
        ...current,
        { role: 'blue', text: responseText, timestamp: Date.now() },
      ]);
    } catch {
      setTradeChatMessages((current) => [
        ...current,
        { role: 'blue', text: generateLocalTradeResponse(text), timestamp: Date.now() },
      ]);
    } finally {
      setIsTradeChatSending(false);
    }
  }, [buildBlueTradingMessage, generateLocalTradeResponse, isTradeChatSending]);

  // Open the chat with Blue already analyzing the clicked market. The selection
  // is kept so the market stays featured in the feed while the debate runs.
  const askBlueAboutMarket = useCallback((entry: { category: MarketCategory; market: MarketRow }) => {
    const [yes, no] = parseOutcomePrices(entry.market.outcomePrices);
    const question =
      `What's your read on this market: "${entry.market.question}"? ` +
      `It's trading Yes ${Math.round(yes * 100)}% / No ${Math.round(no * 100)}%. Is there an edge?`;
    setIsMarketModalOpen(false);
    setIsChatOpen(true);
    void sendTradeChatMessage(question);
  }, [sendTradeChatMessage]);

  // TODO(cakes-ledger): wire this to a real Cakes staking backend once the
  // ledger exists. Until then Trader Mode is a staged request — it frames the
  // pipeline (drift read, Black-Scholes, quarter-Kelly) in Blue's chat and
  // never claims an execution or a fill.
  const activateTraderMode = useCallback((entry: { category: MarketCategory; market: MarketRow }) => {
    const [yes, no] = parseOutcomePrices(entry.market.outcomePrices);
    const prompt =
      `Trader Mode request (staged, not executed): I want to stake ${stakeCakes} Cakes on ` +
      `"${entry.market.question}", trading Yes ${Math.round(yes * 100)}% / No ${Math.round(no * 100)}%. ` +
      `Walk me through how you would position it: the 15-minute Kalshi drift read, the Black-Scholes fair value, ` +
      `and the quarter-Kelly size. Do not place an order — the Cakes ledger is not live yet.`;
    setIsMarketModalOpen(false);
    setIsChatOpen(true);
    void sendTradeChatMessage(prompt);
  }, [sendTradeChatMessage, stakeCakes]);

  const executedTrades = executionLogs.filter((log) => log.action === 'TRADE');

  const handleTradeChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendTradeChatMessage(tradeChatInput);
  };

  const handleExecuteTrade = useCallback(async (sourceText: string) => {
    if (isTradeExecuting) return;

    if (hasVipMembershipCard !== true) {
      setIsMembershipOpen(true);
      return;
    }

    setIsTradeExecuting(true);

    try {
      const res = await fetch('/api/treasury/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText }),
      });

      const data: {
        success?: boolean;
        error?: string;
        message?: string;
        order?: { status?: string };
        plan?: { side: 'yes' | 'no'; ticker: string; count: number; priceCents: number };
        logs?: ExecutionLogEntry[];
        positions?: LivePosition[];
      } = await res.json();

      if (!res.ok || !data.success || !data.plan) {
        const failureMessage = data.message || 'kalshi execution did not complete.';
        setTradeChatMessages((current) => [
          ...current,
          { role: 'blue', text: failureMessage, timestamp: Date.now() },
        ]);
        if (res.status === 401 || res.status === 403) {
          setIsMembershipOpen(true);
        }
        return;
      }

      if (data.logs) setExecutionLogs(data.logs);
      if (data.positions) setLivePositions(data.positions);

      const sideLabel = data.plan.side.toUpperCase();
      const confirmation =
        `vip route confirmed: ${sideLabel} ${data.plan.ticker} @ ${data.plan.priceCents}c x ${data.plan.count}. ` +
        `kalshi status: ${data.order?.status || 'submitted'}.`;

      setTradeChatMessages((current) => [
        ...current,
        { role: 'blue', text: confirmation, timestamp: Date.now() },
      ]);
    } catch {
      setTradeChatMessages((current) => [
        ...current,
        {
          role: 'blue',
          text: 'the vip router hit an execution error before Kalshi confirmed the order.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTradeExecuting(false);
    }
  }, [hasVipMembershipCard, isTradeExecuting]);

  return (
    <main className={styles.main}>
      <SideNavigation />
      <div className={styles.pageLayout}>

        {/* ── Status Bar ── */}
        <div className={styles.statusBar}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>model</span>
            <span className={styles.statusHighlight}>Black-Scholes binary</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>markets:</span>
            <span className={styles.statusValue}>elections politics culture science</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>MC_paths:</span>
            <span className={styles.statusValue}>200,000</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>feeds:</span>
            <span className={styles.statusValue}>30-60s</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>pulse:</span>
            <span className={styles.statusValue}>1.2s</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>edge_threshold:</span>
            <span className={styles.statusHighlight}>3%</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>kelly:</span>
            <span className={styles.statusValue}>0.25x</span>
          </div>
          {lastPriceUpdate > 0 && (
            <div className={styles.statusItem}>
              <LastUpdatedLabel timestamp={lastPriceUpdate} />
            </div>
          )}
          <div className={styles.statusItem}>
            <HowToButton />
          </div>
          <div className={styles.statusItem}>
            <button
              type="button"
              className={styles.modelDetailsButton}
              onClick={() => setIsModelDetailsOpen(true)}
            >
              Model details
            </button>
          </div>
        </div>

        {isModelDetailsOpen && (
          <button
            type="button"
            className={styles.modelDetailsBackdrop}
            aria-label="Close model details"
            onClick={() => setIsModelDetailsOpen(false)}
          />
        )}

        {/* ── Desk Header Row: treasury balance | Trade Using Blue | receipt ── */}
        <div className={styles.deskRow}>
          <aside className={styles.treasuryFloat} aria-label="Trades treasury">
            <span className={styles.treasuryFloatTitle}>Trades Treasury</span>
            {!balance && !balanceError && (
              <TreasuryQuickSkeleton />
            )}
            {balanceError && !balance && (
              <span className={styles.errorText}>Failed to load balance</span>
            )}
            {balance && (
              <>
                <div className={styles.treasuryQuickPrimary}>
                  <div className={styles.balanceHero}>${balance.formatted}</div>
                  <div className={styles.balanceLabel}>USDC Trades Balance</div>
                </div>
                <div className={styles.treasuryQuickSpark}>
                  <TickerLine stroke="var(--color-primary)" strokeWidth={2} opacity={0.85} />
                  <TickerLine drift={0.18} vol={0.8} stroke="var(--color-tertiary)" strokeWidth={1.5} opacity={0.55} speed={350} />
                  <TickerLine drift={0.05} vol={0.5} stroke="var(--color-primary)" strokeWidth={1.5} opacity={0.5} speed={500} />
                </div>
              </>
            )}
          </aside>

          <div className={styles.receipt} aria-label="Executed trades history">
            <div className={styles.receiptHead}>
              <span className={styles.receiptShop}>MWA Trading Desk</span>
              <span className={styles.receiptSub}>execution receipts</span>
            </div>
            <div className={styles.receiptRule} />
            <div className={styles.receiptBody}>
              {executedTrades.length === 0 ? (
                <p className={styles.receiptEmpty}>- awaiting first execution -</p>
              ) : (
                executedTrades.map((log, i) => (
                  <div key={`${log.timestamp}-${i}`} className={styles.receiptItem}>
                    <div className={styles.receiptItemTop}>
                      <span>{formatTradeTime(String(log.timestamp / 1000))}</span>
                      <span className={styles.receiptAction}>{log.action}</span>
                    </div>
                    <div className={styles.receiptItemDetail}>
                      {log.asset ? `${log.asset} ` : ''}{log.details}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.receiptRule} />
            <div className={styles.receiptFoot}>
              <span>{executedTrades.length} fill{executedTrades.length === 1 ? '' : 's'}</span>
              <span aria-hidden="true">* * *</span>
            </div>
          </div>
        </div>

        {/* ── Dashboard Grid ── */}
        <div className={styles.grid}>

          {/* ════ POP-UP: Model Parameters ════ */}
          <aside
            className={`${styles.modelsColumn} ${isModelDetailsOpen ? styles.modelsColumnOpen : ''}`}
            aria-hidden={!(isDesktopModels || isModelDetailsOpen)}
            aria-label="Quant engine"
            aria-modal={!isDesktopModels && isModelDetailsOpen}
            role={isDesktopModels ? 'complementary' : 'dialog'}
          >
            <div className={styles.modelDrawerHeader}>
              <div>
                <span className={styles.modelDrawerKicker}>Live</span>
                <h2 className={styles.modelDrawerTitle}>Quant engine</h2>
              </div>
              <button
                type="button"
                className={styles.modelDrawerClose}
                onClick={() => setIsModelDetailsOpen(false)}
              >
                Close
              </button>
            </div>

            {/* Black-Scholes Binary Pricing */}
            <div className={styles.modelPanel}>
              <div className={styles.modelName}>{'// black-scholes binary pricing'}</div>
              <div className={styles.modelFormula}>
                C_binary = e^(-rT) &middot; N(d&#x2082;)
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>d&#x2082;</span>
                <span><span className={styles.paramValue}>{derived.d2.toFixed(6)}</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>N(d&#x2082;)</span>
                <span><span className={styles.paramValue}>{derived.Nd2.toFixed(5)}</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>C_bin</span>
                <span><span className={styles.paramValue}>{'$' + derived.C_bin.toFixed(4)}</span></span>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className={styles.modelName}>{'// parameters'}</div>
                <div className={styles.paramRow}>
                  <span className={styles.paramKey}>S</span>
                  <span>
                    <span className={styles.paramValue}>{'$' + derived.S.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                    <span className={styles.paramComment}>{'// spot'}</span>
                  </span>
                </div>
                <div className={styles.paramRow}>
                  <span className={styles.paramKey}>K</span>
                  <span>
                    <span className={styles.paramValue}>{'$' + derived.K.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                    <span className={styles.paramComment}>{'// strike'}</span>
                  </span>
                </div>
                <div className={styles.paramRow}>
                  <span className={styles.paramKey}>&sigma;</span>
                  <span>
                    <span className={styles.paramValue}>{(derived.sigma * 100).toFixed(2)}%</span>
                    <span className={styles.paramComment}>{'// annual IV'}</span>
                  </span>
                </div>
                <div className={styles.paramRow}>
                  <span className={styles.paramKey}>T</span>
                  <span>
                    <span className={styles.paramValue}>0.0000095</span>
                    <span className={styles.paramComment}>{'// 5min/yr'}</span>
                  </span>
                </div>
                <div className={styles.paramRow}>
                  <span className={styles.paramKey}>r</span>
                  <span>
                    <span className={styles.paramValue}>4.33%</span>
                    <span className={styles.paramComment}>{'// risk-free'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Logit Jump-Diffusion */}
            <div className={styles.modelPanel}>
              <div className={styles.modelName}>{'// logit jump-diffusion'}</div>
              <div className={styles.modelFormula}>
                x_t = ln(p/(1-p))
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>x_t</span>
                <span><span className={styles.paramValue}>{derived.x_t.toFixed(4)}</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>p_t</span>
                <span><span className={styles.paramValue}>{derived.p_t.toFixed(4)}</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>&sigma;_b</span>
                <span>
                  <span className={styles.paramValue}>{derived.sigma_b.toFixed(3)}</span>
                  <span className={styles.paramComment}>{'// belief vol'}</span>
                </span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>&lambda;_jump</span>
                <span>
                  <span className={styles.paramValue}>{derived.lambda_jump.toFixed(2)}</span>
                  <span className={styles.paramComment}>{'// intensity'}</span>
                </span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>&mu;_J</span>
                <span>
                  <span className={styles.paramValue}>{derived.mu_J.toFixed(3)}</span>
                  <span className={styles.paramComment}>{'// jump size'}</span>
                </span>
              </div>
            </div>

            {/* Avellaneda-Stoikov Market Making */}
            <div className={styles.modelPanel}>
              <div className={styles.modelName}>{'// avellaneda-stoikov market making'}</div>
              <div className={styles.modelFormula}>
                r_x = x_t - q&middot;&gamma;&middot;&sigma;&sup2;_b&middot;(T-t)
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>q_inv</span>
                <span>
                  <span className={styles.paramValue}>{derived.q_inv.toLocaleString('en-US').replace(/,/g, ' ')}</span>
                  <span className={styles.paramComment}>{'// inventory'}</span>
                </span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>&gamma;</span>
                <span>
                  <span className={styles.paramValue}>0.10</span>
                  <span className={styles.paramComment}>{'// risk aversion'}</span>
                </span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>k</span>
                <span>
                  <span className={styles.paramValue}>1.50</span>
                  <span className={styles.paramComment}>{'// arrival decay'}</span>
                </span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>&delta;_x</span>
                <span>
                  <span className={styles.paramValue}>{derived.delta_x.toFixed(4)}</span>
                  <span className={styles.paramComment}>{'// half-spread'}</span>
                </span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>p_bid</span>
                <span><span className={styles.paramValue}>{(derived.p_bid * 100).toFixed(1)}&cent;</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>p_ask</span>
                <span><span className={styles.paramValue}>{(derived.p_ask * 100).toFixed(1)}&cent;</span></span>
              </div>
            </div>

            {/* Edge Detection Pipeline */}
            <div className={styles.modelPanel}>
              <div className={styles.modelName}>{'// edge detection pipeline'}</div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>model_fair</span>
                <span><span className={styles.paramValue}>{derived.model_fair.toFixed(2)}%</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>mkt_price</span>
                <span><span className={styles.paramValue}>{derived.mkt_price.toFixed(2)}%</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>divergence</span>
                <span><span className={styles.paramValue}>{derived.divergence >= 0 ? '+' : ''}{derived.divergence.toFixed(2)}%</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>threshold</span>
                <span><span className={styles.paramValue}>3.00%</span></span>
              </div>
              <div
                className={styles.signalRow}
                style={derived.signal === 'SKIP' ? { background: 'color-mix(in oklch, var(--markets-no) 9%, transparent)', borderColor: 'color-mix(in oklch, var(--markets-no) 22%, transparent)' } : undefined}
              >
                <span className={styles.signalLabel}>signal</span>
                <span className={derived.signal === 'TRADE' ? styles.signalValue : styles.signalSkip}>
                  &rarr; {derived.signal}
                </span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>kelly_f</span>
                <span><span className={styles.paramValue}>0.25x</span></span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramKey}>fee</span>
                <span>
                  <span className={styles.paramValue}>{derived.fee.toFixed(2)}%</span>
                  <span className={styles.paramComment}>{'// p(1-p)+0.0625'}</span>
                </span>
              </div>
              <p className={styles.tradeCheckHelp}>
                Blue only considers a trade when her estimate and the market price are at least 3% apart.
              </p>
            </div>
          </aside>

          {/* ════ CENTER: Charts ════ */}

          {/* Kalshi Signal Markets */}
          <div className={`${styles.panel} ${styles.chartPanel} ${styles.kalshiPanel}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Trades</span>
            </div>
            <div className={styles.marketArena}>
              {!deferredKalshiMarkets && !kalshiError && (
                <MarketListSkeleton />
              )}
              {kalshiError && !deferredKalshiMarkets && (
                <span className={styles.errorText}>Failed to load Kalshi data</span>
              )}
              {deferredKalshiMarkets && (
                <>
                  <div className={styles.marketCards}>
                    {orderedMarkets.map(({ category, market }) => {
                      const [yes, no] = parseOutcomePrices(market.outcomePrices);
                      const yesPct = Math.round(yes * 100);
                      const noPct = Math.round(no * 100);
                      const iconSrc = market.iconUrl || CATEGORY_AVATARS[category];
                      const isFeatured = selectedMarket?.market.id === market.id;
                      const isMuted = Boolean(selectedMarket) && !isFeatured;

                      return (
                        <button
                          key={market.id}
                          type="button"
                          className={`${styles.marketItem} ${isFeatured ? styles.marketItemFeatured : ''} ${isMuted ? styles.marketItemMuted : ''}`}
                          onClick={() => {
                            setSelectedMarket({ category, market });
                            setIsMarketModalOpen(true);
                          }}
                        >
                          <div className={styles.marketItemTop}>
                            <div className={styles.marketItemHeader}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={iconSrc}
                                alt=""
                                className={styles.marketIcon}
                                width={44}
                                height={44}
                                loading="lazy"
                              />
                              <div className={styles.marketQuestion}>{market.question}</div>
                            </div>
                            <div className={styles.marketPillGroup}>
                              {isFeatured && <span className={styles.marketFeaturedTag}>Featured</span>}
                              <div className={styles.marketPill}>{CATEGORY_LABELS[category]}</div>
                            </div>
                          </div>
                          <div className={styles.marketBarWrap}>
                            <div className={styles.marketBar}>
                              <div className={styles.marketYes} style={{ width: `${yesPct}%` }} />
                              <div className={styles.marketNo} style={{ width: `${noPct}%` }} />
                            </div>
                            <div className={styles.marketBarValues}>
                              <span className={styles.marketBarValueYes}>Yes {yesPct}%</span>
                              <span className={styles.marketBarValueNo}>No {noPct}%</span>
                            </div>
                          </div>
                          <div className={styles.marketMeta}>
                            <span>Volume {formatVol(market.volume)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {hasMoreMixedMarkets && (
                    <button
                      type="button"
                      className={styles.marketLoadMore}
                      onClick={() => {
                        setVisibleMarketCounts((current) => (
                          MARKET_CATEGORIES.reduce<Record<MarketCategory, number>>((next, category) => {
                            const total = deferredKalshiMarkets[category]?.length ?? 0;
                            next[category] = Math.min((current[category] ?? INITIAL_VISIBLE_MARKETS) + 1, total);
                            return next;
                          }, { ...current })
                        ));
                      }}
                    >
                      Show more
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ════ Blue Trading Chat panel ════ */}
          <section
            className={`${styles.blueTradeColumn} ${isChatOpen ? styles.blueTradeColumnOpen : ''}`}
            aria-label="Blue trading chat"
            aria-hidden={!isChatOpen}
          >
            <div className={styles.blueChatHeader}>
              <span className={styles.blueChatTitle}>Trade Using Blue</span>
              <button
                type="button"
                className={styles.blueChatClose}
                onClick={() => setIsChatOpen(false)}
                aria-label="Close chat"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.blueChatMessages} ref={tradeChatScrollRef}>
              {tradeChatMessages.map((message, index) => {
                const canExecute = message.role === 'blue' && index > 0 && tradeChatMessages[index - 1].role === 'user';
                return (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={`${styles.blueChatBubble} ${message.role === 'user' ? styles.blueChatUser : styles.blueChatBlue}`}
                  >
                    {message.role === 'blue' && (
                      <div className={styles.blueAvatar} aria-hidden="true">
                        <Image src="/uploads/blueagent.png" alt="" width={28} height={28} className={styles.blueAvatarImage} />
                      </div>
                    )}
                    <div className={styles.blueBubbleStack}>
                      <div className={styles.blueBubbleText}>{message.text}</div>
                      {canExecute && (
                        <button
                          type="button"
                          className={styles.blueExecuteButton}
                          onClick={() => void handleExecuteTrade(tradeChatMessages[index - 1]?.text || message.text)}
                          disabled={isTradeExecuting}
                        >
                          {hasVipMembershipCard === true
                            ? (isTradeExecuting ? 'Routing...' : 'Execute this trade')
                            : (hasVipMembershipCard === null ? 'Checking VIP...' : 'VIP card required')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {isTradeChatSending && (
                <div className={`${styles.blueChatBubble} ${styles.blueChatBlue}`}>
                  <div className={styles.blueAvatar} aria-hidden="true">
                    <Image src="/uploads/blueagent.png" alt="" width={28} height={28} className={styles.blueAvatarImage} />
                  </div>
                  <div className={styles.blueTyping}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.blueQuickActions} aria-label="Suggested trading prompts">
              {TRADE_CHAT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void sendTradeChatMessage(suggestion)}
                  disabled={isTradeChatSending || isTradeExecuting}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form className={styles.blueTradeComposer} onSubmit={handleTradeChatSubmit}>
              <textarea
                value={tradeChatInput}
                onChange={(event) => setTradeChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendTradeChatMessage(tradeChatInput);
                  }
                }}
                placeholder="Ask Blue..."
                rows={2}
                disabled={isTradeChatSending || isTradeExecuting}
              />
              <button type="submit" disabled={!tradeChatInput.trim() || isTradeChatSending || isTradeExecuting}>
                {isTradeExecuting ? 'Busy' : 'Send'}
              </button>
            </form>
          </section>

        </div>

        {/* ── Docked chat launcher + one-time Daemon spotlight ── */}
        <div className={styles.chatDock}>
          {showChatSpotlight && !isChatOpen && (
            <div className={styles.daemonSpotlight} role="status">
              <div className={styles.daemonSpotlightHead}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/daemon.svg" alt="" className={styles.daemonSpotlightIcon} width={15} height={15} />
                <span className={styles.daemonSpotlightKicker}>Daemon</span>
                <button
                  type="button"
                  className={styles.daemonSpotlightClose}
                  onClick={dismissChatSpotlight}
                  aria-label="Dismiss"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <p className={styles.daemonSpotlightBody}>
                This is not the usual Blue. Here she trades the community treasury &mdash; back a
                market with Cakes and she makes the case, then positions the trade.
              </p>
            </div>
          )}

          <button
            type="button"
            className={styles.chatFab}
            onClick={() => {
              setIsChatOpen((open) => !open);
              dismissChatSpotlight();
            }}
            aria-expanded={isChatOpen}
            aria-label={isChatOpen ? 'Close Blue trading chat' : 'Trade using Blue'}
          >
            <span className={styles.chatFabShine} aria-hidden="true" />
            <span className={styles.chatFabContent}>
              <span className={styles.chatFabIcon} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5.5 16.5H5a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-5.5 4v-4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7.5 9.5h9M7.5 12.5h5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className={styles.chatFabTitle}>{isChatOpen ? 'Close chat' : 'Trade Using Blue'}</span>
            </span>
          </button>
        </div>
      </div>
      <ProMembershipModal isOpen={isMembershipOpen} onClose={() => setIsMembershipOpen(false)} />

      {selectedMarket && isMarketModalOpen && typeof document !== 'undefined' && createPortal(
        (() => {
          const [yes, no] = parseOutcomePrices(selectedMarket.market.outcomePrices);
          const yesPct = Math.round(yes * 100);
          const noPct = Math.round(no * 100);
          const iconSrc = selectedMarket.market.iconUrl || CATEGORY_AVATARS[selectedMarket.category];
          return (
            <div className={styles.marketModalOverlay} onClick={() => setIsMarketModalOpen(false)}>
              <div
                className={styles.marketModalCard}
                role="dialog"
                aria-modal="true"
                aria-label="Market detail"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className={styles.marketModalClose}
                  onClick={() => setIsMarketModalOpen(false)}
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>

                <div className={styles.marketModalColumns}>
                  {/* Left: the market hero */}
                  <div className={styles.marketModalHero}>
                    <div className={styles.marketModalHead}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={iconSrc} alt="" className={styles.marketModalIcon} width={88} height={88} />
                      <span className={styles.marketPill}>{CATEGORY_LABELS[selectedMarket.category]}</span>
                    </div>
                    <h2 className={styles.marketModalTitle}>{selectedMarket.market.question}</h2>
                    <div className={styles.marketBar}>
                      <div className={styles.marketYes} style={{ width: `${yesPct}%` }} />
                      <div className={styles.marketNo} style={{ width: `${noPct}%` }} />
                    </div>
                    <div className={styles.marketModalValues}>
                      <span className={styles.marketBarValueYes}>Yes {yesPct}%</span>
                      <span className={styles.marketBarValueNo}>No {noPct}%</span>
                    </div>
                    <div className={styles.marketModalMeta}>Volume {formatVol(selectedMarket.market.volume)}</div>
                  </div>

                  {/* Right: stake, Ask Blue, Trader Mode, debate */}
                  <div className={styles.marketModalAction}>
                    <div className={styles.stakePanel}>
                      <div className={styles.stakePanelHead}>
                        <span className={styles.stakeLabel}>Back this with Cakes</span>
                        <span className={styles.stakeReadout}>{stakeCakes}</span>
                      </div>
                      <div className={styles.stakeChips}>
                        {[5, 15, 30, 50].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            className={`${styles.stakeChip} ${stakeCakes === amount ? styles.stakeChipActive : ''}`}
                            onClick={() => setStakeCakes(amount)}
                          >
                            {amount}
                          </button>
                        ))}
                        <input
                          className={styles.stakeInput}
                          type="number"
                          min={1}
                          max={9999}
                          value={stakeCakes}
                          onChange={(event) => setStakeCakes(Math.max(1, Math.min(9999, Number(event.target.value) || 1)))}
                          aria-label="Cakes to stake"
                        />
                      </div>
                    </div>

                    <CtaButton
                      variant="primary"
                      size="lg"
                      block
                      onClick={() => askBlueAboutMarket(selectedMarket)}
                    >
                      Ask Blue
                    </CtaButton>
                    <CtaButton
                      variant="secondary"
                      block
                      onClick={() => activateTraderMode(selectedMarket)}
                    >
                      Activate Trader Mode
                    </CtaButton>
                    <p className={styles.actionHelp}>
                      Your Cakes back a community trade. Blue argues the case, then sizes it for the
                      treasury. Nothing executes yet.
                    </p>

                    <MarketDebate
                      marketId={selectedMarket.market.ticker || selectedMarket.market.id}
                      marketTitle={selectedMarket.market.question}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })(),
        document.body,
      )}
    </main>
  );
}
