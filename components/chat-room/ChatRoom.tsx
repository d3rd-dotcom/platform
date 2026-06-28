'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getSupabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import styles from './ChatRoom.module.css';

interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  message: string;
  type: 'user' | 'system';
  createdAt: string;
}

function avatarColor(name: string): string {
  const colors = ['#5168FF', '#E85D3A', '#62BE8F', '#9B7ED9', '#F5A623'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function highlightMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className={styles.mention}>{part}</span>
    ) : (
      part
    )
  );
}

export default function ChatRoom() {
  const { getAccessToken } = usePrivy();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const oldestIdRef = useRef<number | null>(null);
  const newestIdRef = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const subRef = useRef<RealtimeChannel>();

  // ── Fetch new messages after a given id ──
  const fetchAfter = useCallback(async (afterId: number) => {
    try {
      const res = await fetch(`/api/chat/messages?after=${afterId}`, { cache: 'no-store' });
      if (!res.ok) return 0;
      const data = await res.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const newOnes = data.messages.filter((m: ChatMessage) => !existing.has(m.id));
          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes];
        });
      }
      return data.messages?.length ?? 0;
    } catch {
      return 0;
    }
  }, []);

  // ── Load older messages (infinite scroll) ──
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !oldestIdRef.current) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/chat/messages?before=${oldestIdRef.current}&limit=30`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => [...data.messages, ...prev]);
        oldestIdRef.current = data.messages[0].id;
        setHasMore(data.hasMore ?? false);
      } else {
        setHasMore(false);
      }
    } catch {
      // best-effort
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder]);

  // ── Initial load ──
  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/messages', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
        if (data.messages.length > 0) {
          oldestIdRef.current = data.messages[0].id;
          newestIdRef.current = data.messages[data.messages.length - 1].id;
        }
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // best-effort
    }
  }, []);

  // ── Auto-scroll to bottom when new messages arrive ──
  useEffect(() => {
    if (autoScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Detect manual scroll-up (user reading history) ──
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;

    if (scrollTop < 60 && hasMore && !loadingOlder) {
      loadOlder();
    }
  }, [hasMore, loadingOlder, loadOlder]);

  // ── IntersectionObserver for sentinel (more robust infinite scroll) ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingOlder) {
          loadOlder();
        }
      },
      { root: listRef.current, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, loadOlder]);

  // ── Supabase Realtime subscription ──
  useEffect(() => {
    loadInitial();

    const supabase = getSupabase();
    if (supabase) {
      const channel = supabase
        .channel('chat-messages')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          (payload) => {
            const msg = payload.new as Record<string, unknown>;
            const mapped: ChatMessage = {
              id: msg.id as number,
              userId: msg.user_id as string,
              username: msg.username as string,
              avatarUrl: (msg.avatar_url as string) ?? null,
              message: msg.message as string,
              type: (msg.type as 'user' | 'system') ?? 'user',
              createdAt: msg.created_at as string,
            };
            setMessages((prev) => {
              if (prev.some((m) => m.id === mapped.id)) return prev;
              return [...prev, mapped];
            });
          }
        )
        .subscribe();

      subRef.current = channel;

      return () => {
        channel.unsubscribe();
      };
    }

    // Fallback: poll with ?after=
    const interval = setInterval(async () => {
      if (newestIdRef.current != null) {
        await fetchAfter(newestIdRef.current);
      } else {
        await loadInitial();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [loadInitial, fetchAfter]);

  // ── Listen for manual refresh events ──
  useEffect(() => {
    const handler = () => {
      if (newestIdRef.current != null) {
        fetchAfter(newestIdRef.current);
      } else {
        loadInitial();
      }
    };
    window.addEventListener('globalChatUpdate', handler);
    return () => window.removeEventListener('globalChatUpdate', handler);
  }, [fetchAfter, loadInitial]);

  // ── Update newestIdRef when messages grow ──
  useEffect(() => {
    if (messages.length > 0) {
      newestIdRef.current = messages[messages.length - 1].id;
    }
  }, [messages]);

  // ── Fetch unread notification count ──
  const fetchUnread = useCallback(async () => {
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications', {
        cache: 'no-store',
        headers,
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // best-effort
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // ── Mark notifications read when focusing input ──
  const markRead = useCallback(async () => {
    if (unreadCount === 0) return;
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
    } catch {
      // best-effort
    }
  }, [unreadCount, getAccessToken]);

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        setInput('');
        autoScrollRef.current = true;
      }
    } catch {
      // best-effort
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, getAccessToken]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={styles.chatRoom}>
      <div className={styles.chatHeader}>
          <span className={styles.chatTitle}><span className={styles.chatTitleJa}>連携</span> Global Chat</span>
        {unreadCount > 0 && (
          <span className={styles.unreadBadge}>{unreadCount}</span>
        )}
      </div>

      <div className={styles.chatList} ref={listRef} onScroll={handleScroll}>
        <div ref={sentinelRef} className={styles.sentinel} />
        {loadingOlder && <p className={styles.loadingOlder}>Loading older messages...</p>}

        {messages.length === 0 ? (
          <p className={styles.chatEmpty}>No messages yet. Start the conversation.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.chatMessage} ${msg.type === 'system' ? styles.chatSystem : ''}`}
            >
              {msg.type === 'system' ? (
                <p className={styles.systemText}>{msg.message}</p>
              ) : (
                <>
                  <span
                    className={styles.msgAvatar}
                    style={
                      msg.avatarUrl
                        ? { backgroundImage: `url(${msg.avatarUrl})`, backgroundSize: 'cover' }
                        : { background: avatarColor(msg.username) }
                    }
                    aria-hidden="true"
                  >
                    {!msg.avatarUrl && msg.username.charAt(0).toUpperCase()}
                  </span>
                  <div className={styles.msgBody}>
                    <div className={styles.msgMeta}>
                      <span className={styles.msgUsername}>{msg.username}</span>
                      <span className={styles.msgTime}>{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className={styles.msgText}>{highlightMentions(msg.message)}</p>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className={styles.chatInputWrap}>
        <input
          ref={inputRef}
          className={styles.chatInput}
          type="text"
          placeholder="Message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={markRead}
          maxLength={500}
          disabled={sending}
        />
        <button
          type="button"
          className={styles.chatSend}
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
