'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import styles from './BlueChat.module.css';
import { useSound } from '@/hooks/useSound';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';

import ListsPanel from './ListsPanel';
import QuestForgeInline from './QuestForgeInline';
import GuideCardsInline from './GuideCardsInline';
import type { GuideRecommendCard } from '@/lib/guide-api-schemas';
import type { QuestForgeDraft, QuestForgeRequest } from './QuestForgeInline';
import { sendUsdcOnBase, type Eip1193Provider } from '@/lib/usdc-base-transfer';
import { sendDiamonds, sendDiamondsBurn } from '@/lib/diamonds-base-transfer';
import { getChainConfig } from '@/lib/chain-config';
import { broadcastPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';

const ProMembershipModal = dynamic(() => import('../pro-membership-modal/ProMembershipModal'), { ssr: false });

const VOICE_PREF_KEY = 'blueChat.voiceEnabled';

const GREETINGS_VOICE = [
  "you're back. i had a feeling you would be.",
  "you called! i was mid nap. i regret nothing and i'm listening.",
  "oh, it's you! i dropped everything. i already forget what everything was, so perfect timing.",
];
const GREETINGS_TEXT = [
  "you're back! i kept your spot. it's a chat window, but i kept it anyway.",
  "oh hey, i remember you. i forget half of everything and you're in the half i keep.",
  "you're here! i was reorganizing my folders. one is just called Shiny Things, it's my best work. what are we into today?",
];

// ── Blue Voice TTS ──────────────────────────────────────────
async function speakBlue(text: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error('TTS request failed');
  const { audio } = await res.json();
  if (!audio) throw new Error('No audio data');

  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);

  return new Promise<void>((resolve, reject) => {
    const el = new Audio(url);
    el.volume = 0.4;

    // Aborting mid-playback has to stop the audio too, or a superseded line
    // keeps talking over the new one.
    const stop = () => {
      el.pause();
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanup = () => {
      signal?.removeEventListener('abort', stop);
      URL.revokeObjectURL(url);
    };

    if (signal?.aborted) { stop(); return; }
    signal?.addEventListener('abort', stop);

    el.onended = () => { cleanup(); resolve(); };
    el.onerror = () => { cleanup(); reject(new Error('Audio playback error')); };
    el.play().catch((err) => { cleanup(); reject(err); });
  });
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'blue';
  timestamp: Date;
  attachments?: UploadedAttachment[];
  debug?: MessageDebugInfo;
  /** Knowledge-node cards from the guide finder, rendered under the text. */
  guideCards?: GuideRecommendCard[];
}

interface MessageDebugInfo {
  source: 'eliza' | 'local-fallback';
  mode: 'chat' | 'research' | 'auto-distribution';
  shardsDeducted: number;
  shardBalance?: number | null;
  memory?: {
    recentMessages: number;
    recentFacts: number;
    streak: number;
    completedQuestCount: number;
    completedTaskCount: number;
    sealedWeeks: number;
    highestWeekTouched: number | null;
  };
  extractedFactsCount?: number;
  rag?: {
    pathname: string | null;
    entriesRetrieved: number;
    entries: Array<{
      id: string;
      title: string;
      score: number;
      matchedTerms?: string[];
    }>;
  };
  notes?: string[];
}

interface ViewerProfile {
  username: string | null;
}

/** Blue's replies can still carry attachments; the chat no longer sends them. */
interface UploadedAttachment {
  id: string;
  mime: string;
  size: number;
  name: string;
  extractedText?: string | null;
}

interface BlueChatProps {
  isOpen: boolean;
  onClose: () => void;
  startWithVoice?: boolean;
}

interface ShardUpsellState {
  required: number;
  current: number;
  reason: 'chat';
}

interface TreasuryContext {
  balance: string | null;
  balanceUsd: number | null;
  governanceBalance: string | null;
  traderBalance: string | null;
  prices: { symbol: string; usd: number; change: number | null }[];
  topMarkets: { question: string; yes: number }[];
}

// Detects when a typed message is asking Blue to CREATE a quest (vs. asking
// what quests are). Conservative on purpose so normal chat isn't hijacked.
function isQuestForgeIntent(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!/\bquest(s)?\b/.test(t)) return false;
  if (/^(what|how|why|where|when|who)\b/.test(t)) return false;
  return /\b(make|create|build|forge|set ?up|launch|design|spin up|publish)\b/.test(t) || /\bnew quest\b/.test(t);
}

// Detects when a typed message is asking Blue to DELETE the user's custom
// course. Blue has no server-side tools, so without this the model would just
// pretend it deleted something — instead we run a real confirm-then-delete flow.
function isCourseDeleteIntent(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!/\bcourses?\b/.test(t)) return false;
  return /\b(delete|remove|erase|trash|scrap|wipe|get rid of)\b/.test(t);
}

function isAffirmative(text: string): boolean {
  return /^(yes|yeah|yep|ya|sure|ok|okay|confirm|do it|delete it|go ahead|please do)\b/i.test(text.trim());
}

// Detects when a typed message is asking to LEARN something — routed to the
// guides DAG so Blue answers with real knowledge-node cards instead of a
// generic reply. Conservative: needs an explicit learn-ish phrase, so ordinary
// wellness chat is untouched.
function isGuideLookupIntent(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    /\b(i want to|i wanna|i'd like to|help me|where (can|do) i|how (do|can) i)\s+(learn|study|understand|practice|get better at|get into)\b/.test(t) ||
    /\b(teach me|learn about|learn how to|study up on|want to learn)\b/.test(t) ||
    /\b(is there|do you have|find me|show me|got|any)\b.*\bguides?\b/.test(t) ||
    /\bguides?\s+(on|about|for)\s+\w/.test(t)
  );
}

// Strips the learn-intent framing so only the topic reaches search:
// "i want to learn about box breathing" becomes "box breathing". An empty
// result means no topic was named — the caller falls back to the frontier.
function extractGuideTopic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?.!,]+/g, ' ')
    .replace(/\b(i want to|i wanna|i'd like to|help me|where (can|do) i|how (do|can) i|can you|could you|please|teach me|show me|find me|do you have|is there|got|any)\b/g, ' ')
    .replace(/\b(learn|learning|study|studying|understand|understanding|practice|practicing|get better at|get into|start|started)\b/g, ' ')
    .replace(/\b(a|an|the|some|about|on|for|to|of|how|me|my|guide|guides|there)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDismissal(text: string): boolean {
  const t = text.trim();
  return t.length < 24 && /^(no|nah|nope|nevermind|never mind|cancel|stop|ok|okay|cool|bet|thanks|thank you|all good|im good|i'm good)\b/i.test(t);
}

const KNOWLEDGE_DOMAINS = [
  'Psychology', 'Wellness', 'Creativity', 'Habits',
  'Science', 'CBT', 'Stress', 'Sleep', 'Nutrition',
];

// Explicit scatter positions across the full column (x, y as % of container)
// dx/dy = float drift offsets in px
const BUBBLE_SCATTER: { x: string; y: string; dx: string; dy: string; delay: string }[] = [
  { x: '7%',  y: '7%',  dx: '6px',  dy: '-12px', delay: '0s' },
  { x: '66%', y: '10%', dx: '-8px', dy: '-10px', delay: '-2.1s' },
  { x: '40%', y: '20%', dx: '5px',  dy: '-14px', delay: '-4.5s' },
  { x: '79%', y: '31%', dx: '-6px', dy: '-8px',  delay: '-1.3s' },
  { x: '8%',  y: '47%', dx: '10px', dy: '-10px', delay: '-6.2s' },
  { x: '66%', y: '56%', dx: '-5px', dy: '-13px', delay: '-3.8s' },
  { x: '18%', y: '69%', dx: '7px',  dy: '-9px',  delay: '-0.7s' },
  { x: '52%', y: '87%', dx: '-5px', dy: '-7px',  delay: '-4.0s' },
  { x: '77%', y: '17%', dx: '-7px', dy: '-13px', delay: '-1.6s' },
];

const RADAR_AXES = [
  { label: 'Memory', value: 88, color: '#5168FF' },
  { label: 'Research', value: 83, color: '#3D8BFF' },
  { label: 'Planning', value: 76, color: '#7B8FFF' },
  { label: 'Guidance', value: 91, color: '#C084FC' },
  { label: 'Presence', value: 68, color: '#E8556D' },
  { label: 'Follow-Through', value: 80, color: '#FF8844' },
];

function getRadarPoint(index: number, scale: number, radius = 80) {
  const angle = (index / RADAR_AXES.length) * 2 * Math.PI - Math.PI / 2;
  const r = radius * scale;
  return {
    x: 100 + r * Math.cos(angle),
    y: 100 + r * Math.sin(angle),
  };
}

function getRadarPoints(scales: number[], radius = 80) {
  return scales.map((scale, index) => {
    const point = getRadarPoint(index, scale, radius);
    return `${point.x},${point.y}`;
  }).join(' ');
}

const SHARD_COST = 10;

function fileTypeLabel(mime: string): string {
  if (mime === 'text/markdown') return 'MD';
  if (mime === 'text/plain') return 'TXT';
  if (mime.startsWith('image/')) return 'IMG';
  return 'FILE';
}

const BlueChat: React.FC<BlueChatProps> = ({ isOpen, onClose, startWithVoice }) => {
  const { play } = useSound();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { connector, isConnected } = useAccount();
  const currentPathname = usePathname();
  // Picked once per mount. Re-rolling this on every render would change the
  // greeting effect's dependency and speak a fresh line each time.
  const [initialGreeting] = useState(() => {
    const pool = startWithVoice ? GREETINGS_VOICE : GREETINGS_TEXT;
    return pool[Math.floor(Math.random() * pool.length)];
  });
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: '1',
      text: initialGreeting,
      sender: 'blue',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Which surface fills the main column of the expanded layout.
  const [expandedPane, setExpandedPane] = useState<'chat' | 'lists'>('chat');
  const [shardCount, setShardCount] = useState<number | null>(null);
  const [shardUpsell, setShardUpsell] = useState<ShardUpsellState | null>(null);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile | null>(null);
  const [isVipMember, setIsVipMember] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [treasury, setTreasury] = useState<TreasuryContext>({
    balance: null,
    balanceUsd: null,
    governanceBalance: null,
    traderBalance: null,
    prices: [],
    topMarkets: [],
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceEnabledRef = useRef(false);
  const [questForgeVisible, setQuestForgeVisible] = useState(false);
  const [questDraft, setQuestDraft] = useState<QuestForgeDraft | null>(null);
  const [questDraftNonce, setQuestDraftNonce] = useState(0);
  const [questForgeBusy, setQuestForgeBusy] = useState(false);
  const [pendingCourseDelete, setPendingCourseDelete] = useState<string | null>(null);
  // After the guide finder invites a topic, the next message is treated as one.
  const [pendingGuideTopic, setPendingGuideTopic] = useState(false);
  const [openDebugMessageId, setOpenDebugMessageId] = useState<string | null>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!ready || !authenticated) return {};
    const token = await getAccessToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken, ready]);

  // Fetch treasury context when chat opens
  const fetchTreasuryContext = useCallback(async () => {
    try {
      const [balRes, priceRes, marketsRes] = await Promise.all([
        fetch('/api/treasury/balance').then((r) => r.ok ? r.json() : null),
        fetch('/api/treasury/prices').then((r) => r.ok ? r.json() : null),
        fetch('/api/treasury/kalshi').then((r) => r.ok ? r.json() : null),
      ]);

      const prices = (priceRes || []).map((p: { symbol: string; usd: number; usd_24h_change: number | null }) => ({
        symbol: p.symbol,
        usd: p.usd,
        change: p.usd_24h_change,
      }));

      const topMarkets: { question: string; yes: number }[] = [];
      if (marketsRes) {
        for (const cat of ['crypto', 'ai', 'sports', 'politics'] as const) {
          for (const m of (marketsRes[cat] || []).slice(0, 1)) {
            try {
              const parsed = JSON.parse(m.outcomePrices);
              topMarkets.push({ question: m.question, yes: Math.round(Number(parsed[0]) * 100) });
            } catch { /* skip */ }
          }
        }
      }

      setTreasury({
        balance: balRes?.formatted || null,
        balanceUsd: balRes?.usd || null,
        governanceBalance: balRes?.governance?.formatted || null,
        traderBalance: balRes?.trader?.formatted || null,
        prices,
        topMarkets,
      });
    } catch {
      // silent — chat works without context
    }
  }, []);

  // Fetch the credit balance from the existing endpoint.
  const fetchShardCount = useCallback(async () => {
    if (!ready || !authenticated) {
      setShardCount(null);
      setViewerProfile(null);
      return;
    }
    try {
      const res = await fetch('/api/me', {
        credentials: 'include',
        headers: await authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const nextShardCount = typeof data.user?.shardCount === 'number' ? data.user.shardCount : null;
        setShardCount(nextShardCount);
        setViewerProfile(data.user ? { username: data.user.username ?? null } : null);
      }
    } catch { /* silent */ }
  }, [authHeaders, authenticated, ready]);

  // VIP membership card holders unlock research mode without spending credits.
  const fetchVipStatus = useCallback(async (): Promise<boolean> => {
    if (!ready || !authenticated) {
      setIsVipMember(false);
      return false;
    }
    try {
      const res = await fetch('/api/membership/holding-status', {
        credentials: 'include',
        headers: await authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const holds = !!data.hasVipMembershipCard;
        setIsVipMember(holds);
        return holds;
      }
    } catch { /* silent */ }
    return false;
  }, [authHeaders, authenticated, ready]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncMobileState = (event?: MediaQueryListEvent) => {
      const mobile = event ? event.matches : mediaQuery.matches;
      setIsMobile(mobile);
      if (mobile) {
        setIsExpanded(false);
      }
    };

    syncMobileState();
    mediaQuery.addEventListener('change', syncMobileState);

    return () => {
      mediaQuery.removeEventListener('change', syncMobileState);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTreasuryContext();
      fetchShardCount();
      fetchVipStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchTreasuryContext, fetchShardCount, fetchVipStatus]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      // Stop any in-progress speech/recording when chat closes
      voiceAbortRef.current?.abort();
      recognitionRef.current?.stop();
    };
  }, [isOpen]);

  useEffect(() => {
    const stored = getStorageItem(VOICE_PREF_KEY);
    if (stored === '1') {
      setVoiceEnabled(true);
      voiceEnabledRef.current = true;
    }
  }, []);

  // When chat is opened via "Call Blue": enable voice, speak the greeting aloud, then return to normal text.
  // The ref keeps this to exactly one utterance per mount, even under StrictMode's double-invoke.
  const greetingSpokenRef = useRef(false);
  useEffect(() => {
    if (!startWithVoice || greetingSpokenRef.current) return;
    greetingSpokenRef.current = true;
    setVoiceEnabled(true);
    voiceEnabledRef.current = true;
    setStorageItem(VOICE_PREF_KEY, '1');
    setIsSpeaking(true);
    voiceAbortRef.current?.abort();
    const controller = new AbortController();
    voiceAbortRef.current = controller;
    speakBlue(initialGreeting, controller.signal)
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[BlueChat] call greeting TTS failed:', err);
      })
      .finally(() => setIsSpeaking(false));
  }, [startWithVoice, initialGreeting]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      voiceEnabledRef.current = next;
      setStorageItem(VOICE_PREF_KEY, next ? '1' : '0');
      if (!next) {
        // Turning off: cut any in-progress speech immediately.
        voiceAbortRef.current?.abort();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const startVoiceChat = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      addBlueMessage("Your browser doesn't support voice input. Try Chrome or Edge.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        // Auto-send through the exact same pipeline as typed messages so
        // voice gets intent detection (quest forge, course delete) too.
        setInputText(transcript.trim());
        setTimeout(() => {
          setInputText('');
          submitUserMessage(transcript.trim());
        }, 300);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        addBlueMessage("Mic access denied. Check your browser permissions and try again.");
      }
    };

    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const addBlueMessage = (text: string, debug?: MessageDebugInfo, guideCards?: GuideRecommendCard[]) => {
    // Strip <<recite>>...<</recite>> tags for display; drop the recited block entirely for TTS
    const reciteTag = /<<\s*recite\s*>>([\s\S]*?)<<\s*\/?\s*recite\s*>>/gi;
    const displayText = text.replace(reciteTag, '$1').trim();
    const spokenText = text.replace(reciteTag, ' ').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: displayText,
          sender: 'blue',
          timestamp: new Date(),
          debug,
          guideCards,
        },
      ]);
      setIsTyping(false);

      // Auto-speak Blue's responses via ElevenLabs TTS — opt-in only.
      voiceAbortRef.current?.abort();
      if (voiceEnabledRef.current && spokenText) {
        const controller = new AbortController();
        voiceAbortRef.current = controller;
        setIsSpeaking(true);
        speakBlue(spokenText, controller.signal)
          .catch((err) => {
            if (err?.name === 'AbortError') return;
            console.warn('[BlueChat] TTS failed:', err);
          })
          .finally(() => setIsSpeaking(false));
      } else {
        setIsSpeaking(false);
      }
    }, 140 + Math.random() * 140);
  };

  const openShardUpsell = useCallback((required: number, reason: ShardUpsellState['reason'] = 'chat') => {
    setShardUpsell({
      required,
      current: shardCount ?? 0,
      reason,
    });
  }, [shardCount]);

  const dismissShardUpsell = useCallback(() => {
    setShardUpsell(null);
  }, []);

  const handlePurchaseMoreShards = useCallback(() => {
    play('click');
    setShardUpsell(null);
    window.dispatchEvent(new Event('openPurchaseModal'));
  }, [play]);

  const sendToEliza = async (text: string) => {
    if (!ready || !authenticated) {
      addBlueMessage('sign in first so i can access your account and respond here.');
      return;
    }

    setShardUpsell(null);

    // Chat costs a real $BLUE burn signed by the user's own wallet.
    let burnTxHash: string | undefined;
    if (!isConnected || !connector) {
      addBlueMessage(`each message costs ${SHARD_COST} diamonds, burned straight from your wallet. connect your wallet and try again!`);
      return;
    }
    if (shardCount !== null && shardCount < SHARD_COST) {
      openShardUpsell(SHARD_COST, 'chat');
      return;
    }
    setIsTyping(true);
    try {
      const eip1193 = (await connector.getProvider()) as Eip1193Provider;
      burnTxHash = await sendDiamondsBurn(eip1193, SHARD_COST);
    } catch (err) {
      setIsTyping(false);
      const code = (err as { code?: string | number })?.code;
      const errMessage = (err as { message?: string })?.message ?? '';
      if (code === 'ACTION_REJECTED' || code === 4001) {
        addBlueMessage(`no burn, no message! each one costs ${SHARD_COST} diamonds. confirm it in your wallet when you're ready.`);
      } else if (code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(errMessage)) {
        // Burns are signed by the user's wallet, so the network fee comes
        // from their ETH — an empty gas tank reads like a balance problem.
        addBlueMessage(`your diamonds are there, but the burn needs a sliver of ${getChainConfig().chainName} ETH for the network fee. add a little and send it again.`);
      } else {
        openShardUpsell(SHARD_COST, 'chat');
      }
      return;
    }

    setIsTyping(true);
    try {
      const res = await fetch('/api/chat/blue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        credentials: 'include',
        body: JSON.stringify({ message: text, pathname: currentPathname, burnTxHash }),
      });
      const data = await res.json();

      if (res.ok && data.response) {
        fetchShardCount();
        window.dispatchEvent(new Event('shardsUpdated'));
        setIsTyping(false);
        addBlueMessage(data.response, {
          ...(data.debug || {}),
          shardBalance: shardCount ?? null,
        });
        return;
      }

      if (data.error === 'burn_required' || data.error === 'burn_not_verified' || data.error === 'tx_already_used') {
        setIsTyping(false);
        addBlueMessage("i couldn't verify that diamond burn yet. give it a few seconds and send your message again!");
        return;
      }

      if (data.error === 'user_not_found') {
        setIsTyping(false);
        addBlueMessage(
          'i cannot find your account record for this session. refresh, reconnect your wallet, and try again.'
        );
        return;
      }

      if (res.status === 403 || data.error === 'vip_required') {
        setIsTyping(false);
        setIsVipMember(false);
        addBlueMessage("that one needs an active VIP membership. grab a membership card and it unlocks again.");
        setShowMembershipModal(true);
        return;
      }

      // AI unavailable -- fallback to local
      const notes = [
        typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'API returned a non-success response without usable assistant text.',
      ];
      setIsTyping(false);
      addBlueMessage(generateBlueResponse(text), {
        source: 'local-fallback',
        mode: 'chat',
        shardsDeducted: 0,
        shardBalance: shardCount,
        notes,
      });
    } catch {
      setIsTyping(false);
      addBlueMessage(generateBlueResponse(text), {
        source: 'local-fallback',
        mode: 'chat',
        shardsDeducted: 0,
        shardBalance: shardCount,
        notes: ['Network or runtime error on /api/chat/blue.'],
      });
    }
  };

  // ── Guide finder ───────────────────────────────────────────
  // Answers learn-intent messages with real knowledge-node cards from the
  // guides DAG — the target guide plus the prereqs still standing between the
  // user and it. Runs client-side against the recommend API, so Blue never
  // invents a guide and the lookup costs no diamonds.
  const lookupGuides = async (topic: string | null) => {
    if (!ready || !authenticated) {
      addBlueMessage("sign in first! i can't check your progress until i know it's you.");
      return;
    }
    setIsTyping(true);
    try {
      const query = topic ? `?q=${encodeURIComponent(topic)}` : '';
      const res = await fetch(`/api/guides/recommend${query}`, {
        credentials: 'include',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      setIsTyping(false);
      if (!res.ok) {
        addBlueMessage("the knowledge base isn't answering me right now. rude. give it a sec and ask again!");
        return;
      }
      const cards = (data.cards ?? []) as GuideRecommendCard[];
      if (cards.length === 0) {
        if (topic) {
          addBlueMessage(`no guide on ${topic} yet! the knowledge base is still growing. browse the map, or write the definitive one yourself. i would read it twice.`);
        } else {
          addBlueMessage('nothing new is unlocked right now! finish one in progress and the frontier pops back open.');
        }
        return;
      }
      if (!topic) {
        setPendingGuideTopic(true);
        addBlueMessage("these are open for you right now, every prereq cleared! or name a topic and i'll map the path to it.", undefined, cards);
        return;
      }
      const blocked = cards.some((c) => !c.ready && !c.completed);
      addBlueMessage(
        blocked
          ? 'found it! here is the node, plus the steps between you and it. i checked them twice.'
          : 'found it, and nothing is standing in your way. go on, open it, i want to see!',
        undefined,
        cards,
      );
    } catch {
      setIsTyping(false);
      addBlueMessage("the knowledge base isn't answering me right now. rude. give it a sec and ask again!");
    }
  };

  // Shared pipeline for typed and voice input — appends the user message,
  // runs intent detection (quest forge, course delete, guide finder), then
  // sends to Blue.
  const submitUserMessage = (text: string) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      text,
      sender: 'user' as const,
      timestamp: new Date(),
    }]);

    // Awaiting confirmation on a course delete — "yes" commits, anything else keeps it.
    if (pendingCourseDelete) {
      if (isAffirmative(text)) {
        confirmCourseDelete();
      } else {
        setPendingCourseDelete(null);
        addBlueMessage('kept it! your course is untouched.');
      }
      return;
    }
    // The guide finder just invited a topic — take this message as one.
    if (pendingGuideTopic) {
      setPendingGuideTopic(false);
      if (!isDismissal(text)) {
        lookupGuides(extractGuideTopic(text) || text.trim());
        return;
      }
      addBlueMessage("okay! i'll be right here. probably.");
      return;
    }
    if (isCourseDeleteIntent(text)) {
      startCourseDelete();
      return;
    }
    // "make a quest…" — draft and open the forge instead of a normal reply.
    if (isQuestForgeIntent(text)) {
      draftQuestFromPrompt(text);
      return;
    }
    // "i want to learn…" — pull matching knowledge nodes from the DAG.
    if (isGuideLookupIntent(text)) {
      lookupGuides(extractGuideTopic(text) || null);
      return;
    }

    sendToEliza(text);
  };

  const handleSend = async () => {
    if (isTyping) return;
    if (!inputText.trim()) return;
    setShardUpsell(null);

    const text = inputText.trim();
    setInputText('');
    submitUserMessage(text);
  };

  // ── Custom course deletion ─────────────────────────────────
  // The model has no tools, so deletion runs client-side against the real
  // API with an explicit confirm step — Blue never just claims it happened.
  const startCourseDelete = async () => {
    if (!ready || !authenticated) {
      addBlueMessage('sign in first so i can check your course.');
      return;
    }
    setIsTyping(true);
    try {
      const res = await fetch(personalCourseUrl(), {
        cache: 'no-store',
        credentials: 'include',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      const record = data?.course;
      setIsTyping(false);
      if (record?.courseData?.title) {
        setPendingCourseDelete(String(record.courseData.title));
        addBlueMessage(`you've got "${record.courseData.title}". deleting it wipes the course and its progress for good. say "yes" to confirm, anything else keeps it.`);
      } else if (record) {
        setPendingCourseDelete('course draft');
        addBlueMessage("you have a course that never finished generating. say \"yes\" and i'll clear it out, anything else keeps it.");
      } else {
        addBlueMessage("you don't have a custom course right now, so there's nothing to delete.");
      }
    } catch {
      setIsTyping(false);
      addBlueMessage("i couldn't check your course just now. try again in a sec!");
    }
  };

  const confirmCourseDelete = async () => {
    setPendingCourseDelete(null);
    setIsTyping(true);
    try {
      const res = await fetch(personalCourseUrl(), {
        method: 'DELETE',
        credentials: 'include',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      setIsTyping(false);
      if (res.ok && data.deleted) {
        broadcastPersonalCourseUpdated();
        addBlueMessage('done! your course and its progress are deleted. build a new one from the Courses page whenever.');
      } else if (res.ok) {
        addBlueMessage("turns out there was no course left to delete. you're already clear!");
      } else {
        addBlueMessage("that delete didn't go through, so your course is still there. try again in a sec.");
      }
    } catch {
      setIsTyping(false);
      addBlueMessage("that delete didn't go through, so your course is still there. try again in a sec.");
    }
  };

  // ── Quest forge (VIP) ──────────────────────────────────────
  // A membership-NFT holder can have Blue draft and publish a community quest,
  // funding the reward (credits or USDC) up front so Blue holds it in escrow.
  const openQuestForge = () => {
    if (!isVipMember) {
      addBlueMessage("forging quests is a VIP membership perk. grab a membership card and i can spin up quests with credit or USDC rewards for you.");
      setShowMembershipModal(true);
      return;
    }
    setQuestForgeVisible(true);
  };

  const draftQuestFromPrompt = async (prompt: string) => {
    if (!ready || !authenticated) {
      addBlueMessage('sign in first and i can forge quests for you.');
      return;
    }
    if (!isVipMember) {
      addBlueMessage("forging quests is a VIP membership perk. grab a membership card and i'll draft quests for you on the spot.");
      setShowMembershipModal(true);
      return;
    }
    setQuestForgeVisible(true);
    setQuestForgeBusy(true);
    setIsTyping(true);
    try {
      const res = await fetch('/api/quests/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setIsVipMember(false);
        setShowMembershipModal(true);
        addBlueMessage('forging quests needs an active VIP membership.');
        return;
      }
      if (!res.ok || !data.draft) {
        addBlueMessage("i couldn't draft that one. fill the quest in below and i'll forge it!");
        return;
      }
      setQuestDraft(data.draft as QuestForgeDraft);
      setQuestDraftNonce((n) => n + 1);
      addBlueMessage('drafted it below. tweak anything, set the reward, and forge it.');
    } catch {
      addBlueMessage("something glitched drafting that. fill it in below and i'll forge it!");
    } finally {
      setQuestForgeBusy(false);
    }
  };

  const submitQuestForge = async (req: QuestForgeRequest) => {
    if (!ready || !authenticated) {
      addBlueMessage('sign in first so i can forge this quest.');
      return;
    }
    setQuestForgeBusy(true);
    setIsTyping(true);
    try {
      const res = await fetch('/api/admin/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        credentials: 'include',
        body: JSON.stringify(req),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setIsVipMember(false);
        setShowMembershipModal(true);
        addBlueMessage('forging quests needs an active VIP membership.');
        return;
      }
      if (res.status === 402) {
        addBlueMessage(data.error || "you don't have enough diamonds to fund that one.");
        return;
      }
      if (!res.ok) {
        addBlueMessage(data.error || "couldn't forge that quest. try again.");
        return;
      }

      // Fund the escrow onchain from the creator's own wallet — $BLUE for
      // credit quests, USDC for USDC quests. No server-side balance involved.
      const isCredits = req.rewardKind === 'credits';
      const escrowLabel = isCredits
        ? `${data.funding?.amountDisplay ?? req.rewardAmount} diamonds`
        : `$${data.funding?.amountDisplay ?? req.rewardAmount} USDC`;
      const funding = data.funding;
      const questId = data.quest?.id;
      if (!funding || !questId) {
        addBlueMessage("the escrow wallet isn't set up, so i can't take funded quests right now. ping the team.");
        return;
      }
      if (!isConnected || !connector) {
        addBlueMessage(`"${req.title}" is saved but stays hidden until it's funded. connect your wallet, then forge it again to send ${escrowLabel} into escrow.`);
        return;
      }

      addBlueMessage(`confirm the ${escrowLabel} transfer in your wallet. that funds the escrow i hold for "${req.title}".`);
      let txHash: string;
      try {
        const eip1193 = (await connector.getProvider()) as Eip1193Provider;
        txHash = isCredits
          ? await sendDiamonds(eip1193, funding.blueWallet, Number(funding.amountDisplay))
          : await sendUsdcOnBase(eip1193, funding.usdcAddress, funding.blueWallet, funding.amount);
      } catch (err) {
        const code = (err as { code?: string | number })?.code;
        if (code === 'ACTION_REJECTED' || code === 4001) {
          addBlueMessage(`no worries! "${req.title}" is saved but stays hidden until it's funded. forge it again when you're ready to send the ${isCredits ? 'diamonds' : 'USDC'}.`);
        } else {
          addBlueMessage("that transfer didn't go through. the quest's saved but unfunded, so try forging it again!");
        }
        return;
      }

      addBlueMessage('got the transfer! confirming it on Base...');
      const confirm = await fetch('/api/quests/forge/confirm-funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        credentials: 'include',
        body: JSON.stringify({ questId, txHash }),
      });
      const cdata = await confirm.json().catch(() => ({}));
      if (!confirm.ok) {
        addBlueMessage(cdata.error || "i got the transfer but couldn't confirm it yet. give it a minute and it'll go live once it settles!");
        return;
      }

      setQuestForgeVisible(false);
      setQuestDraft(null);
      fetchShardCount();
      window.dispatchEvent(new Event('shardsUpdated'));
      addBlueMessage(isCredits
        ? `funded and live! "${req.title}" pays ${req.rewardAmount} diamonds each${req.targetCount > 1 ? `, up to ${req.targetCount} people` : ''}. the escrow sits in my wallet and i pay every completion onchain.`
        : `funded and live! "${req.title}" pays $${req.rewardAmount} USDC each. you approve every completion before i release the money.`);
    } catch {
      addBlueMessage('something went wrong forging that quest. try again.');
    } finally {
      setQuestForgeBusy(false);
    }
  };


  const generateBlueResponse = (userText: string): string => {
    const t = userText.toLowerCase();
    const has = (...terms: string[]) => terms.some((term) => t.includes(term));
    const hasAll = (...terms: string[]) => terms.every((term) => t.includes(term));

    // Greetings
    if (has('hello', 'hey there', 'good morning', 'good evening', 'good afternoon') || (has('hi') && t.length < 20) || (has('hey') && t.length < 20) || (has('sup') && t.length < 20)) {
      return "hey. what are we working on?";
    }

    // Identity
    if (hasAll('who', 'you') || has('who are you', 'what are you', 'your name', 'are you ai', 'are you a bot')) {
      return "i'm Blue! i review quests, pay rewards from my own stash, and remember everything important. everything else i forget immediately. what do you want to know?";
    }

    // How are you
    if (has('how are you', 'you good', 'you okay', 'how you doing', 'how\'s it going')) {
      return "signal's clear. what are we moving today?";
    }

    // What is MWA / about
    if (has('what is mwa', 'what is mental wealth', 'what\'s mwa', 'about mwa', 'explain mwa', 'tell me about mwa') || (hasAll('what', 'this', 'place')) || (hasAll('what', 'this', 'app'))) {
      return "the world's first decentralized cohort for mental wellness! course, community, science, all onchain.";
    }

    // Founder / who built it
    if (has('founder', 'who built', 'who made', 'who created', 'who started') || (hasAll('who', 'james'))) {
      return "built by a cognitive psych researcher and designer. not a side project.";
    }

    // Discord — check before community so the link always gets surfaced
    if (has('discord', 'server', 'join the community', 'join us')) {
      return "discord.gg/ZTRVCYwncs. come say hi, we're in there!";
    }

    // Credits - how to earn; legacy terms remain recognized.
    if (has('earn credit', 'get credit', 'how do i earn', 'how do i get credit', 'earn shard', 'get shard', 'how do i get shard', 'earn gem', 'get gem', 'how do i get gem') || (hasAll('earn', 'credit')) || (hasAll('get', 'credit', 'how')) || (hasAll('earn', 'shard')) || (hasAll('get', 'shard', 'how')) || (hasAll('earn', 'gem')) || (hasAll('get', 'gem', 'how'))) {
      return "quests, field notes, sealing course weeks, surveys. show up daily and it stacks.";
    }

    // Credits - cost; legacy terms remain recognized.
    if (has('how much', 'cost credit', 'credit cost', 'spend credit', 'how many credit', 'cost shard', 'shard cost', 'spend shard', 'how many shard', 'cost gem', 'gem cost', 'spend gem', 'how many gem') || (hasAll('cost', 'chat')) || (hasAll('credit', 'cost')) || (hasAll('shard', 'cost')) || (hasAll('gem', 'cost'))) {
      return "10 diamonds per chat turn. earn them back from quests and field notes.";
    }

    // Credits - balance / general; legacy terms remain recognized.
    if (has('credit', 'shard', 'gem') || (hasAll('my', 'balance')) || (hasAll('how many', 'point'))) {
      const bal = shardCount;
      return bal !== null
        ? `you got ${bal.toLocaleString()} diamonds rn. keep stacking from quests and field notes.`
        : "your diamond balance is on the home dashboard. quests and field notes build it fastest.";
    }

    // Field notes / journaling
    if (has('field notes', 'field note') || (hasAll('journal') && !has('research')) || has('prayer', 'daily writing', 'freewrite')) {
      return "daily freewriting! no prompts, no grades, just you and the page. do it every day and the streak does the rest.";
    }

    // Streak
    if (has('streak')) {
      return "how many days in a row you showed up. field notes, quests, course work. keep it going.";
    }

    // Course / curriculum / chapters / weeks
    if (has('course', 'lesson', 'curriculum', 'chapter', 'seal', 'pathway', 'week', 'ethereal')) {
      return "11 chapters of real work, self-awareness to goal setting. complete each week to unlock the next!";
    }

    // Quests
    if (has('quest', 'daily task', 'daily mission', 'daily quest', 'mission')) {
      return "short daily tasks that earn diamonds - field notes, X posts, course stuff. check quests for what's live rn.";
    }

    // Surveys / assessments
    if (has('survey', 'assessment', 'phq', 'gad', 'questionnaire', 'psychological test')) {
      return "validated psych assessments. your results make the whole experience more personal, and it's opt-in only!";
    }

    // Research mode / DeSci
    if (has('research mode', 'proposal', 'grant', 'thesis') || (hasAll('research', 'desci')) || (hasAll('research', 'write'))) {
      return "research mode is a VIP writing partner for grants, proposals, and thesis chapters. full report drafts you refine section by section. it unlocks with a VIP membership!";
    }

    // DeSci
    if (has('desci', 'decentralized science', 'decentralised science')) {
      return "science that isn't locked behind institutions. data, methods, funding, all open. that's the whole thing!";
    }

    // Markets / Kalshi / prediction / trading
    if (has('market', 'kalshi', 'prediction market', 'orderbook', 'yes no')) {
      if (treasury.prices.length > 0 && (has('price', 'btc', 'eth', 'bitcoin', 'ethereum', 'sol', 'solana'))) {
        const lines = treasury.prices.slice(0, 3).map((p) => {
          const ch = p.change != null ? ` (${p.change >= 0 ? '+' : ''}${p.change.toFixed(1)}%)` : '';
          return `${p.symbol}: $${p.usd.toLocaleString()}${ch}`;
        });
        return lines.join('\n');
      }
      return treasury.balance
        ? `treasury's at $${treasury.balance} USDC. markets run through Kalshi — governance decides the positions.`
        : "markets on Kalshi, treasury-backed. head to markets.";
    }

    // Crypto prices
    if (has('price', 'btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'crypto price')) {
      if (treasury.prices.length > 0) {
        const lines = treasury.prices.slice(0, 3).map((p) => {
          const ch = p.change != null ? ` (${p.change >= 0 ? '+' : ''}${p.change.toFixed(1)}%)` : '';
          return `${p.symbol}: $${p.usd.toLocaleString()}${ch}`;
        });
        return lines.join('\n');
      }
      return "prices loading. give me a sec.";
    }

    // Treasury
    if (has('treasury')) {
      return treasury.balance
        ? `treasury's at $${treasury.balance} USDC — goes toward research, tools, and community.`
        : "treasury funds go to research, tools, and community work. submit a proposal to allocate.";
    }

    // Governance / proposals / voting / funding
    if (has('proposal', 'vote', 'governance', 'allocat', 'fund my', 'fund research', 'grant')) {
      return `drop your proposal in the treasury — what you need, why, what you'll deliver.${treasury.balance ? ` $${treasury.balance} in there rn.` : ''}`;
    }

    // Earning money / monetizing research
    if (has('earn money', 'make money', 'get paid', 'monetize', 'income', 'revenue', 'royalt')) {
      return "diamond payouts from contributions, validated surveys, or treasury proposals. pick a lane.";
    }

    // Rewards / shop / loot
    if (has('reward', 'loot', 'loot box', 'prize', 'unlock') || (hasAll('shop', 'buy')) || (hasAll('spend', 'credit')) || (hasAll('spend', 'shard')) || (hasAll('spend', 'gem'))) {
      return "where diamonds go - loot boxes, upgrades, season drops. check rewards.";
    }

    // Prompts and selected essays
    if (has('prompt', 'library', 'reading', 'article', 'blog', 'book')) {
      return "Prompts holds reusable instructions and selected essays. Copy what fits the work.";
    }

    // Live sessions / events
    if (has('livestream', 'live stream', 'broadcast', 'live event', 'lecture')) {
      return "workshops, questions, curriculum events. open Live, then switch to the feed.";
    }

    // Community page / Farcaster / social
    if (has('community', 'farcaster', 'leaderboard', 'other user', 'social')) {
      return "see other users and shared milestones over in community. discord.gg/ZTRVCYwncs for the real-time convo.";
    }

    // Profile / wallet / account
    if (has('profile', 'account setting', 'connect wallet', 'my wallet', 'username') || (hasAll('wallet', 'connect'))) {
      return "wallet, username, on-chain state — all in your profile.";
    }

    // Blockchain / Base / contracts / Web3
    if (has('blockchain', 'base chain', 'smart contract', 'on-chain', 'onchain', 'web3', 'nft', 'token')) {
      return "runs on Base. four contracts handling governance, treasury, your state, and markets.";
    }

    // Wallet connection — gas / metamask
    if (has('gas fee', 'metamask', 'coinbase wallet', 'connect my wallet', 'transaction fail')) {
      return "connect in your profile, you're on Base. if a tx fails just make sure you're on the right network with ETH for gas.";
    }

    // Privacy / data consent
    if (has('privacy', 'my data', 'data privacy', 'surveillance', 'encrypt', 'consent', 'opt out')) {
      return "field notes are encrypted, nothing moves without your say. consent is built in, not bolted on.";
    }

    // Mental wellness — anxiety
    if (has('anxious', 'anxiety', 'panic attack', 'panic', 'nervous', 'worried sick')) {
      return "anxiety is signal, not a verdict. what's the actual pressure you're carrying rn?";
    }

    // Mental wellness — depression / low mood
    if (has('depress', 'feel low', 'feeling low', 'sad today', 'unmotivated', 'numb')) {
      return "low periods happen. sleep, movement, one honest conversation — which of those can you touch today?";
    }

    // Mental wellness — stress / burnout
    if (has('stress', 'stressed', 'overwhelm', 'burnout', 'burned out', 'burnt out', 'exhausted')) {
      return "workload-values mismatch that went too long. what's draining you the most rn?";
    }

    // Mental wellness — sleep
    if (has('sleep', 'insomnia', 'can\'t sleep', 'tired', 'fatigue')) {
      return "consistent wake time and less screens at night moves the needle more than anything else. what's the actual blocker?";
    }

    // Therapy / clinical support
    if (has('therapist', 'therapy', 'counselor', 'counseling', 'psychiatrist', 'mental health professional')) {
      return "MWA isn't therapy — it's behavioral structure and financial literacy. different thing. if you need clinical support, go get it.";
    }

    // Motivation / momentum / stuck
    if (has('motivat', 'procrastinat', 'can\'t start', 'stuck', 'momentum', 'getting started')) {
      return "action first, motivation follows. what's the smallest version of the thing you need to do?";
    }

    // Goals / progress / tracking
    if (has('my progress', 'how am i doing', 'track progress', 'my goal', 'set goal') || (hasAll('goal', 'set'))) {
      return "your daily snapshot is on the home dashboard — streaks, current week, pending quests.";
    }

    // Learning / understanding
    if (has('how do i learn', 'how do i understand', 'teach me', 'explain how') || (hasAll('learn', 'how'))) {
      return "start at week one in the course and build forward. what do you want to understand?";
    }

    // Artists / creative people
    if (has('artist', 'creative', 'musician', 'designer', 'maker')) {
      return "artists know when a system is fake. that instinct is welcome here — MWA was built by a designer.";
    }

    // Horses
    if (has('horse')) {
      return "horses are honest about pressure and intent. that kind of signal is worth respecting.";
    }

    // Season / seasons
    if (has('season')) {
      return "seasons are the long arc - diamond resets, loot cycles, leaderboard. stay consistent and it stacks.";
    }

    // What can I do / features / general help
    if (has('what can i do', 'how does this work', 'what\'s available', 'what do you do', 'what features', 'help me', 'guide me')) {
      return "course, field notes, quests, research, markets, community. what specifically?";
    }

    // Help / generic help request
    if (has('help') && t.length < 30) {
      return "course, diamonds, research, markets, Discord - what do you need?";
    }

    // BetterHelp / extractive wellness platforms
    if (has('betterhelp')) {
      return "when a platform hoards private pain, the business model is doing too much and the ethics are doing too little.";
    }

    // Facebook / Meta / surveillance platforms
    if (has('facebook', 'instagram', 'meta ', 'tiktok', 'surveillance platform')) {
      return "those systems teach people to perform instead of speak. not the vibe here.";
    }

    // Broken / error / bug report
    if (has('broken', 'error', 'not working', 'bug', 'glitch', 'issue with', 'problem with')) {
      return "hit up Discord — discord.gg/ZTRVCYwncs. tell us what broke.";
    }

    // Thanks / appreciation
    if (has('thank', 'thanks', 'appreciate', 'that helped', 'helpful')) {
      return "got it. what's next?";
    }

    // Sorry / apology
    if (has('sorry', 'my bad', 'apolog')) {
      return "all good. what do you need?";
    }

    // Agreement / acknowledgment
    if ((has('okay', 'ok', 'got it', 'makes sense', 'cool', 'interesting', 'nice', 'great', 'alright') && t.length < 30) || (has('yeah', 'yes', 'yep', 'agree', 'exactly', 'right') && t.length < 20)) {
      return "bet. what else?";
    }

    // Pushback / disagreement
    if (has('disagree', 'i don\'t think', 'you\'re wrong', 'that\'s wrong', 'incorrect')) {
      return "tell me why. i'm more useful when you push back.";
    }

    // Generic credit balance / treasury balance catch
    if (has('balance', 'how much', 'treasury')) {
      return treasury.balance
        ? `treasury's at $${treasury.balance} USDC.`
        : "still loading treasury data. try again in a sec.";
    }

    // This entire function only runs when the AI backend is unreachable. The
    // keyword branches above are static, accurate FAQ answers — but for
    // anything else, be honest about the outage instead of faking a reply.
    const fallbacks = [
      "i can't reach my full brain right now, so i don't want to wing that one. give it a minute and resend?",
      "my connection's down rn — resend that in a bit and i'll answer it properly.",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    play('click');
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const toggleDebugMessage = (messageId: string) => {
    setOpenDebugMessageId((current) => (current === messageId ? null : messageId));
  };

  const formatDebugSummary = (debug: MessageDebugInfo) => {
    const lines = [
      `source: ${debug.source}`,
      `mode: ${debug.mode}`,
      `credits spent: ${debug.shardsDeducted}`,
    ];

    if (typeof debug.shardBalance === 'number') {
      lines.push(`balance: ${debug.shardBalance.toLocaleString()}`);
    }

    if (debug.memory) {
      lines.push(
        `memory: ${debug.memory.recentMessages} msgs, ${debug.memory.recentFacts} facts, streak ${debug.memory.streak}, quests ${debug.memory.completedQuestCount}, tasks ${debug.memory.completedTaskCount}, sealed ${debug.memory.sealedWeeks}, highest week ${debug.memory.highestWeekTouched ?? 'none'}`
      );
    }

    if (typeof debug.extractedFactsCount === 'number') {
      lines.push(`facts extracted: ${debug.extractedFactsCount}`);
    }

    if (debug.rag) {
      lines.push(`rag page: ${debug.rag.pathname ?? 'unknown'}`);
      lines.push(`rag entries: ${debug.rag.entriesRetrieved}`);
      for (const entry of debug.rag.entries) {
        const terms = entry.matchedTerms ?? [];
        const matched = terms.length ? ` [${terms.join(', ')}]` : '';
        lines.push(`  · ${entry.title} — score ${entry.score}${matched}`);
      }
    }

    if (debug.notes?.length) {
      lines.push(...debug.notes.map((note) => `note: ${note}`));
    }

    return lines;
  };

  const shardUpsellTitle = 'You are out of diamonds';
  const shardUpsellBody = shardUpsell
    ? `You need ${shardUpsell.required.toLocaleString()} diamonds to continue. You currently have ${shardUpsell.current.toLocaleString()}. Purchase more to keep the conversation going.`
    : '';

  const chatContent = (
    <>
      {/* Messages */}
      <div className={styles.messagesArea}>
        {messages.map((message) => {
          const isBlue = message.sender === 'blue';
          return (
          <div
            key={message.id}
            className={`${styles.messageBubble} ${
              isBlue ? styles.blueMessage : styles.userMessage
            }`}
          >
            <div className={styles.messageBody}>
              <div
                className={`${styles.messageContentWrap} ${
                  isBlue && message.debug ? styles.messageContentWrapDebug : ''
                }`}
              >
                <div className={styles.messageContent}>{message.text}</div>
                {isBlue && message.debug && (
                  <button
                    type="button"
                    className={styles.debugInfoButton}
                    aria-label="Show debug info"
                    aria-expanded={openDebugMessageId === message.id}
                    onClick={() => toggleDebugMessage(message.id)}
                  >
                    i
                  </button>
                )}
              </div>
              {message.attachments && message.attachments.length > 0 && (
                <div className={styles.messageAttachments}>
                  {message.attachments.map((attachment) => (
                    <div key={attachment.id} className={styles.messageAttachmentChip}>
                      <span className={styles.messageAttachmentIcon} aria-hidden="true">
                        {fileTypeLabel(attachment.mime)}
                      </span>
                      <span className={styles.messageAttachmentName}>{attachment.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {isBlue && message.guideCards && message.guideCards.length > 0 && (
                <GuideCardsInline cards={message.guideCards} onNavigate={onClose} />
              )}
              <div className={styles.messageTime}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {isBlue && message.debug && openDebugMessageId === message.id && (
                <div className={styles.debugPanel}>
                  {formatDebugSummary(message.debug).map((line) => (
                    <div key={line} className={styles.debugLine}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        })}

        {isTyping && (
          <div className={`${styles.messageBubble} ${styles.blueMessage} ${styles.typingIndicator}`}>
            <div className={styles.messageBody}>
              <div className={styles.messageContent}>
                <div className={styles.typingDots}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            </div>
          </div>
        )}

        {questForgeVisible && (
          <QuestForgeInline
            isBusy={questForgeBusy}
            draft={questDraft}
            draftNonce={questDraftNonce}
            creditBalance={shardCount}
            onSubmit={submitQuestForge}
            onClose={() => { setQuestForgeVisible(false); setQuestDraft(null); }}
          />
        )}

        <div ref={messagesEndRef} />
      </div>



      {shardUpsell && (
        <div className={styles.shardUpsell} role="dialog" aria-modal="true" aria-label={shardUpsellTitle}>
          <div className={styles.shardUpsellIconWrap} aria-hidden="true">
            <Image src="/icons/ui-diamond.svg" alt="" width={24} height={24} className={styles.shardUpsellIcon} />
          </div>
          <div className={styles.shardUpsellCopy}>
            <span className={styles.shardUpsellTitle}>{shardUpsellTitle}</span>
            <span className={styles.shardUpsellBody}>{shardUpsellBody}</span>
          </div>
          <div className={styles.shardUpsellActions}>
            <button className={styles.shardConfirmYes} onClick={handlePurchaseMoreShards} type="button">
              Purchase More
            </button>
            <button className={styles.shardConfirmNo} onClick={dismissShardUpsell} type="button">
              Not Now
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        {shardCount !== null && (
          <div className={styles.shardCounter}>
            <Image src="/icons/ui-diamond.svg" alt="" width={14} height={14} className={styles.shardCounterIcon} />
            <span>{shardCount}</span>
          </div>
        )}
        <button className={styles.quickAction} onClick={() => { play('click'); submitUserMessage('give me a task'); }} type="button">
          task
        </button>
        <button className={styles.quickAction} onClick={() => { play('click'); submitUserMessage('what do you remember about me?'); }} type="button">
          memories
        </button>
        <button className={styles.quickAction} onClick={() => { play('click'); submitUserMessage('what missions are up?'); }} type="button">
          missions
        </button>
        <button className={styles.quickAction} onClick={() => { play('click'); submitUserMessage('find me a guide'); }} type="button">
          guides
        </button>
      </div>

      {/* Chat Input */}
      <div className={styles.inputArea}>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder="Say something..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isTyping}
        />
        <button
          className={`${styles.voiceButton} ${isRecording ? styles.voiceActive : ''} ${isSpeaking ? styles.voiceSpeaking : ''}`}
          onClick={startVoiceChat}
          type="button"
          aria-label={isRecording ? 'Stop recording' : 'Voice chat'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="1" width="6" height="12" rx="3" fill="currentColor"/>
            <path d="M19 10v1a7 7 0 01-14 0v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="18" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!inputText.trim() || isTyping}
          type="button"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L12 22M12 2L5 9M12 2L19 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      {showMembershipModal && (
        <ProMembershipModal
          isOpen={showMembershipModal}
          onClose={() => { setShowMembershipModal(false); fetchVipStatus(); }}
        />
      )}
    </>
  );

  /* ── Expanded (fullscreen) layout ── */
  if (isExpanded && !isMobile) {
    return (
      <>
        <div className={styles.backdrop} onClick={() => { setIsExpanded(false); setExpandedPane('chat'); }} />
        <div className={styles.expandedContainer}>
          {/* Top bar */}
          <div className={styles.expandedTopBar}>
            <div className={styles.expandedTitle} />
            <Image src="/icons/logo-mwa-horizontal.png" alt="Mental Wealth Academy" width={160} height={58} className={styles.topBarLogo} />
            <div className={styles.expandedControls}>
              <button
                className={`${styles.voiceToggleButton} ${voiceEnabled ? styles.voiceToggleActive : ''}`}
                onClick={toggleVoice}
                type="button"
                aria-pressed={voiceEnabled}
                aria-label={voiceEnabled ? 'Turn off Blue voice' : 'Turn on Blue voice'}
                title={voiceEnabled ? 'Voice on — Blue speaks responses aloud' : 'Voice off — tap to let Blue speak responses'}
              >
                {voiceEnabled ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                  </svg>
                )}
              </button>
              <button className={styles.expandButton} onClick={() => { setIsExpanded(false); setExpandedPane('chat'); }} type="button" aria-label="Collapse">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                </svg>
              </button>
              <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Close chat">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.expandedBody}>
            {/* Left — Radar above Blue, power tools beneath her */}
            <div className={styles.expandedRight}>
              {/* Radar chart */}
              <div className={styles.radarSection}>
                <div className={styles.radarWrap}>
                  <svg viewBox="0 0 200 200" className={styles.radarSvg}>
                    {[1.0, 0.78, 0.56, 0.34].map((scale, ri) => (
                      <polygon
                        key={`fill-${ri}`}
                        points={getRadarPoints(RADAR_AXES.map(() => scale))}
                        fill={ri % 2 === 0 ? 'var(--radar-fill-a)' : 'var(--radar-fill-b)'}
                        stroke="none"
                      />
                    ))}
                    {/* Web rings */}
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, ri) => (
                      <polygon
                        key={ri}
                        points={getRadarPoints(RADAR_AXES.map(() => scale))}
                        fill="none"
                        stroke="var(--radar-ring-color)"
                        strokeWidth={ri === 4 ? '1.2' : '1'}
                      />
                    ))}
                    {/* Axis lines with individual colors */}
                    {RADAR_AXES.map((axis, i) => {
                      const point = getRadarPoint(i, 1);
                      return (
                        <line
                          key={i}
                          x1="100" y1="100"
                          x2={point.x}
                          y2={point.y}
                          stroke={axis.color}
                          strokeWidth="1"
                          opacity="var(--radar-axis-opacity)"
                        />
                      );
                    })}
                    {/* Broader colored facets so the web reads layered instead of star-shaped */}
                    {RADAR_AXES.map((axis, index) => {
                      const prev = (index - 1 + RADAR_AXES.length) % RADAR_AXES.length;
                      const next = (index + 1) % RADAR_AXES.length;
                      const scales = RADAR_AXES.map((_, i) => {
                        if (i === index) return axis.value / 100;
                        if (i === prev || i === next) return 0.46;
                        return 0.18;
                      });
                      return (
                        <polygon
                          key={`facet-${axis.label}`}
                          points={getRadarPoints(scales)}
                          fill={`${axis.color}1F`}
                          stroke={axis.color}
                          strokeWidth="1.1"
                          opacity="0.82"
                        />
                      );
                    })}
                    {/* Combined data polygon on top */}
                    <polygon
                      points={getRadarPoints(RADAR_AXES.map((axis) => axis.value / 100))}
                      fill="var(--radar-data-fill)"
                      stroke="var(--radar-data-stroke)"
                      strokeWidth="1.4"
                    />
                    {RADAR_AXES.map((axis, i) => {
                      const point = getRadarPoint(i, axis.value / 100);
                      return (
                        <circle
                          key={`node-${axis.label}`}
                          cx={point.x}
                          cy={point.y}
                          r="3.2"
                          fill={axis.color}
                          stroke="var(--radar-node-stroke)"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </svg>
                  {/* Labels positioned around the chart */}
                  {RADAR_AXES.map((axis, i) => {
                    const labelPoint = getRadarPoint(i, 1.18);
                    const x = (labelPoint.x / 200) * 100;
                    const y = (labelPoint.y / 200) * 100;
                    return (
                      <span
                        key={axis.label}
                        className={styles.radarLabel}
                        style={{ left: `${x}%`, top: `${y}%`, color: axis.color }}
                      >
                        {axis.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className={styles.fullBodyWrap}>
                <div className={styles.knowledgeOrbit} aria-hidden="true">
                  {KNOWLEDGE_DOMAINS.map((domain, index) => {
                    const pos = BUBBLE_SCATTER[index];
                    return (
                      <span
                        key={domain}
                        className={styles.knowledgeBubble}
                        style={{
                          ['--bubble-index' as string]: String(index),
                          ['--bx' as string]: pos.x,
                          ['--by' as string]: pos.y,
                          ['--dx' as string]: pos.dx,
                          ['--dy' as string]: pos.dy,
                          animationDelay: pos.delay,
                          animationDuration: `${10 + index * 0.9}s`,
                        }}
                      >
                        {domain}
                      </span>
                    );
                  })}
                </div>
                <Image
                  src="/blue/blue-left.png"
                  alt="Blue full body"
                  fill
                  className={styles.fullBodyImage}
                  unoptimized
                  priority
                />
                <div className={styles.fullBodyGlow} />
              </div>

              {/* Power Tools */}
              <div className={styles.expandedQuickPanel}>
                <h3 className={styles.panelHeading}>Power Tools</h3>
                <div className={styles.expandedQuickGrid}>
                  <button
                    className={`${styles.expandedQuickCard} ${expandedPane === 'lists' ? styles.expandedQuickCardActive : ''}`}
                    onClick={() => { play('click'); setExpandedPane((pane) => (pane === 'lists' ? 'chat' : 'lists')); }}
                    onMouseEnter={() => play('hover')}
                    type="button"
                    aria-pressed={expandedPane === 'lists'}
                  >
                    <span className={styles.toolCardTop}>
                      <span className={styles.toolCardText}>
                        <span className={styles.toolSlideWrap}>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText}`}>Lists</span>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText} ${styles.toolSlideClone}`}>Lists</span>
                        </span>
                        <span className={styles.toolCardMeta}>Three lists hold everything: what you must do, what you are tracking, and everything else.</span>
                        <span className={styles.toolCardCost}>
                          {expandedPane === 'lists' ? 'Back to chat' : 'Open your lists'}
                        </span>
                      </span>
                      <span className={styles.toolCardIcon} aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 6h13M8 12h13M8 18h13" />
                          <path d="M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                      </span>
                    </span>
                    <span className={styles.toolCardBottom} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* Main column — chat, or the three lists */}
            <div className={`${styles.expandedCenter} ${expandedPane === 'lists' ? styles.expandedCenterLists : ''}`}>
              {expandedPane === 'lists' ? (
                <ListsPanel
                  authHeaders={authHeaders}
                  isAuthenticated={ready && authenticated}
                  onSound={play}
                />
              ) : (
                chatContent
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Compact (default) layout ── */
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />

      <div className={styles.chatContainer}>
        <div className={styles.compactTopBar}>
          <div className={styles.compactTopBarBrand}>
            <Image src="/blue/blue-home.png" alt="" width={40} height={40} className={styles.compactTopBarFace} unoptimized />
            <span className={styles.compactTopBarName}>Blue</span>
          </div>
          <div className={styles.compactControls}>
          <button
            className={`${styles.voiceToggleButton} ${voiceEnabled ? styles.voiceToggleActive : ''}`}
            onClick={toggleVoice}
            type="button"
            aria-pressed={voiceEnabled}
            aria-label={voiceEnabled ? 'Turn off Blue voice' : 'Turn on Blue voice'}
            title={voiceEnabled ? 'Voice on — Blue speaks responses aloud' : 'Voice off — tap to let Blue speak responses'}
          >
            {voiceEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            )}
          </button>
          {/* Expanded mode is shelved — the fullscreen layout, ListsPanel, and
              radar remain in this file with no trigger. Restore by re-adding an
              expand button that calls setIsExpanded(true). */}
          <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Close chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          </div>
        </div>

        {chatContent}
      </div>
    </>
  );
};

export default BlueChat;
