'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePrivy } from '@privy-io/react-auth';
import BlueChatBubble from '@/components/blue-chat-bubble/BlueChatBubble';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import DailyNotes from '@/components/daily-notes/DailyNotes';
import { EVENTS, PATHWAY_EVENT_ID } from '@/lib/events';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import type { CourseData } from '@/lib/personal-course';
import styles from './Dashboard.module.css';

const ProMembershipModal = dynamic(
  () => import('../pro-membership-modal/ProMembershipModal'),
  { ssr: false },
);

const ConfettiCelebration = dynamic(
  () => import('@/components/quests/ConfettiCelebration').then((m) => m.ConfettiCelebration),
  { ssr: false },
);

// One-time flag so the hatch reveal only ever plays once per device.
const EXXIE_HATCH_SEEN_KEY = 'exxie-hatch-seen';

interface DashboardProps {
  course: CourseData;
  initialProgress?: Record<string, unknown>;
  initialIntake?: Record<string, string>;
  enableMorningPagesPersistence?: boolean;
}

interface LeaderUser {
  rank: number;
  username: string;
  avatarUrl: string | null;
  shards: number;
}

function avatarColor(name: string): string {
  const colors = ['#5168FF', '#E85D3A', '#62BE8F', '#9B7ED9', '#F5A623'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const HOME_BLUE_MESSAGE =
  'Mental Wealth Academy places power tools for self-actualization and individual enlightenment through the freely available course, earn credits to connect to live events with experts, and unlimited AI tools for VIP Members.';

// Exxie hatches from the egg once Week 2 is sealed. Short idle lines that drift
// up from him now and then, to make him feel alive. Keep them tiny, no emojis.
const EXXIE_BLURBS = [
  'you sealed week two. i woke up.',
  'keep going. i want to see what we become.',
  'i remember every quest you finished.',
  'the work looks good on you.',
  'more. let us do more.',
  'i am yours now. do not stop.',
];

export default function Dashboard({ enableMorningPagesPersistence = false }: DashboardProps) {
  const { authenticated, user, login, getAccessToken } = usePrivy();
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [eggShaking, setEggShaking] = useState(false);
  // Which events the user is registered for (hydrated from the server on mount).
  const [reserved, setReserved] = useState<Record<string, boolean>>({});
  // eventId currently asking for an email, the typed value, and in-flight state.
  const [emailPromptFor, setEmailPromptFor] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [registerBusy, setRegisterBusy] = useState<Record<string, boolean>>({});
  const [registerError, setRegisterError] = useState<string | null>(null);
  // Which action-cards (e.g. Meet Blue) have fired their email this session.
  const [testSent, setTestSent] = useState<Record<string, boolean>>({});
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // Egg hatches into Exxie once Week 2 is sealed on the Pathway.
  const [exxieHatched, setExxieHatched] = useState(false);
  const [exxieBlurb, setExxieBlurb] = useState<string | null>(null);
  // First-time hatch celebration (egg cracks open into Exxie).
  const [showHatchReveal, setShowHatchReveal] = useState(false);

  const privyEmail = user?.email?.address ?? null;

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    try {
      const token = await getAccessToken();
      return token
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        : { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }, [getAccessToken]);

  // Hydrate the registered set so "Registered" survives reloads and follows the account.
  useEffect(() => {
    if (!authenticated) {
      setReserved({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/events/registrations', { headers: await authHeaders() });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !Array.isArray(data.eventIds)) return;
        setReserved(Object.fromEntries((data.eventIds as string[]).map((id) => [id, true])));
      } catch {
        /* best-effort hydration */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, authHeaders]);

  // POST the registration once we have an email (from Privy or the inline prompt).
  const submitRegistration = useCallback(
    async (eventId: string, email: string | null) => {
      setRegisterError(null);
      setRegisterBusy((b) => ({ ...b, [eventId]: true }));
      try {
        const res = await fetch('/api/events/registrations', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ eventId, email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRegisterError(data?.error || 'Could not register. Try again.');
          return;
        }
        setReserved((prev) => ({ ...prev, [eventId]: true }));
        setEmailPromptFor(null);
        setEmailDraft('');
      } catch {
        setRegisterError('Something interrupted that. Try again.');
      } finally {
        setRegisterBusy((b) => ({ ...b, [eventId]: false }));
      }
    },
    [authHeaders],
  );

  // Register click: prompt login if needed, register straight away when we know
  // the user's email, otherwise open the inline email prompt for that card.
  const handleRegister = useCallback(
    (eventId: string) => {
      if (!authenticated) {
        login();
        return;
      }
      if (privyEmail) {
        submitRegistration(eventId, privyEmail);
        return;
      }
      setRegisterError(null);
      setEmailDraft('');
      setEmailPromptFor(eventId);
    },
    [authenticated, privyEmail, login, submitRegistration],
  );

  const handleUnregister = useCallback(
    async (eventId: string) => {
      setReserved((prev) => ({ ...prev, [eventId]: false }));
      try {
        await fetch('/api/events/registrations', {
          method: 'DELETE',
          headers: await authHeaders(),
          body: JSON.stringify({ eventId }),
        });
      } catch {
        // Revert on failure so the UI matches the server.
        setReserved((prev) => ({ ...prev, [eventId]: true }));
      }
    },
    [authHeaders],
  );

  // Fire the instant "hello from Blue" email once we have an address.
  const submitEmailTest = useCallback(
    async (eventId: string, email: string) => {
      setRegisterError(null);
      setRegisterBusy((b) => ({ ...b, [eventId]: true }));
      try {
        const res = await fetch('/api/events/test-email', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRegisterError(data?.error || 'Could not send the email. Try again.');
          return;
        }
        setTestSent((s) => ({ ...s, [eventId]: true }));
        setEmailPromptFor(null);
        setEmailDraft('');
      } catch {
        setRegisterError('Something interrupted that. Try again.');
      } finally {
        setRegisterBusy((b) => ({ ...b, [eventId]: false }));
      }
    },
    [authHeaders],
  );

  // Meet Blue click: login if needed, send straight away when we know the email,
  // otherwise open the same inline email prompt the register flow uses.
  const handleEmailTest = useCallback(
    (eventId: string) => {
      if (!authenticated) {
        login();
        return;
      }
      if (privyEmail) {
        submitEmailTest(eventId, privyEmail);
        return;
      }
      setRegisterError(null);
      setEmailDraft('');
      setEmailPromptFor(eventId);
    },
    [authenticated, privyEmail, login, submitEmailTest],
  );

  useEffect(() => {
    if (!showLeaderboard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLeaderboard(false);
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [showLeaderboard]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setLeaderboard(Array.isArray(d.users) ? d.users : []))
      .catch(() => {/* leaderboard is best-effort */});
  }, []);

  // Has the user sealed Week 2? If so, the egg has hatched into Exxie.
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ethereal-progress/all', {
          cache: 'no-store',
          credentials: 'include',
          headers: await authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const week2 = Array.isArray(data.weeks)
          ? data.weeks.find((w: { weekNumber: number; isSealed: boolean }) => w.weekNumber === 2)
          : null;
        const hatched = Boolean(week2?.isSealed);
        if (cancelled) return;
        setExxieHatched(hatched);
        // First time we ever see the hatch, play the reveal once.
        if (hatched && getStorageItem(EXXIE_HATCH_SEEN_KEY) !== 'true') {
          setShowHatchReveal(true);
        }
      } catch {
        /* best-effort: stays an egg if we can't confirm */
      }
    })();
    return () => { cancelled = true; };
  }, [authenticated, authHeaders]);

  // Once hatched, Exxie murmurs the occasional idle line.
  useEffect(() => {
    if (!exxieHatched) return;
    let hideId: ReturnType<typeof setTimeout>;
    let nextId: ReturnType<typeof setTimeout>;
    const schedule = () => {
      nextId = setTimeout(() => {
        setExxieBlurb(EXXIE_BLURBS[Math.floor(Math.random() * EXXIE_BLURBS.length)]);
        hideId = setTimeout(() => setExxieBlurb(null), 4200);
        schedule();
      }, 7000 + Math.random() * 9000);
    };
    schedule();
    return () => { clearTimeout(nextId); clearTimeout(hideId); };
  }, [exxieHatched]);

  const dismissHatchReveal = useCallback(() => {
    setStorageItem(EXXIE_HATCH_SEEN_KEY, 'true');
    setShowHatchReveal(false);
  }, []);

  const pokeEgg = useCallback(() => {
    setEggShaking(true);
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const doonga = (start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, start);
      osc.frequency.exponentialRampToValueAtTime(68, start + 0.2);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    };
    const now = ctx.currentTime;
    doonga(now + 0.02);
    doonga(now + 0.34);
    window.setTimeout(() => ctx.close(), 900);
  }, []);

  return (
    <div className={styles.dashboard}>
      {/* ── Upcoming events ── */}
      <section className={styles.eventsSection}>
        {/* The 12-week course, as a looping Blue hero (replaces the old course card). */}
        <Link href="/courses" className={styles.courseVideoLink} aria-label="Open courses">
          <BlueVideoPanel
            eyebrow="Shadow Work · Season 1"
            message="A 12-week pathway through readings and missions. Complete each week to unlock the next — pick up where you left off."
            ariaLive="off"
          />
        </Link>
        <div className={styles.eventsHeader}>
          <span className={styles.cardLabel}>Upcoming events</span>
          <p className={styles.eventsHint}>
            Live sessions, circles, and gatherings — register or reserve a seat.
          </p>
        </div>
        <div className={styles.eventsGrid}>
          {EVENTS.filter((ev) => ev.id !== PATHWAY_EVENT_ID).map((ev) => (
            <article key={ev.id} className={styles.eventCard}>
              <div className={styles.eventImage} style={{ backgroundImage: ev.gradient }}>
                <span className={styles.eventNoise} aria-hidden="true" />
              </div>
              <div className={styles.eventBody}>
                <span className={styles.eventMeta}>
                  {ev.category} • {ev.dateLabel}
                </span>
                <h3 className={styles.eventTitle}>{ev.heading}</h3>
                <p className={styles.eventText}>{ev.description}</p>
                <div className={styles.eventFoot}>
                  <span className={styles.eventTime}>
                    {ev.timeLabel}
                  </span>
                  {ev.href ? (
                    <Link href={ev.href} className={styles.eventBtn}>
                      {ev.ctaLabel}
                    </Link>
                  ) : ev.action === 'email-test' ? (
                    <button
                      type="button"
                      className={`${styles.eventBtn}${testSent[ev.id] ? ` ${styles.eventBtnDone}` : ''}`}
                      onClick={() => handleEmailTest(ev.id)}
                      disabled={!!registerBusy[ev.id]}
                    >
                      {registerBusy[ev.id]
                        ? 'Sending…'
                        : testSent[ev.id]
                          ? 'Sent — check your inbox'
                          : ev.actionLabel || 'Email me'}
                    </button>
                  ) : reserved[ev.id] ? (
                    <button
                      type="button"
                      className={`${styles.eventBtn} ${styles.eventBtnDone}`}
                      onClick={() => handleUnregister(ev.id)}
                      title="Registered — we'll email you a reminder. Click to cancel."
                    >
                      Registered
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.eventBtn}
                      onClick={() => handleRegister(ev.id)}
                      disabled={!!registerBusy[ev.id]}
                    >
                      {registerBusy[ev.id] ? 'Saving…' : 'Register'}
                    </button>
                  )}
                </div>
                {emailPromptFor === ev.id && (
                  <form
                    className={styles.eventEmailPrompt}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (ev.action === 'email-test') {
                        submitEmailTest(ev.id, emailDraft.trim());
                      } else {
                        submitRegistration(ev.id, emailDraft.trim());
                      }
                    }}
                  >
                    <label className={styles.eventEmailLabel} htmlFor={`event-email-${ev.id}`}>
                      {ev.action === 'email-test'
                        ? 'Where should Blue say hello?'
                        : 'Where should we send your reminder?'}
                    </label>
                    <div className={styles.eventEmailRow}>
                      <input
                        id={`event-email-${ev.id}`}
                        type="email"
                        required
                        autoFocus
                        placeholder="you@email.com"
                        className={styles.eventEmailInput}
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                      />
                      <button
                        type="submit"
                        className={styles.eventBtn}
                        disabled={!!registerBusy[ev.id]}
                      >
                        {registerBusy[ev.id] ? 'Saving…' : 'Confirm'}
                      </button>
                    </div>
                    {registerError && <p className={styles.eventEmailError}>{registerError}</p>}
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
        <BlueChatBubble
          message={HOME_BLUE_MESSAGE}
          variant="featured"
        />
      </section>

      {/* ── Side: egg, morning note, leaderboard, membership ── */}
      <aside className={styles.sideStack}>
        <div className={styles.eventsHeader}>
          <span className={styles.cardLabel}>Your progress</span>
          <p className={styles.eventsHint}>
            Hatch your egg and see where you stand.
          </p>
        </div>

        <div className={styles.eggCard}>
          <button
            type="button"
            className={styles.eggMedia}
            onClick={pokeEgg}
            aria-label={exxieHatched ? 'Poke Exxie' : 'Poke your egg'}
          >
            {exxieHatched && exxieBlurb && (
              <span className={styles.exxieBubble} role="status">{exxieBlurb}</span>
            )}
            <Image
              src={exxieHatched ? '/exxie.png' : '/images/egg.png'}
              alt=""
              fill
              className={`${exxieHatched ? styles.exxieImg : styles.eggImg}${eggShaking ? ` ${styles.eggShake}` : ''}`}
              onAnimationEnd={() => setEggShaking(false)}
              priority
            />
          </button>
          <h2 className={styles.eggTitle}>{exxieHatched ? 'Exxie' : 'Your Egg'}</h2>
          <p className={styles.eggText}>
            {exxieHatched
              ? 'Your daemon hatched when you sealed Week 2. Keep going and Exxie grows with you.'
              : 'Earn credits from quests and check-ins. What will hatch?'}
          </p>
        </div>

        <div className={styles.morningPagesShell} data-tour="daily-note">
          <div className={styles.morningPagesGradient} aria-hidden="true" />
          <DailyNotes
            enablePersistence={enableMorningPagesPersistence}
            compact
          />
        </div>

        <button
          type="button"
          className={styles.leaderboardCard}
          onClick={() => setShowLeaderboard(true)}
        >
          <div className={styles.leaderHead}>
            <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} />
            <span className={styles.leaderTitle}>Leaderboard</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className={styles.leaderEmpty}>No rankings yet — be the first to show up.</p>
          ) : (
            <ul className={styles.leaderList}>
              {leaderboard.slice(0, 3).map((u) => (
                <li key={u.rank} className={styles.leaderRow}>
                  <span className={styles.leaderRank}>{u.rank}</span>
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatarUrl} alt={u.username} className={styles.leaderAvatar} />
                  ) : (
                    <span
                      className={styles.leaderAvatar}
                      style={{ background: avatarColor(u.username || '?') }}
                    >
                      {(u.username || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.leaderName}>{u.username}</span>
                  <span className={styles.leaderShards}>{u.shards}</span>
                </li>
              ))}
            </ul>
          )}
        </button>

        <button
          type="button"
          className={styles.vipCard}
          data-tour="vip"
          onClick={() => setIsProModalOpen(true)}
        >
          <div className={styles.vipHead}>
            <svg
              className={styles.vipIcon}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 3h14v2H5z" />
            </svg>
            <span className={styles.vipTitle}>VIP Membership</span>
          </div>
          <p className={styles.vipText}>
            One payment, lifetime access — unlock R-Tool, Simulations, and every tool we build.
          </p>
          <span className={styles.vipCta}>
            Go VIP
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3L11 8L6 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </aside>

      {isProModalOpen && (
        <ProMembershipModal isOpen={isProModalOpen} onClose={() => setIsProModalOpen(false)} />
      )}

      {showHatchReveal && (
        <div className={styles.hatchOverlay} onClick={dismissHatchReveal}>
          <ConfettiCelebration trigger={showHatchReveal} />
          <div className={styles.hatchCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.hatchMedia}>
              <Image src="/exxie.png" alt="Exxie" width={170} height={170} className={styles.hatchImg} priority />
            </div>
            <span className={styles.cardLabel}>Your egg hatched</span>
            <h2 className={styles.hatchTitle}>Meet Exxie</h2>
            <p className={styles.hatchText}>
              You sealed Week 2, and your daemon woke up. Exxie stays with you on the Pathway and
              grows as you seal more weeks. Look for him on your progress card.
            </p>
            <button type="button" className={styles.hatchBtn} onClick={dismissHatchReveal}>
              Say hello
            </button>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className={styles.leaderModalOverlay} onClick={() => setShowLeaderboard(false)}>
          <div className={styles.leaderModalCard} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.leaderModalClose}
              onClick={() => setShowLeaderboard(false)}
              aria-label="Close leaderboard"
            >
              &times;
            </button>
            <div className={styles.leaderModalHeader}>
              <Image src="/icons/ui-shard.svg" alt="" width={28} height={28} />
              <div>
                <strong className={styles.leaderModalTitle}>Leaderboard</strong>
                <span className={styles.leaderModalSub}>Top contributors</span>
              </div>
            </div>
            <div className={styles.leaderModalList}>
              {leaderboard.length === 0 ? (
                <p className={styles.leaderEmpty}>No rankings yet</p>
              ) : (
                leaderboard.map((u) => (
                  <div key={u.rank} className={styles.leagueRow}>
                    <span className={styles.leagueRank}>{u.rank}</span>
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt={u.username} className={styles.leagueAvatar} />
                    ) : (
                      <div
                        className={styles.leagueAvatar}
                        style={{ background: avatarColor(u.username || '?') }}
                      >
                        {(u.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={styles.leagueName}>{u.username}</span>
                    <span className={styles.leagueShards}>{u.shards} credits</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
