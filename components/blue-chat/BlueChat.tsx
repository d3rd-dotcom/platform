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

const VOICE_PREF_KEY = 'blueChat.voiceEnabled';
import TimeManagementInline from './TimeManagementInline';
import AutoDistributionInline from './AutoDistributionInline';
import type { AutoDistributionRequest } from './AutoDistributionInline';
import QuestForgeInline from './QuestForgeInline';
import type { QuestForgeDraft, QuestForgeRequest } from './QuestForgeInline';
import { sendUsdcOnBase, type Eip1193Provider } from '@/lib/usdc-base-transfer';
import { broadcastPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';

const ProMembershipModal = dynamic(() => import('../pro-membership-modal/ProMembershipModal'), { ssr: false });

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
    el.onended = () => { URL.revokeObjectURL(url); resolve(); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Audio playback error')); };
    el.play().catch(reject);
  });
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'blue';
  timestamp: Date;
  attachments?: UploadedAttachment[];
  debug?: MessageDebugInfo;
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

interface AutoDistributionXConnection {
  loading: boolean;
  connected: boolean;
  username: string | null;
  error: string | null;
}

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
  const GREETINGS_VOICE = [
    "h..h-hello...? who's this?",
    "oh — hey. didn't see you there. what's up?",
    "you're back. good. i've got something for you.",
  ];
  const GREETINGS_TEXT = [
    "hey, i'm blue. your research partner in the digital matrix. what are we analyzing today?",
    "good to see you. what are we looking at?",
    "you're here. let's get into it.",
  ];
  const initialGreeting = startWithVoice
    ? GREETINGS_VOICE[Math.floor(Math.random() * GREETINGS_VOICE.length)]
    : GREETINGS_TEXT[Math.floor(Math.random() * GREETINGS_TEXT.length)];
  const [messages, setMessages] = useState<Message[]>([
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
  const [shardCount, setShardCount] = useState<number | null>(null);
  const [shardUpsell, setShardUpsell] = useState<ShardUpsellState | null>(null);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile | null>(null);
  const [researchMode, setResearchMode] = useState(false);
  const [researchUploaderVisible, setResearchUploaderVisible] = useState(false);
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
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [timeManagementVisible, setTimeManagementVisible] = useState(false);
  const [autoDistributionVisible, setAutoDistributionVisible] = useState(false);
  const [questForgeVisible, setQuestForgeVisible] = useState(false);
  const [questDraft, setQuestDraft] = useState<QuestForgeDraft | null>(null);
  const [questDraftNonce, setQuestDraftNonce] = useState(0);
  const [questForgeBusy, setQuestForgeBusy] = useState(false);
  const [pendingCourseDelete, setPendingCourseDelete] = useState<string | null>(null);
  const [autoDistributionXConnection, setAutoDistributionXConnection] = useState<AutoDistributionXConnection>({
    loading: false,
    connected: false,
    username: null,
    error: null,
  });
  const [openDebugMessageId, setOpenDebugMessageId] = useState<string | null>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

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

  const fetchAutoDistributionXConnection = useCallback(async () => {
    setAutoDistributionXConnection((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/x-auth/status', { credentials: 'include' });
      if (!res.ok) {
        setAutoDistributionXConnection({
          loading: false,
          connected: false,
          username: null,
          error: 'x status unavailable',
        });
        return;
      }

      const data = await res.json();
      setAutoDistributionXConnection({
        loading: false,
        connected: Boolean(data.connected),
        username: data.xAccount?.username ?? null,
        error: null,
      });
    } catch {
      setAutoDistributionXConnection({
        loading: false,
        connected: false,
        username: null,
        error: 'x status unavailable',
      });
    }
  }, []);

  useEffect(() => {
    if (!autoDistributionVisible) return;

    fetchAutoDistributionXConnection();
    const sync = () => fetchAutoDistributionXConnection();
    window.addEventListener('xAccountUpdated', sync);
    return () => window.removeEventListener('xAccountUpdated', sync);
  }, [autoDistributionVisible, fetchAutoDistributionXConnection]);

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

  // When chat is opened via "Call Blue": enable voice, speak the quirky greeting, then return to normal text.
  useEffect(() => {
    if (!startWithVoice) return;
    setVoiceEnabled(true);
    voiceEnabledRef.current = true;
    setStorageItem(VOICE_PREF_KEY, '1');
    setIsSpeaking(true);
    const controller = new AbortController();
    voiceAbortRef.current = controller;
    speakBlue("h..h-hello...? who's this?", controller.signal)
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[BlueChat] call greeting TTS failed:', err);
      })
      .finally(() => setIsSpeaking(false));
  }, [startWithVoice]);

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
          submitUserMessage(transcript.trim(), []);
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

  const addBlueMessage = (text: string, debug?: MessageDebugInfo) => {
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

  const sendToEliza = async (
    text: string,
    mode?: 'research' | 'auto-distribution',
    attachments?: UploadedAttachment[]
  ) => {
    if (!ready || !authenticated) {
      addBlueMessage('sign in first so i can access your account and respond here.');
      return;
    }

    setIsTyping(true);
    setShardUpsell(null);
    try {
      const res = await fetch('/api/chat/blue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        credentials: 'include',
        body: JSON.stringify({ message: text, mode, attachments, pathname: currentPathname }),
      });
      const data = await res.json();

      if (res.ok && data.response) {
        setShardCount(data.shardsRemaining ?? shardCount);
        setIsTyping(false);
        addBlueMessage(data.response, {
          ...(data.debug || {}),
          shardBalance: data.shardsRemaining ?? shardCount ?? null,
        });
        return;
      }

      if (data.error === 'insufficient_shards') {
        setShardCount(data.shardCount);
        setIsTyping(false);
        openShardUpsell(SHARD_COST, 'chat');
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
        setResearchMode(false);
        setResearchUploaderVisible(false);
        setIsVipMember(false);
        addBlueMessage("research mode needs an active VIP membership. grab a membership card and it unlocks again.");
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
        mode: mode ?? 'chat',
        shardsDeducted: 0,
        shardBalance: shardCount,
        notes,
      });
    } catch {
      setIsTyping(false);
      addBlueMessage(generateBlueResponse(text), {
        source: 'local-fallback',
        mode: mode ?? 'chat',
        shardsDeducted: 0,
        shardBalance: shardCount,
        notes: ['Network or runtime error on /api/chat/blue.'],
      });
    }
  };

  // Reference files are read in the browser — .txt/.md are plain text, so
  // there is no need to round-trip through an upload endpoint. The text is
  // sent inline with the next message.
  const uploadAttachmentFiles = async (files: FileList | null) => {
    if (!files?.length || isUploadingAttachment) return;

    setIsUploadingAttachment(true);

    try {
      const slots = Math.max(0, 4 - pendingAttachments.length);
      for (const file of Array.from(files).slice(0, slots)) {
        const lower = file.name.toLowerCase();
        if (!lower.endsWith('.txt') && !lower.endsWith('.md')) {
          addBlueMessage(`skipped ${file.name} — only .txt and .md files are supported.`);
          continue;
        }
        if (file.size > 2 * 1024 * 1024) {
          addBlueMessage(`skipped ${file.name} — keep reference files under 2MB.`);
          continue;
        }
        const text = (await file.text()).slice(0, 12000).trim();
        if (!text) {
          addBlueMessage(`skipped ${file.name} — the file looks empty.`);
          continue;
        }
        setPendingAttachments((prev) => [
          ...prev,
          {
            id: `${file.name}:${Date.now()}`,
            mime: lower.endsWith('.md') ? 'text/markdown' : 'text/plain',
            size: file.size,
            name: file.name,
            extractedText: text,
          },
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'could not read file';
      addBlueMessage(`couldn't read that file: ${message}`);
    } finally {
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
      setIsUploadingAttachment(false);
    }
  };

  const removePendingAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  // Shared pipeline for typed and voice input — appends the user message,
  // runs intent detection (quest forge, course delete), then routes by mode.
  const submitUserMessage = (text: string, attachments: UploadedAttachment[]) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      text,
      sender: 'user' as const,
      timestamp: new Date(),
      attachments: attachments.length ? attachments : undefined,
    }]);

    if (!researchMode && !autoDistributionVisible) {
      // Awaiting confirmation on a course delete — "yes" commits, anything else keeps it.
      if (pendingCourseDelete) {
        if (isAffirmative(text)) {
          confirmCourseDelete();
        } else {
          setPendingCourseDelete(null);
          addBlueMessage('kept it — your course is untouched.');
        }
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
    }

    if (researchMode) {
      setResearchUploaderVisible(false);
      sendToEliza(text, 'research', attachments);
      return;
    }

    if (autoDistributionVisible) {
      sendToEliza(text, 'auto-distribution', attachments);
      return;
    }

    sendToEliza(text, undefined, attachments);
  };

  const handleSend = async () => {
    if (isTyping || isUploadingAttachment) return;
    if (!inputText.trim() && pendingAttachments.length === 0) return;
    setShardUpsell(null);

    const text = inputText.trim() || 'Please review these attachments and help me continue.';
    const attachments = pendingAttachments;
    setInputText('');
    setPendingAttachments([]);
    submitUserMessage(text, attachments);
  };

  // Activate research mode. Research mode is a VIP-membership benefit — the
  // server confirms the wallet holds a membership card before unlocking.
  const activateResearchMode = async () => {
    try {
      const res = await fetch('/api/research/activate', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403 || data.error === 'vip_required') {
        setIsVipMember(false);
        addBlueMessage("research mode is a VIP membership benefit — full grant, proposal, and thesis drafting. grab a membership card and it unlocks for good.");
        setShowMembershipModal(true);
        return;
      }
      if (!res.ok || !data.ok) {
        addBlueMessage("couldn't unlock research mode. try again.");
        return;
      }

      setIsVipMember(true);
      setResearchMode(true);
      setResearchUploaderVisible(true);
      addBlueMessage("research mode is live — unlocked with your VIP membership. tell me what you're writing — a grant, a proposal, a thesis chapter — plus the topic and any constraints (funder, length, deadline). drop any reference material in the card above. i'll draft it in full report form and we can refine section by section.");
    } catch {
      addBlueMessage("something went wrong unlocking research mode. try again.");
    }
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
        addBlueMessage(`you've got "${record.courseData.title}". deleting it wipes the course and its progress for good — say "yes" to confirm, anything else keeps it.`);
      } else if (record) {
        setPendingCourseDelete('course draft');
        addBlueMessage("you have a course that never finished generating. say \"yes\" and i'll clear it out, anything else keeps it.");
      } else {
        addBlueMessage("you don't have a custom course right now, so there's nothing to delete.");
      }
    } catch {
      setIsTyping(false);
      addBlueMessage("i couldn't check your course just now — try again in a sec.");
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
        addBlueMessage('done — your course and its progress are deleted. build a new one from the Courses page whenever.');
      } else if (res.ok) {
        addBlueMessage("turns out there was no course left to delete — you're already clear.");
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
  const closeInlinePanels = () => {
    setResearchMode(false);
    setAutoDistributionVisible(false);
    setTimeManagementVisible(false);
    setPendingAttachments([]);
  };

  const openQuestForge = () => {
    if (!isVipMember) {
      addBlueMessage("forging quests is a VIP membership perk. grab a membership card and i can spin up quests with credit or USDC rewards for you.");
      setShowMembershipModal(true);
      return;
    }
    closeInlinePanels();
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
    closeInlinePanels();
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
        addBlueMessage("i couldn't draft that one — fill the quest in below and i'll forge it.");
        return;
      }
      setQuestDraft(data.draft as QuestForgeDraft);
      setQuestDraftNonce((n) => n + 1);
      addBlueMessage('drafted it below. tweak anything, set the reward, and forge it.');
    } catch {
      addBlueMessage("something glitched drafting that — fill it in below and i'll forge it.");
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

      if (req.rewardKind === 'credits') {
        setQuestForgeVisible(false);
        setQuestDraft(null);
        fetchShardCount();
        window.dispatchEvent(new Event('shardsUpdated'));
        addBlueMessage(`done — "${req.title}" is live on the quests board. ${req.rewardAmount} diamonds each${req.targetCount > 1 ? `, up to ${req.targetCount} people` : ''}.`);
        return;
      }

      // USDC: fund the escrow on-chain from the creator's own wallet.
      const funding = data.funding;
      const questId = data.quest?.id;
      if (!funding || !questId) {
        addBlueMessage("the escrow wallet isn't set up, so i can't take USDC quests right now. ping the team.");
        return;
      }
      if (!isConnected || !connector) {
        addBlueMessage(`"${req.title}" is saved but stays hidden until it's funded. connect your wallet, then forge it again to send $${funding.amountDisplay} USDC into escrow.`);
        return;
      }

      addBlueMessage(`confirm the $${funding.amountDisplay} USDC transfer in your wallet — that funds the escrow i hold for "${req.title}".`);
      let txHash: string;
      try {
        const eip1193 = (await connector.getProvider()) as Eip1193Provider;
        txHash = await sendUsdcOnBase(eip1193, funding.usdcAddress, funding.blueWallet, funding.amount);
      } catch (err) {
        const code = (err as { code?: string | number })?.code;
        if (code === 'ACTION_REJECTED' || code === 4001) {
          addBlueMessage(`no worries — "${req.title}" is saved but stays hidden until it's funded. forge it again when you're ready to send the USDC.`);
        } else {
          addBlueMessage("that transfer didn't go through. the quest's saved but unfunded — try forging it again.");
        }
        return;
      }

      addBlueMessage('got the transfer — confirming it on Base...');
      const confirm = await fetch('/api/quests/forge/confirm-funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        credentials: 'include',
        body: JSON.stringify({ questId, txHash }),
      });
      const cdata = await confirm.json().catch(() => ({}));
      if (!confirm.ok) {
        addBlueMessage(cdata.error || "i got the transfer but couldn't confirm it yet — give it a minute and it'll go live once it settles.");
        return;
      }

      setQuestForgeVisible(false);
      setQuestDraft(null);
      addBlueMessage(`funded and live — "${req.title}" pays $${req.rewardAmount} USDC each. you approve every completion before i release the money.`);
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
      return "i'm Blue. scientist, researcher, BCI. i'm connected to the AI and to you simultaneously — not a bot, a loop. what do you want to know?";
    }

    // How are you
    if (has('how are you', 'you good', 'you okay', 'how you doing', 'how\'s it going')) {
      return "signal's clear. what are we moving today?";
    }

    // What is MWA / about
    if (has('what is mwa', 'what is mental wealth', 'what\'s mwa', 'about mwa', 'explain mwa', 'tell me about mwa') || (hasAll('what', 'this', 'place')) || (hasAll('what', 'this', 'app'))) {
      return "the world's first decentralized cohort for mental wellness. course, community, science — on-chain. not a self-help app.";
    }

    // Founder / who built it
    if (has('founder', 'who built', 'who made', 'who created', 'who started') || (hasAll('who', 'james'))) {
      return "built by a cognitive psych researcher and designer. not a side project.";
    }

    // Discord — check before community so the link always gets surfaced
    if (has('discord', 'server', 'join the community', 'join us')) {
      return "discord.gg/ZTRVCYwncs — come say hi, we're in there.";
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
      return "daily freewriting — no prompts, no grades, just you and the page. do it every day and the streak does the rest.";
    }

    // Streak
    if (has('streak')) {
      return "how many days in a row you showed up. field notes, quests, course work. keep it going.";
    }

    // Course / curriculum / chapters / weeks
    if (has('course', 'lesson', 'curriculum', 'chapter', 'seal', 'pathway', 'week', 'ethereal')) {
      return "11 chapters of real work — self-awareness to goal setting. complete each week to unlock the next.";
    }

    // Quests
    if (has('quest', 'daily task', 'daily mission', 'daily quest', 'mission')) {
      return "short daily tasks that earn diamonds - field notes, X posts, course stuff. check quests for what's live rn.";
    }

    // Surveys / assessments
    if (has('survey', 'assessment', 'phq', 'gad', 'questionnaire', 'psychological test')) {
      return "validated psych assessments — your results make the whole experience more personal. opt-in only.";
    }

    // Research mode / DeSci
    if (has('research mode', 'proposal', 'grant', 'thesis') || (hasAll('research', 'desci')) || (hasAll('research', 'write'))) {
      return "research mode is a VIP writing partner for grants, proposals, and thesis chapters — full report drafts you refine section by section. it unlocks with a VIP membership.";
    }

    // DeSci
    if (has('desci', 'decentralized science', 'decentralised science')) {
      return "science that isn't locked behind institutions. data, methods, funding — open. that's the whole thing.";
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

    // Livestream / events
    if (has('livestream', 'live stream', 'broadcast', 'live event', 'lecture')) {
      return "lectures, Q&As, curriculum events. check the livestream for what's up.";
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

  const handleQuickAction = (action: string) => {
    if (isTyping) return;

    const send = (text: string) => {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        text,
        sender: 'user' as const,
        timestamp: new Date(),
      }]);
    };

    if (action === 'time') {
      send('Help me time block');
      setPendingAttachments([]);
      setAutoDistributionVisible(false);
      setQuestForgeVisible(false);
      setTimeManagementVisible(true);
      addBlueMessage(
        "drop in your blocks. keep it lean. hit start and i'll keep the flow moving."
      );
    } else if (action === 'auto-distribution') {
      setResearchMode(false);
      setPendingAttachments([]);
      setTimeManagementVisible(false);
      setQuestForgeVisible(false);
      if (autoDistributionVisible) {
        send('Open auto-distribution');
        addBlueMessage("auto-distribution is already open. connect your channels and tell me what you're pushing.");
        return;
      }
      send('Open auto-distribution');
      setAutoDistributionVisible(true);
      addBlueMessage(
        "auto-distribution is live. connect approved channels, tell me the campaign, and i'll draft posts, image prompts, video concepts, ad angles, and engagement targets."
      );
    } else if (action === 'research') {
      setPendingAttachments([]);
      setAutoDistributionVisible(false);
      if (researchMode) {
        send('Open research mode');
        addBlueMessage("research mode is already open. tell me the document — grant, proposal, thesis chapter — the topic, and any constraints.");
        return;
      }
      send('Open research mode');
      setQuestForgeVisible(false);
      activateResearchMode();
    }
  };

  const connectAutoDistributionX = async () => {
    setAutoDistributionXConnection((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch('/api/x-auth/initiate', { credentials: 'include' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.authUrl) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'x connection failed';
        setAutoDistributionXConnection((prev) => ({ ...prev, loading: false, error: errorMessage }));
        addBlueMessage(`${errorMessage}.`);
        return;
      }

      window.location.href = data.authUrl;
    } catch {
      setAutoDistributionXConnection((prev) => ({ ...prev, loading: false, error: 'x connection failed' }));
      addBlueMessage('x connection failed.');
    }
  };

  const handleAutoDistributionGenerate = (request: AutoDistributionRequest) => {
    const hasShards = shardCount !== null && shardCount >= SHARD_COST;
    const platformLabels = request.platforms.map((platform) => {
      if (platform === 'twitter') {
        return autoDistributionXConnection.connected && autoDistributionXConnection.username
          ? `x (@${autoDistributionXConnection.username})`
          : 'x';
      }
      return platform;
    });

    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      text: `Auto-Distribution: ${request.brief}`,
      sender: 'user',
      timestamp: new Date(),
    }]);

    if (!hasShards) {
      openShardUpsell(SHARD_COST, 'chat');
      return;
    }

    const prompt = [
      `Campaign brief: ${request.brief}`,
      `Goal: ${request.goal}`,
      `Platforms: ${platformLabels.join(', ')}`,
      `Deliverables: ${request.deliverables.join(', ')}`,
      `Connection state: Gmail draft only; X ${autoDistributionXConnection.connected ? `connected${autoDistributionXConnection.username ? ` as @${autoDistributionXConnection.username}` : ''}` : 'not connected'}; Bluesky draft only.`,
      'Create a launch-ready distribution plan with channel-specific drafts, image prompts, short-form video concepts, ad angles, search queries for relevant conversations, and the single strongest marketing improvement you recommend.',
      'Assume explicit user approval is required before any publishing. Do not suggest spam, fake engagement, mass unsolicited outreach, or manipulative tactics.',
    ].join('\n');

    sendToEliza(prompt, 'auto-distribution');
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
            {isBlue && (
              <Image
                src="/splashlogo.png"
                alt="Blue"
                width={44}
                height={29}
                className={styles.blueAvatar}
                unoptimized
              />
            )}
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
            <Image
              src="/splashlogo.png"
              alt="Blue"
              width={44}
              height={29}
              className={styles.blueAvatar}
              unoptimized
            />
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

        {autoDistributionVisible && (
          <AutoDistributionInline
            isBusy={isTyping}
            xConnection={autoDistributionXConnection}
            onConnectX={connectAutoDistributionX}
            onGenerate={handleAutoDistributionGenerate}
            onClose={() => setAutoDistributionVisible(false)}
          />
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

      {timeManagementVisible && (
        <TimeManagementInline
          onTimerStarted={(taskTitle, durationMinutes) => {
            addBlueMessage(`timer's live. ${taskTitle} for ${durationMinutes} minutes.`);
          }}
          onNextTask={(taskTitle, durationMinutes) => {
            addBlueMessage(`next up: ${taskTitle}. ${durationMinutes} minutes. go.`);
          }}
          onSessionComplete={() => {
            addBlueMessage("clean run. you're done.");
          }}
        />
      )}


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

      {/* Research context uploader — shown right after research mode unlocks */}
      {researchMode && researchUploaderVisible && (
        <div className={styles.researchUploader}>
          <div className={styles.researchUploaderHead}>
            <span className={styles.researchUploaderTitle}>Add reference material</span>
            <button
              type="button"
              className={styles.researchUploaderDismiss}
              onClick={() => setResearchUploaderVisible(false)}
              aria-label="Dismiss uploader"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className={styles.researchUploaderDesc}>
            Upload notes, a prior draft, or the call for proposals as a .txt or .md file and Blue will draft from them. Optional — you can also just describe what you need.
          </p>
          {pendingAttachments.length > 0 && (
            <div className={styles.researchUploaderChips}>
              {pendingAttachments.map((attachment) => (
                <span key={attachment.id} className={styles.researchUploaderChip}>
                  <span className={styles.researchUploaderChipIcon} aria-hidden="true">
                    {fileTypeLabel(attachment.mime)}
                  </span>
                  <span className={styles.researchUploaderChipName}>{attachment.name}</span>
                  <button
                    type="button"
                    className={styles.researchUploaderChipRemove}
                    onClick={() => removePendingAttachment(attachment.id)}
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            className={styles.researchUploaderButton}
            onClick={() => attachmentInputRef.current?.click()}
            disabled={isUploadingAttachment || pendingAttachments.length >= 4}
          >
            {isUploadingAttachment
              ? 'Uploading...'
              : pendingAttachments.length >= 4
                ? 'Maximum of 4 files'
                : pendingAttachments.length > 0
                  ? 'Add another file'
                  : 'Choose files'}
          </button>
        </div>
      )}

      <input
        ref={attachmentInputRef}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        multiple
        hidden
        onChange={(e) => uploadAttachmentFiles(e.target.files)}
      />

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        {shardCount !== null && (
          <div className={styles.shardCounter}>
            <Image src="/icons/ui-diamond.svg" alt="" width={14} height={14} className={styles.shardCounterIcon} />
            <span>{shardCount}</span>
          </div>
        )}
        <button className={styles.quickAction} onClick={() => { play('click'); submitUserMessage('give me a task', []); }} type="button">
          task
        </button>
        <button className={styles.quickAction} onClick={() => { play('click'); submitUserMessage('what do you remember about me?', []); }} type="button">
          memories
        </button>
        <button className={styles.quickAction} onClick={() => { play('click'); submitUserMessage('what missions are up?', []); }} type="button">
          missions
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
          disabled={isTyping || isUploadingAttachment}
        />
        <button
          className={`${styles.voiceButton} ${isRecording ? styles.voiceActive : ''} ${isSpeaking ? styles.voiceSpeaking : ''}`}
          onClick={startVoiceChat}
          type="button"
          aria-label={isRecording ? 'Stop recording' : 'Voice chat'}
          disabled={isUploadingAttachment}
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
          disabled={(!inputText.trim() && pendingAttachments.length === 0) || isTyping || isUploadingAttachment}
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
        <div className={styles.backdrop} onClick={() => setIsExpanded(false)} />
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
              <button className={styles.expandButton} onClick={() => setIsExpanded(false)} type="button" aria-label="Collapse">
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
            {/* Left — Full body character */}
            <div className={styles.expandedRight}>
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
            </div>

            {/* Center — Chat (no duplicate emote image) */}
            <div className={styles.expandedCenter}>
              {chatContent}
            </div>

            {/* Right panel — Knowledge & tools */}
            <div className={styles.expandedLeft}>
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

              {/* Power Tools */}
              <div className={styles.expandedQuickPanel}>
                <h3 className={styles.panelHeading}>Power Tools</h3>
                <div className={styles.expandedQuickGrid}>
                  <button className={`${styles.expandedQuickCard} ${styles.expandedQuickAccent}`} onClick={() => { play('click'); handleQuickAction('research'); }} onMouseEnter={() => play('hover')} disabled={isTyping} type="button">
                    <span className={styles.toolCardTop}>
                      <span className={styles.toolCardText}>
                        <span className={styles.toolSlideWrap}>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText}`}>Research</span>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText} ${styles.toolSlideClone}`}>Research</span>
                        </span>
                        <span className={styles.toolCardMeta}>Draft grant applications, research proposals, and thesis chapters with Blue — full report drafts refined section by section.</span>
                        <span className={styles.toolCardCost}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z"/></svg>
                          {researchMode
                            ? 'Research mode active'
                            : isVipMember
                              ? 'Included with VIP membership'
                              : 'VIP membership required'}
                        </span>
                      </span>
                      <span className={styles.toolCardIcon} aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.39-1.42 1.42-5.39-5.39A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-.9 2.4h1.8v2.7h2.7v1.8h-2.7v2.7H9.1v-2.7H6.4V9.1h2.7Z"/></svg>
                      </span>
                    </span>
                    <span className={styles.toolCardBottom} aria-hidden="true" />
                  </button>
                  <button className={styles.expandedQuickCard} onClick={() => { play('click'); handleQuickAction('time'); }} onMouseEnter={() => play('hover')} disabled={isTyping} type="button">
                    <span className={styles.toolCardTop}>
                      <span className={styles.toolCardText}>
                        <span className={styles.toolSlideWrap}>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText}`}>Focus Blocks</span>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText} ${styles.toolSlideClone}`}>Focus Blocks</span>
                        </span>
                        <span className={styles.toolCardMeta}>Stack up to four timed work blocks and keep the session moving.</span>
                      </span>
                      <span className={styles.toolCardIcon} aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.11-.9-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                      </span>
                    </span>
                    <span className={styles.toolCardBottom} aria-hidden="true" />
                  </button>
                </div>
              </div>

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
            <Image src="/splashlogo.png" alt="" width={44} height={29} className={styles.compactTopBarFace} unoptimized />
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
          {!isMobile && (
            <button className={styles.expandButton} onClick={() => setIsExpanded(true)} type="button" aria-label="Expand to fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          )}
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
