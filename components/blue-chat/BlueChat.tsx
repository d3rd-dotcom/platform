'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './BlueChat.module.css';
import { useSound } from '@/hooks/useSound';
import CreditBuilderInline from './CreditBuilderInline';
import type { CreditIntakeData } from './CreditBuilderInline';
import TimeManagementInline from './TimeManagementInline';
import AutoDistributionInline from './AutoDistributionInline';
import type { AutoDistributionRequest } from './AutoDistributionInline';
import ResearchCards from './ResearchCards';
import type { ResearchSource } from './ResearchCards';

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
  action?: 'research-reclaim';
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
      pageMatch: boolean;
      matchedKeywords: string[];
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
  url: string;
  mime: string;
  size: number;
  name: string;
  extractedText?: string | null;
}

interface BlueChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShardUpsellState {
  required: number;
  current: number;
  reason: 'chat' | 'research' | 'gpu' | 'credit';
}

interface TreasuryContext {
  balance: string | null;
  balanceUsd: number | null;
  governanceBalance: string | null;
  traderBalance: string | null;
  prices: { symbol: string; usd: number; change: number | null }[];
  topMarkets: { question: string; yes: number }[];
}

const BLUE_EMOTES = {
  default: '/images/blue-happy.png',
  surprised: '/images/blue-surprised.png',
  angry: '/images/blue-angry.png',
  searching: '/images/blue-searching.png',
  happy: '/images/blue-happy.png',
  joyful: '/images/blue-joyful.png',
  dead: '/images/blue-dead.png',
} as const;

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
const RESEARCH_COST = 1000;

const GPU_TIER_INFO = {
  focus: {
    label: 'Focus',
    model: 'Llama 3.1 8B',
    gpu: 'RTX 4070',
    desc: 'Fast synthesis. Summaries and structured reports.',
    shards: 700,
    badge: 'Fast',
    badgeClass: 'gpuTierBadgeFocus',
    cardClass: 'gpuTierCardFocus',
  },
  deep: {
    label: 'Deep',
    model: 'Llama 3.1 8B',
    gpu: 'RTX 4090',
    desc: 'Thorough multi-source analysis.',
    shards: 1400,
    badge: 'Balanced',
    badgeClass: 'gpuTierBadgeDeep',
    cardClass: 'gpuTierCardDeep',
  },
  elite: {
    label: 'Elite',
    model: 'Llama 3.1 70B',
    gpu: 'A100',
    desc: 'Graduate-level synthesis at 70B scale.',
    shards: 2000,
    badge: 'Maximum',
    badgeClass: 'gpuTierBadgeElite',
    cardClass: 'gpuTierCardElite',
  },
} as const;

type GpuTier = keyof typeof GPU_TIER_INFO;

const BlueChat: React.FC<BlueChatProps> = ({ isOpen, onClose }) => {
  const { play } = useSound();
  const currentPathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "what's the actual goal? say it plain and we move.",
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
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<'chat' | 'research'>('chat');
  const [researchMode, setResearchMode] = useState(false);
  const [researchSources, setResearchSources] = useState<ResearchSource[] | null>(null);
  const [researchPayTo, setResearchPayTo] = useState('');
  const [researchTopic, setResearchTopic] = useState('');
  const [researchReclaimToken, setResearchReclaimToken] = useState<string | null>(null);
  const [researchReclaimStatus, setResearchReclaimStatus] = useState<'idle' | 'claiming' | 'claimed'>('idle');
  const [researchSuggestions, setResearchSuggestions] = useState<Array<{ title: string; author: string; year?: number; desc: string }> | null>(null);
  const [gpuPickerStep, setGpuPickerStep] = useState<'gate' | 'topic' | 'select' | null>(null);
  const [gpuTopicDraft, setGpuTopicDraft] = useState('');
  const [gpuJobId, setGpuJobId] = useState<string | null>(null);
  const [gpuResearchMode, setGpuResearchMode] = useState(false);
  const [gpuTopic, setGpuTopic] = useState('');
  const [gpuStatus, setGpuStatus] = useState<'provisioning' | 'completed' | 'failed' | null>(null);
  const gpuPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [treasury, setTreasury] = useState<TreasuryContext>({
    balance: null,
    balanceUsd: null,
    governanceBalance: null,
    traderBalance: null,
    prices: [],
    topMarkets: [],
  });
  const [emoteA, setEmoteA] = useState<keyof typeof BLUE_EMOTES>('default');
  const [emoteB, setEmoteB] = useState<keyof typeof BLUE_EMOTES>('default');
  const [activeLayer, setActiveLayer] = useState<'a' | 'b'>('a');
  const emoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [creditStep, setCreditStep] = useState<'hidden' | 'intake' | 'payment' | 'processing' | 'done'>('hidden');
  const [timeManagementVisible, setTimeManagementVisible] = useState(false);
  const [autoDistributionVisible, setAutoDistributionVisible] = useState(false);
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

  // Fetch shard count
  const fetchShardCount = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const nextShardCount = typeof data.user?.shardCount === 'number' ? data.user.shardCount : null;
        setShardCount(nextShardCount);
        setViewerProfile(data.user ? { username: data.user.username ?? null } : null);
      }
    } catch { /* silent */ }
  }, []);

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
    }
  }, [isOpen, fetchTreasuryContext, fetchShardCount]);

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
        setInputText(transcript.trim());
        // Auto-send via the same flow as typed messages
        setTimeout(() => {
          setInputText(transcript.trim());
          // Trigger handleSend logic inline
          const text = transcript.trim();
          const userMessage: Message = {
            id: Date.now().toString(),
            text,
            sender: 'user',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, userMessage]);
          setInputText('');
          showEmote('dead');
          if (gpuResearchMode && gpuJobId) {
            if (gpuTopic) {
              addBlueMessage('already processing your topic. gpu synthesis in progress.');
            } else {
              setGpuTopic(text);
              addBlueMessage(`locking in "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}" — polling nosana gpu.`);
            }
          } else if (researchMode) {
            discoverResearch(text);
          } else if (autoDistributionVisible) {
            sendToEliza(text, 'auto-distribution');
          } else {
            sendToEliza(text);
          }
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

  const addBlueMessage = (text: string, action?: Message['action'], debug?: MessageDebugInfo) => {
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
          action,
          debug,
        },
      ]);
      setIsTyping(false);

      // Auto-speak Blue's responses via Eliza ElevenLabs TTS
      voiceAbortRef.current?.abort();
      const controller = new AbortController();
      voiceAbortRef.current = controller;
      setIsSpeaking(true);
      if (spokenText) {
        speakBlue(spokenText, controller.signal)
          .catch(() => {/* aborted or TTS unavailable — silent */})
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
    action?: Message['action'],
    attachments?: UploadedAttachment[]
  ) => {
    setIsTyping(true);
    setShardUpsell(null);
    showEmote('searching');
    try {
      const res = await fetch('/api/chat/blue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, mode, attachments, pathname: currentPathname }),
      });
      const data = await res.json();

      if (res.ok && data.response) {
        setShardCount(data.shardsRemaining ?? shardCount);
        setIsTyping(false);
        addBlueMessage(data.response, action, {
          ...(data.debug || {}),
          shardBalance: data.shardsRemaining ?? shardCount ?? null,
        });
        return;
      }

      if (data.error === 'insufficient_shards') {
        setShardCount(data.shardCount);
        setIsTyping(false);
        openShardUpsell(mode === 'research' ? RESEARCH_COST : SHARD_COST, mode === 'research' ? 'research' : 'chat');
        return;
      }

      if (data.error === 'user_not_found') {
        setIsTyping(false);
        addBlueMessage(
          'i cannot find your account record for this session. refresh, reconnect your wallet, and try again.'
        );
        return;
      }

      // AI unavailable -- fallback to local
      const notes = [
        typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'API returned a non-success response without usable assistant text.',
      ];
      setIsTyping(false);
      addBlueMessage(generateBlueResponse(text), action, {
        source: 'local-fallback',
        mode: mode ?? 'chat',
        shardsDeducted: 0,
        shardBalance: shardCount,
        notes,
      });
    } catch {
      setIsTyping(false);
      addBlueMessage(generateBlueResponse(text), action, {
        source: 'local-fallback',
        mode: mode ?? 'chat',
        shardsDeducted: 0,
        shardBalance: shardCount,
        notes: ['Network or runtime error on /api/chat/blue.'],
      });
    }
  };

  const uploadAttachmentFiles = async (files: FileList | null) => {
    if (!files?.length || isUploadingAttachment) return;

    setIsUploadingAttachment(true);

    try {
      for (const file of Array.from(files).slice(0, Math.max(0, 4 - pendingAttachments.length))) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.url || !data.mime) {
          throw new Error(data.error || 'Upload failed');
        }

        setPendingAttachments((prev) => [
          ...prev,
          {
            id: `${data.url}:${Date.now()}`,
            url: data.url,
            mime: data.mime,
            size: data.size ?? file.size,
            name: data.name ?? file.name,
            extractedText: data.extractedText ?? null,
          },
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      addBlueMessage(`attachment upload failed: ${message}`);
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

  const handleSend = async () => {
    if (isTyping || isUploadingAttachment) return;
    if (!inputText.trim() && pendingAttachments.length === 0) return;
    setShardUpsell(null);

    const text = inputText.trim() || 'Please review these attachments and help me continue.';
    const attachments = pendingAttachments;
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
      attachments,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setPendingAttachments([]);
    showEmote('dead');

    if (gpuResearchMode && gpuJobId) {
      if (gpuTopic) {
        addBlueMessage('already processing your topic. gpu synthesis in progress — hang tight.');
      } else {
        setGpuTopic(text);
        addBlueMessage(`locking in "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}" — polling nosana gpu for synthesis.`);
        showEmote('searching');
      }
      return;
    }

    if (researchMode) {
      discoverResearch(text);
      return;
    }

    if (autoDistributionVisible) {
      sendToEliza(text, 'auto-distribution', undefined, attachments);
      return;
    }

    sendToEliza(text, undefined, undefined, attachments);
  };

  const discoverResearch = async (topic: string) => {
    setIsTyping(true);
    showEmote('searching');
    setResearchTopic(topic);
    setResearchSuggestions(null);

    try {
      const res = await fetch('/api/research/discover', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();

      if (data.sources?.length > 0) {
        setIsTyping(false);
        setResearchReclaimToken(null);
        setResearchReclaimStatus('idle');
        setResearchSources(data.sources);
        setResearchPayTo(data.payTo);
        addBlueMessage('found some sources. pick the ones you want and i will fetch them.');
        return;
      }

      // No paid sources — fetch AI-curated suggestions as entry points
      try {
        const suggestRes = await fetch('/api/research/suggest', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
        });
        const suggestData = await suggestRes.json();

        setIsTyping(false);

        if (suggestRes.ok && suggestData.suggestions?.length > 0) {
          setResearchSuggestions(suggestData.suggestions);
          setResearchReclaimToken(data.reclaimToken ?? null);
          setResearchReclaimStatus(data.reclaimToken ? 'idle' : 'claimed');
          addBlueMessage("no paid sources in the bazaar yet. here are three foundational works — click one to synthesize from it.");
          return;
        }
      } catch {
        // suggest failed — fall through to Eliza
      }

      setIsTyping(false);
      setResearchReclaimToken(data.reclaimToken ?? null);
      setResearchReclaimStatus(data.reclaimToken ? 'idle' : 'claimed');
      addBlueMessage('no sources available. synthesizing from training.');
      sendToEliza(topic, 'research', data.reclaimToken ? 'research-reclaim' : undefined);
    } catch {
      setIsTyping(false);
      addBlueMessage('discovery failed. synthesizing from training.');
      sendToEliza(topic, 'research');
    }
  };

  const handleSuggestionClick = (s: { title: string; author: string; year?: number; desc: string }) => {
    setResearchSuggestions(null);
    const label = `${s.title} by ${s.author}${s.year ? ` (${s.year})` : ''}`;
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      text: `Synthesize: ${label}`,
      sender: 'user' as const,
      timestamp: new Date(),
    }]);
    const prompt = `${label} — synthesize the key contributions of this work in the context of: ${researchTopic}`;
    sendToEliza(prompt, 'research');
  };

  const startGpuResearch = async (tier: GpuTier, topic: string) => {
    setGpuPickerStep(null);
    setGpuTopicDraft('');
    setIsTyping(true);
    showEmote('searching');
    try {
      const res = await fetch('/api/research/gpu', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'insufficient_shards') {
          addBlueMessage(
            `not enough shards. ${GPU_TIER_INFO[tier].label} GPU costs ${GPU_TIER_INFO[tier].shards.toLocaleString()} shards. keep building and come back.`
          );
        } else if (data.error === 'GPU research not available') {
          addBlueMessage('gpu research is not configured yet. check back soon.');
        } else {
          addBlueMessage(`gpu provisioning failed: ${data.error || 'unknown error'}. try again.`);
        }
        return;
      }

      // Set topic immediately so polling loop starts as soon as the job ID is set
      setGpuTopic(topic);
      setGpuJobId(data.jobId);
      setGpuStatus('provisioning');
      setGpuResearchMode(true);
      setShardCount(data.shardsRemaining ?? shardCount);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), text: topic, sender: 'user' as const, timestamp: new Date() },
      ]);
      addBlueMessage(
        `${GPU_TIER_INFO[tier].label} GPU is spinning up on Nosana (${GPU_TIER_INFO[tier].model}, ${GPU_TIER_INFO[tier].gpu}). synthesizing "${topic.slice(0, 60)}${topic.length > 60 ? '...' : ''}" — this usually takes 2–5 minutes.`
      );
    } catch {
      addBlueMessage('gpu connection failed. check your network and try again.');
    } finally {
      setIsTyping(false);
    }
  };

  // Poll GPU job status until synthesis completes or fails
  useEffect(() => {
    if (!gpuJobId || !gpuTopic) return;

    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(
          `/api/research/gpu/${gpuJobId}?topic=${encodeURIComponent(gpuTopic)}`,
          { credentials: 'include' }
        );
        const data = await res.json();
        if (!active) return;

        if (data.status === 'completed' && data.result) {
          active = false;
          setGpuStatus('completed');
          setGpuResearchMode(false);
          setGpuJobId(null);
          setGpuTopic('');
          setIsTyping(true);
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                text: data.result as string,
                sender: 'blue' as const,
                timestamp: new Date(),
              },
            ]);
            setIsTyping(false);
          }, 600);
        } else if (data.status === 'failed') {
          active = false;
          setGpuStatus('failed');
          setGpuResearchMode(false);
          setGpuJobId(null);
          setGpuTopic('');
          setIsTyping(true);
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                text: 'gpu synthesis failed. your shards have been refunded.',
                sender: 'blue' as const,
                timestamp: new Date(),
              },
            ]);
            setIsTyping(false);
          }, 600);
        }
      } catch {
        // network error — keep polling
      }
    };

    poll();
    const id = setInterval(poll, 10000);
    gpuPollRef.current = id;

    return () => {
      active = false;
      clearInterval(id);
      gpuPollRef.current = null;
    };
  }, [gpuJobId, gpuTopic]);

  const confirmShardSpend = async () => {
    if (!pendingMessage) return;

    if (pendingType !== 'research') return;

    setPendingMessage(null);
    setPendingType('chat');
    try {
      const res = await fetch('/api/shards/deduct', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: RESEARCH_COST, reason: 'research_activation' }),
      });
      if (res.ok) {
        const data = await res.json();
        setShardCount(data.shardsRemaining ?? (shardCount !== null ? shardCount - RESEARCH_COST : null));
        setResearchMode(true);
        addBlueMessage("research mode activated. what topic do you want me to look into?");
      } else {
        addBlueMessage("couldn't process the payment. try again.");
      }
    } catch {
      addBlueMessage("something went wrong. try again.");
    }
  };

  const cancelShardSpend = () => {
    if (!pendingMessage) return;
    setPendingMessage(null);
    setPendingType('chat');
  };

  const reclaimResearchShards = async () => {
    if (!researchReclaimToken || researchReclaimStatus !== 'idle') return;

    setResearchReclaimStatus('claiming');

    try {
      const res = await fetch('/api/shards/reclaim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: researchReclaimToken }),
      });
      const data = await res.json();

      if (res.ok) {
        setShardCount(data.shardsRemaining ?? shardCount);
        setResearchReclaimStatus('claimed');
        setResearchReclaimToken(null);
        window.dispatchEvent(new Event('shardsUpdated'));
        return;
      }
    } catch {
      // ignore and restore idle state below
    }

    setResearchReclaimStatus('idle');
  };

  const handleCreditIntakeComplete = async (data: CreditIntakeData) => {
    showEmote('surprised');

    // Build credit data payload
    const scores = [];
    if (data.equifax) scores.push({ bureau: 'equifax', score: data.equifax });
    if (data.experian) scores.push({ bureau: 'experian', score: data.experian });
    if (data.transunion) scores.push({ bureau: 'transunion', score: data.transunion });

    const accounts = [];
    for (let i = 0; i < data.latePayments; i++) accounts.push({ name: `Late ${i+1}`, type: 'revolving', balance: 0, limit: null, status: 'late' });
    for (let i = 0; i < data.collections; i++) accounts.push({ name: `Collection ${i+1}`, type: 'collection', balance: 0, limit: null, status: 'collection' });
    for (let i = 0; i < data.chargeOffs; i++) accounts.push({ name: `Charge-off ${i+1}`, type: 'other', balance: 0, limit: null, status: 'charged_off' });

    const inquiries = [];
    for (let i = 0; i < data.hardInquiries; i++) inquiries.push({ creditor: `Inquiry ${i+1}`, date: new Date().toISOString(), type: 'hard' });

    const creditData = {
      scores,
      accounts,
      inquiries,
      derogatory: [],
      totalDebt: data.totalDebt ?? undefined,
      totalCreditLimit: data.totalCreditLimit ?? undefined,
      oldestAccountAge: data.oldestAccountYears ? data.oldestAccountYears * 12 : undefined,
    };

    // Save to profile
    try {
      await fetch('/api/credit-builder/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditData, step: 'intake' }),
      });
    } catch { /* profile save failed but continue */ }

    setCreditStep('payment');
    addBlueMessage("nice. i've got your info. now let's activate the audit. this runs a full FICO breakdown, generates dispute letters, and tracks your progress.");
  };

  const handleCreditPayment = async () => {
    // Deduct shards
    if (shardCount !== null && shardCount < 50) {
      openShardUpsell(50, 'credit');
      return;
    }
    setCreditStep('processing');
    showEmote('searching', 12000);
    addBlueMessage("processing payment and running your audit. give me a moment...");

    try {
      // Deduct shards
      const deductRes = await fetch('/api/shards/deduct', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 50, reason: 'credit_builder_activation' }),
      });
      if (deductRes.ok) {
        const deductData = await deductRes.json();
        setShardCount(deductData.shardsRemaining ?? (shardCount !== null ? shardCount - 50 : null));
      }

      // Trigger audit
      const auditRes = await fetch('/api/credit-builder/audit', {
        method: 'POST',
        credentials: 'include',
      });

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        const result = auditData.auditResult;
        setCreditStep('done');
        showEmote('default');
        addBlueMessage(
          `audit complete. your average score is ${result.currentScoreAvg}, grade: ${result.overallGrade}. ` +
          `i found ${result.disputeRecommendations?.length || 0} items you can dispute. ` +
          `estimated potential gain: +${result.estimatedScoreAfterFixes - result.currentScoreAvg} points. ` +
          `head to the full Credit Builder page for your dispute letters and action plan.`
        );
      } else {
        setCreditStep('done');
        addBlueMessage("audit saved. head to the Credit Builder page to see your full results and start disputes.");
      }
    } catch {
      setCreditStep('done');
      addBlueMessage("something went wrong with the audit. your info is saved though. try the Credit Builder page directly.");
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

    // Shards — how to earn
    if (has('earn shard', 'get shard', 'how do i earn', 'how do i get shard') || (hasAll('earn', 'shard')) || (hasAll('get', 'shard', 'how'))) {
      return "quests, morning pages, sealing course weeks, surveys. show up daily and it stacks.";
    }

    // Shards — cost
    if (has('how much', 'cost shard', 'shard cost', 'spend shard', 'how many shard') || (hasAll('cost', 'chat')) || (hasAll('shard', 'cost'))) {
      return "10 shards per chat turn. earn them back from quests and morning pages.";
    }

    // Shards — balance / general
    if (has('shard') || (hasAll('my', 'balance')) || (hasAll('how many', 'point'))) {
      const bal = shardCount;
      return bal !== null
        ? `you got ${bal.toLocaleString()} shards rn. keep stacking from quests and morning pages.`
        : "your shard balance is on the home dashboard. quests and morning pages build it fastest.";
    }

    // Morning pages / journaling
    if (has('morning pages', 'morning page') || (hasAll('journal') && !has('research')) || has('prayer', 'daily writing', 'freewrite')) {
      return "daily freewriting — no prompts, no grades, just you and the page. do it every day and the streak does the rest.";
    }

    // Streak
    if (has('streak')) {
      return "how many days in a row you showed up. morning pages, quests, course work. keep it going.";
    }

    // Course / curriculum / chapters / weeks
    if (has('course', 'lesson', 'curriculum', 'chapter', 'seal', 'pathway', 'week', 'ethereal')) {
      return "11 chapters of real work — self-awareness to goal setting. seal each week to unlock the next.";
    }

    // Quests
    if (has('quest', 'daily task', 'daily mission', 'daily quest', 'mission')) {
      return "short daily tasks that earn shards — morning pages, X posts, course stuff. check /quests for what's live rn.";
    }

    // Surveys / assessments
    if (has('survey', 'assessment', 'phq', 'gad', 'questionnaire', 'psychological test')) {
      return "validated psych assessments — your results make the whole experience more personal. opt-in only.";
    }

    // Research mode / DeSci / x402
    if (has('research mode', 'x402', 'paywall', 'paid paper', 'gpu') || (hasAll('research', 'desci')) || (hasAll('synthesis', 'source'))) {
      return "source-backed synthesis on any topic — papers, mechanisms, evidence. go to /research.";
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
        : "markets on Kalshi, treasury-backed. head to /markets.";
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
      return "paywalled papers on x402, shard payouts from contributions, or treasury proposals. pick a lane.";
    }

    // Rewards / shop / loot
    if (has('reward', 'loot', 'loot box', 'prize', 'unlock') || (hasAll('shop', 'buy')) || (hasAll('spend', 'shard'))) {
      return "where shards go — loot boxes, upgrades, season drops. check /rewards or /shop.";
    }

    // Library
    if (has('library', 'reading', 'article', 'blog', 'book')) {
      return "curated reads at /library — articles and papers that actually matter, no algorithm.";
    }

    // Livestream / events
    if (has('livestream', 'live stream', 'broadcast', 'live event', 'lecture')) {
      return "lectures, Q&As, curriculum events. check /livestream for what's up.";
    }

    // Community page / Farcaster / social
    if (has('community', 'farcaster', 'leaderboard', 'other user', 'social')) {
      return "see other users and shared milestones at /community. discord.gg/ZTRVCYwncs for the real-time convo.";
    }

    // Profile / wallet / account
    if (has('profile', 'account setting', 'connect wallet', 'my wallet', 'username') || (hasAll('wallet', 'connect'))) {
      return "wallet, username, on-chain state — all at /profile.";
    }

    // Blockchain / Base / contracts / Web3
    if (has('blockchain', 'base chain', 'smart contract', 'on-chain', 'onchain', 'web3', 'nft', 'token')) {
      return "runs on Base. four contracts handling governance, treasury, your state, and markets.";
    }

    // Wallet connection — gas / metamask
    if (has('gas fee', 'metamask', 'coinbase wallet', 'connect my wallet', 'transaction fail')) {
      return "connect at /profile, you're on Base. if a tx fails just make sure you're on the right network with ETH for gas.";
    }

    // Privacy / data consent
    if (has('privacy', 'my data', 'data privacy', 'surveillance', 'encrypt', 'consent', 'opt out')) {
      return "morning pages are encrypted, nothing moves without your say. consent is built in, not bolted on.";
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
      return "seasons are the long arc — shard resets, loot cycles, leaderboard. stay consistent and it stacks.";
    }

    // What can I do / features / general help
    if (has('what can i do', 'how does this work', 'what\'s available', 'what do you do', 'what features', 'help me', 'guide me')) {
      return "course, morning pages, quests, research, markets, community. what specifically?";
    }

    // Help / generic help request
    if (has('help') && t.length < 30) {
      return "course, shards, research, markets, Discord — what do you need?";
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

    // Generic shard balance / treasury balance catch
    if (has('balance', 'how much', 'treasury')) {
      return treasury.balance
        ? `treasury's at $${treasury.balance} USDC.`
        : "still loading treasury data. try again in a sec.";
    }

    const fallbacks = [
      "name the actual goal. that's where we start.",
      "give me the real version of that — what are you trying to move?",
      "what's the real question under that one?",
      "that's vague. one concrete thing you want to move — go.",
      "you're overthinking the ask. what do you actually want to do?",
      "say it plain. then we move.",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  };

  const switchEmote = useCallback((emote: keyof typeof BLUE_EMOTES) => {
    setActiveLayer((prev) => {
      if (prev === 'a') {
        setEmoteB(emote);
        return 'b';
      } else {
        setEmoteA(emote);
        return 'a';
      }
    });
  }, []);

  const showEmote = useCallback((emote: keyof typeof BLUE_EMOTES, durationMs = 6000) => {
    if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current);
    switchEmote(emote);
    emoteTimerRef.current = setTimeout(() => switchEmote('default'), durationMs);
  }, [switchEmote]);

  const handleQuickAction = (action: string) => {
    if (isTyping) return;

    const send = (text: string, emote: keyof typeof BLUE_EMOTES = 'happy') => {
      showEmote(emote);
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        text,
        sender: 'user' as const,
        timestamp: new Date(),
      }]);
    };

    if (action === 'what-is-this') {
      send('What is this place?', 'happy');
      setPendingAttachments([]);
      setTimeManagementVisible(false);
      setAutoDistributionVisible(false);
      setCreditStep('hidden');
      addBlueMessage(
        "the world's first decentralized cohort for mental wellness. course, community, science — on-chain. you're early."
      );
    } else if (action === 'level-up') {
      send('How do I level up?', 'happy');
      setPendingAttachments([]);
      setTimeManagementVisible(false);
      setAutoDistributionVisible(false);
      setCreditStep('hidden');
      const bal = shardCount;
      addBlueMessage(
        bal !== null
          ? `quests, morning pages every day, seal course weeks. you got ${bal.toLocaleString()} shards rn — keep stacking.`
          : "quests, morning pages every day, seal course weeks. shards stack, you level. that's the loop."
      );
    } else if (action === 'bci-lore') {
      send("What's the helmet?", 'happy');
      setPendingAttachments([]);
      setTimeManagementVisible(false);
      setAutoDistributionVisible(false);
      setCreditStep('hidden');
      addBlueMessage(
        "brain-computer interface. i'm connected to the AI and directly to you — reading signal, prompting, responding. not a bot. a loop."
      );
    } else if (action === 'credit') {
      send('I want to build my credit', 'happy');
      setPendingAttachments([]);
      setTimeManagementVisible(false);
      setAutoDistributionVisible(false);
      setCreditStep('intake');
      addBlueMessage(
        "let's get your credit right. fill out the form below with your current scores and any negative items on your report. you can find your scores free at annualcreditreport.com or through your bank app."
      );
    } else if (action === 'time') {
      send('Help me time block', 'happy');
      setPendingAttachments([]);
      setCreditStep('hidden');
      setAutoDistributionVisible(false);
      setTimeManagementVisible(true);
      addBlueMessage(
        "drop in your blocks. keep it lean. hit start and i'll keep the flow moving."
      );
    } else if (action === 'auto-distribution') {
      setResearchMode(false);
      setPendingAttachments([]);
      setTimeManagementVisible(false);
      setCreditStep('hidden');
      if (autoDistributionVisible) {
        send('Open auto-distribution', 'searching');
        addBlueMessage("auto-distribution is already open. connect your channels and tell me what you're pushing.");
        return;
      }
      send('Open auto-distribution', 'searching');
      setAutoDistributionVisible(true);
      addBlueMessage(
        "auto-distribution is live. connect approved channels, tell me the campaign, and i'll draft posts, image prompts, video concepts, ad angles, and engagement targets."
      );
    } else if (action === 'funding') {
      send('Funding', 'searching');
      addBlueMessage(
        "MWA funds research through treasury allocations, prediction-market pools, and x402 paper pre-sales."
      );
    } else if (action === 'earning') {
      send('Earning', 'happy');
      addBlueMessage(
        "earn here by paywalling papers on x402, taking synthesis commissions, or running paid surveys."
      );
    } else if (action === 'experiments') {
      send('Experiments', 'searching');
      addBlueMessage(
        "MWA hosts validated assessments, behavioral quests, and consented community surveys. ship your study here."
      );
    } else if (action === 'research') {
      setPendingAttachments([]);
      setAutoDistributionVisible(false);
      if (researchMode) {
        send('Open research mode', 'searching');
        addBlueMessage("research mode is already open. give me a topic, paper, or mechanism to trace.");
        return;
      }
      send('Open research mode', 'searching');
      if (shardCount !== null && shardCount >= RESEARCH_COST) {
        setPendingType('research');
        setPendingMessage('__research_activate__');
      } else {
        openShardUpsell(RESEARCH_COST, 'research');
      }
    } else if (action === 'gpu-research') {
      setResearchMode(false);
      setPendingAttachments([]);
      setAutoDistributionVisible(false);
      if (gpuResearchMode) {
        send('GPU research is running', 'searching');
        addBlueMessage(gpuTopic ? 'gpu research is processing your topic. synthesis in progress.' : 'gpu research is active. drop your research topic.');
        return;
      }
      send('Start GPU research session', 'searching');
      if (shardCount !== null && shardCount >= GPU_TIER_INFO.focus.shards) {
        setGpuPickerStep('gate');
      } else {
        openShardUpsell(GPU_TIER_INFO.focus.shards, 'gpu');
      }
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
      `shards spent: ${debug.shardsDeducted}`,
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
        const matched = entry.matchedKeywords.length
          ? ` [${entry.matchedKeywords.join(', ')}]`
          : '';
        const pageTag = entry.pageMatch ? ' (page match)' : '';
        lines.push(`  · ${entry.title} — score ${entry.score}${pageTag}${matched}`);
      }
    }

    if (debug.notes?.length) {
      lines.push(...debug.notes.map((note) => `note: ${note}`));
    }

    return lines;
  };

  const shardUpsellTitle = (
    shardUpsell?.reason === 'research'
      ? 'Research mode needs more shards'
      : shardUpsell?.reason === 'gpu'
        ? 'GPU research needs more shards'
        : shardUpsell?.reason === 'credit'
          ? 'Credit Builder needs more shards'
          : 'You are out of shards'
  );
  const shardUpsellBody = shardUpsell
    ? `You need ${shardUpsell.required.toLocaleString()} shards to continue. You currently have ${shardUpsell.current.toLocaleString()}. Purchase more to keep the conversation going.`
    : '';

  const chatContent = (
    <>
      {/* Messages */}
      <div className={styles.messagesArea}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.messageBubble} ${
              message.sender === 'user' ? styles.userMessage : styles.blueMessage
            }`}
          >
            <div
              className={`${styles.messageContentWrap} ${
                message.sender === 'blue' && message.debug ? styles.messageContentWrapDebug : ''
              }`}
            >
              <div className={styles.messageContent}>{message.text}</div>
              {message.sender === 'blue' && message.debug && (
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
                      {attachment.mime === 'application/pdf' ? 'PDF' : 'IMG'}
                    </span>
                    <span className={styles.messageAttachmentName}>{attachment.name}</span>
                  </div>
                ))}
              </div>
            )}
            {message.sender === 'blue' && message.action === 'research-reclaim' && (
              <button
                type="button"
                className={styles.reclaimBubble}
                onClick={reclaimResearchShards}
                disabled={researchReclaimStatus !== 'idle'}
              >
                <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} className={styles.reclaimBubbleIcon} />
                <span className={styles.reclaimBubbleText}>
                  {researchReclaimStatus === 'claimed' ? 'Shards reclaimed' : researchReclaimStatus === 'claiming' ? 'Reclaiming shards...' : 'Reclaim shards'}
                </span>
              </button>
            )}
            <div className={styles.messageTime}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {message.sender === 'blue' && message.debug && openDebugMessageId === message.id && (
              <div className={styles.debugPanel}>
                {formatDebugSummary(message.debug).map((line) => (
                  <div key={line} className={styles.debugLine}>{line}</div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className={`${styles.messageBubble} ${styles.blueMessage} ${styles.typingIndicator}`}>
            <div className={styles.messageContent}>
              <div className={styles.typingDots}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
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

        <div ref={messagesEndRef} />
      </div>

      {/* Credit Builder Inline Form */}
      {creditStep !== 'hidden' && (
        <CreditBuilderInline
          step={creditStep as 'intake' | 'payment' | 'processing' | 'done'}
          onComplete={handleCreditIntakeComplete}
          onRequestPayment={handleCreditPayment}
        />
      )}

      {timeManagementVisible && (
        <TimeManagementInline
          onTimerStarted={(taskTitle, durationMinutes) => {
            showEmote('happy', 5000);
            addBlueMessage(`timer's live. ${taskTitle} for ${durationMinutes} minutes.`);
          }}
          onNextTask={(taskTitle, durationMinutes) => {
            showEmote('surprised', 4500);
            addBlueMessage(`next up: ${taskTitle}. ${durationMinutes} minutes. go.`);
          }}
          onSessionComplete={() => {
            showEmote('joyful', 5000);
            addBlueMessage("clean run. you're done.");
          }}
        />
      )}

      {/* Research Source Cards */}
      {researchSources && researchSources.length > 0 && (
        <ResearchCards
          sources={researchSources}
          payTo={researchPayTo}
          topic={researchTopic}
          onComplete={(synthesis) => {
            setResearchSources(null);
            showEmote('default');
            addBlueMessage(synthesis);
          }}
          onError={(msg) => {
            setResearchSources(null);
            addBlueMessage(msg);
          }}
        />
      )}

      {/* Research Suggestions — shown when bazaar returns no paid sources */}
      {researchSuggestions && researchSuggestions.length > 0 && (
        <div className={styles.researchCards}>
          <span className={styles.researchLabel}>foundational works — click to synthesize</span>
          <div className={styles.researchGrid}>
            {researchSuggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className={styles.researchCard}
                onClick={() => handleSuggestionClick(s)}
                disabled={isTyping}
              >
                <span className={styles.researchCardTitle}>{s.title}</span>
                <span className={styles.researchCardDesc}>
                  {s.author}{s.year ? ` · ${s.year}` : ''} — {s.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GPU Research Picker */}
      {gpuPickerStep === 'gate' && (
        <div className={styles.gpuPicker}>
          <span className={styles.gpuPickerTitle}>GPU Research</span>
          <p className={styles.gpuPickerDesc}>
            Borrow dedicated GPU compute from the Nosana network. A powerful open-source model will synthesize a graduate-level report on your topic.
          </p>
          <div className={styles.gpuPickerButtons}>
            <button className={styles.gpuPickerProceed} onClick={() => setGpuPickerStep('topic')} type="button">
              Continue
            </button>
            <button className={styles.gpuPickerCancel} onClick={() => setGpuPickerStep(null)} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
      {gpuPickerStep === 'topic' && (
        <div className={styles.gpuPicker}>
          <span className={styles.gpuPickerTitle}>What do you want to research?</span>
          <input
            className={styles.input}
            type="text"
            placeholder="e.g. cognitive behavioral therapy and neuroplasticity"
            value={gpuTopicDraft}
            onChange={(e) => setGpuTopicDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && gpuTopicDraft.trim()) setGpuPickerStep('select');
            }}
            autoFocus
            style={{ marginBottom: 8 }}
          />
          <div className={styles.gpuPickerButtons}>
            <button
              className={styles.gpuPickerProceed}
              onClick={() => { if (gpuTopicDraft.trim()) setGpuPickerStep('select'); }}
              disabled={!gpuTopicDraft.trim()}
              type="button"
            >
              Choose Compute Tier
            </button>
            <button className={styles.gpuPickerCancel} onClick={() => setGpuPickerStep(null)} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
      {gpuPickerStep === 'select' && (
        <div className={styles.gpuPicker}>
          <span className={styles.gpuPickerTitle}>Select Compute Tier</span>
          <div className={styles.gpuTierGrid}>
            {(Object.keys(GPU_TIER_INFO) as GpuTier[]).map((tier) => {
              const t = GPU_TIER_INFO[tier];
              const hasShards = shardCount !== null && shardCount >= t.shards;
              return (
                <button
                  key={tier}
                  className={`${styles.gpuTierCard} ${styles[t.cardClass as keyof typeof styles]}`}
                  onClick={() => startGpuResearch(tier, gpuTopicDraft.trim())}
                  disabled={!hasShards || isTyping}
                  type="button"
                >
                  <span className={`${styles.gpuTierBadge} ${styles[t.badgeClass as keyof typeof styles]}`}>{t.badge}</span>
                  <span className={styles.gpuTierLabel}>{t.label}</span>
                  <span className={styles.gpuTierModel}>{t.model}</span>
                  <span className={styles.gpuTierGpu}>{t.gpu}</span>
                  <span className={styles.gpuTierDesc}>{t.desc}</span>
                  <span className={styles.gpuTierShards}>{t.shards.toLocaleString()} shards{!hasShards ? ' (need more)' : ''}</span>
                </button>
              );
            })}
          </div>
          <button className={styles.gpuPickerCancel} onClick={() => setGpuPickerStep('topic')} type="button" style={{ marginTop: 4 }}>
            Back
          </button>
        </div>
      )}

      {/* Shard Confirmation */}
      {pendingMessage && pendingType === 'research' && (
        <div className={styles.shardConfirm}>
          <div className={styles.shardConfirmText}>
            Activate research mode?
            <span className={styles.shardConfirmBalance}>{shardCount} shards available</span>
          </div>
          <div className={styles.shardConfirmButtons}>
            <button className={styles.shardConfirmYes} onClick={confirmShardSpend} type="button">
              {`Spend ${RESEARCH_COST.toLocaleString()} Shards`}
            </button>
            <button className={styles.shardConfirmNo} onClick={cancelShardSpend} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}

      {shardUpsell && (
        <div className={styles.shardUpsell} role="dialog" aria-modal="true" aria-label={shardUpsellTitle}>
          <div className={styles.shardUpsellIconWrap} aria-hidden="true">
            <Image src="/icons/ui-shard.svg" alt="" width={24} height={24} />
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
            <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} />
            <span>{shardCount}</span>
          </div>
        )}
        <button className={styles.quickAction} onClick={() => handleQuickAction('what-is-this')} disabled={isTyping} type="button">
          What is this place?
        </button>
        <button className={styles.quickAction} onClick={() => handleQuickAction('level-up')} disabled={isTyping} type="button">
          How do I level up?
        </button>
        <button className={styles.quickAction} onClick={() => handleQuickAction('bci-lore')} disabled={isTyping} type="button">
          What&apos;s the helmet?
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
                  src="/images/blue-fullbody.png"
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
                  <button className={`${styles.expandedQuickCard} ${styles.expandedQuickAccent}`} onClick={() => { play('click'); handleQuickAction('funding'); }} onMouseEnter={() => play('hover')} disabled={isTyping} type="button">
                    <span className={styles.toolCardTop}>
                      <span className={styles.toolCardText}>
                        <span className={styles.toolSlideWrap}>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText}`}>Funding</span>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText} ${styles.toolSlideClone}`}>Funding</span>
                        </span>
                        <span className={styles.toolCardMeta}>Map a study, paper, or dataset to treasury pools, prediction-backed funding, and live grants.</span>
                      </span>
                      <span className={styles.toolCardIcon} aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 14.5v1.25h-1.5V16.5a3.5 3.5 0 0 1-3-2.43l1.43-.58a2 2 0 0 0 3.95-.34c0-1.13-1.04-1.55-2.5-2.07S8.5 9.95 8.5 8.43A2.95 2.95 0 0 1 11.25 5.6V4.25h1.5v1.32a3.06 3.06 0 0 1 2.66 1.99l-1.39.6a1.62 1.62 0 0 0-3.27.27c0 .9.92 1.28 2.36 1.79s3.39 1.23 3.39 3.18a3.13 3.13 0 0 1-2.75 3.1Z"/></svg>
                      </span>
                    </span>
                    <span className={styles.toolCardBottom} aria-hidden="true" />
                  </button>
                  <button className={styles.expandedQuickCard} onClick={() => { play('click'); handleQuickAction('earning'); }} onMouseEnter={() => play('hover')} disabled={isTyping} type="button">
                    <span className={styles.toolCardTop}>
                      <span className={styles.toolCardText}>
                        <span className={styles.toolSlideWrap}>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText}`}>Earning</span>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText} ${styles.toolSlideClone}`}>Earning</span>
                        </span>
                        <span className={styles.toolCardMeta}>Turn papers, datasets, and methodology into x402 revenue, paid syntheses, and shards.</span>
                      </span>
                      <span className={styles.toolCardIcon} aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2l3-8 3 13 3-9 2 4h5v2h-6l-1-2-3 8-3-12-2 6H3z"/></svg>
                      </span>
                    </span>
                    <span className={styles.toolCardBottom} aria-hidden="true" />
                  </button>
                  <button className={styles.expandedQuickCard} onClick={() => { play('click'); handleQuickAction('experiments'); }} onMouseEnter={() => play('hover')} disabled={isTyping} type="button">
                    <span className={styles.toolCardTop}>
                      <span className={styles.toolCardText}>
                        <span className={styles.toolSlideWrap}>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText}`}>Experiments</span>
                          <span className={`${styles.toolCardTitle} ${styles.toolSlideText} ${styles.toolSlideClone}`}>Experiments</span>
                        </span>
                        <span className={styles.toolCardMeta}>Scope a hypothesis, lock variables, pick a design, and route it to surveys or quests.</span>
                      </span>
                      <span className={styles.toolCardIcon} aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2v6L3.5 17.5A2 2 0 0 0 5.24 20.5h13.52A2 2 0 0 0 20.5 17.5L15 8V2Zm2 2h2v4.5l3.94 6.5H7.06L11 8.5ZM9.6 15h4.8l1.21 2H8.4Z"/></svg>
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
        <div className={styles.compactControls}>
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

        {chatContent}
      </div>
    </>
  );
};

export default BlueChat;
