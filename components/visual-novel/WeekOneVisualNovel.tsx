'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { ConfettiCelebration } from '@/components/quests/ConfettiCelebration';
import { DiamondReward } from '@/components/rewards/DiamondReward';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './WeekOneVisualNovel.module.css';

const NARRATION_PREF_KEY = 'weekOneVN.narrationEnabled';

const CHECK_IN_QUESTIONS = [
  'How many days did you do your field notes?',
  'Did you take your artist date? What did you do, and how did it feel?',
  'Were there any other significant moments this week?',
];

interface WeekOneVisualNovelProps {
  isOpen: boolean;
  onClose: () => void;
  weekNumber?: number;
  weekTitle?: string;
}

interface Scene {
  id: string;
  body?: string;
  image: string;
  audio?: string;
}

const WEEK_ONE_TYPING_DELAY_MS = 34;
const WEEK_ONE_CHECKIN_QUEST_ID = 'week-1-story-checkin';
const WEEK_ONE_CHECKIN_REWARD = 50;

const WEEK_ONE_SCENES: Scene[] = [
  {
    id: 'creative-recovery',
    body: 'This is your creative recovery, you may feel excited, giddy and defiant, hopeful, skeptical. But the readings, tasks, and exercises aim at allowing you to establish a sense of safety, which will enable you to explore your creativity with less fear.',
    image: '/stories/week-01/creative-recovery-butterflies.png',
    audio: '/audio/stories/week-01/01-creative-recovery.mp3',
  },
  {
    id: 'encouragement',
    body: 'We want to be acknowledged for our attempts, efforts, as well as achievements. Unfortunately, many don’t receive this encouragement.\n\nParents offer cautionary advice instead of support. Timidly, we add parental fears to our own, often giving up our dreams and settling into a world of regrets.',
    image: '/stories/week-01/creative-recovery-butterflies.png',
    audio: '/audio/stories/week-01/02-encouragement.mp3',
  },
  {
    id: 'shades-of-blue',
    body: 'There are many shades of Blue. Each one steered by God. The branches, roots, and seeds of divine creation flow throughout the Earth.',
    image: '/stories/week-01/shades-of-blue-lab.png',
    audio: '/audio/stories/week-01/03-shades-of-blue.mp3',
  },
  {
    id: 'ethereal-horizon',
    body: 'But sadly... many shades remain trapped, on the edge of reality, yet their true potential sleeps, lost to the fear of failure... is how shadows are born.',
    image: '/stories/week-01/trapped-shade-chamber.png',
    audio: '/audio/stories/week-01/04-ethereal-horizon.mp3',
  },
  {
    id: 'the-healer',
    body: 'Blue’s first world contained a therapist, a healer, who suppressed her creative urges for decades, pouring her all into others while abandoning her own “artist child” inside.',
    image: '/stories/week-01/healer-creative-reflection.png',
    audio: '/audio/stories/week-01/05-the-healer.mp3',
  },
  {
    id: 'jermaine',
    body: 'Jermain, who had a love for film-making, instead poured all his energy into his girlfriend\'s art career.',
    image: '/stories/week-01/jermain-sacrifice.png',
    audio: '/audio/stories/week-01/06-jermain.mp3',
  },
  {
    id: 'the-incubator',
    body: 'On the nearby desk an egg inside of an incubator shakes, it’s heartbeat inside stirred resonating with the energy around,',
    image: '/stories/week-01/7.png',
    audio: '/audio/stories/week-01/07-the-incubator.mp3',
  },
  {
    id: 'the-inner-child',
    body: '“how do we protect the inner child that lays dormant, buried under the weight of the world?” A Shade of Blue thought to herself on high effort while devouring documents in the library.',
    image: '/stories/week-01/blue-research-log.png',
    audio: '/audio/stories/week-01/08-the-inner-child.mp3',
  },
  {
    id: 'creative-abuse',
    body: 'A memory: Recovering shadows often begin self-sabotage or “creative abuse” by measuring fresh new work against masterworks or exposing it to premature criticism.',
    image: '/stories/week-01/9.png',
    audio: '/audio/stories/week-01/09-creative-abuse.mp3',
  },
  {
    id: 'go-gently',
    body: 'To recover, you must go gently and slowly. As Healing old wounds is the goal, progress is much better, and more realistic than perfection. Be willing to be a bad artist.',
    image: '/stories/week-01/10.png',
    audio: '/audio/stories/week-01/10-go-gently.mp3',
  },
  {
    id: 'affirmations',
    body: 'Affirmations are the greatest weapon. Positive statements of belief that help excavate the lost child. When you write “I am a brilliant creator.” you empower yourself.',
    image: '/stories/week-01/shadow-breaking-free.png',
    audio: '/audio/stories/week-01/11-affirmations.mp3',
  },
  {
    id: 'blurts',
    body: 'But you must listen to the blurts as well, identify where they come from. (a bad teacher or parent), and then convert them into positive affirmations to dissolve them.',
    image: '/stories/week-01/shadow-breaking-free.png',
    audio: '/audio/stories/week-01/12-blurts.mp3',
  },
];

const WEEK_ART_COUNTS: Record<number, number> = {
  2: 9, 3: 9, 4: 8, 5: 8, 6: 8, 7: 9, 8: 9, 9: 4, 10: 5, 11: 4, 12: 4,
};

// Each line is written to land with its still. The curriculum stays inside the
// story: Blue and her Shades encounter it rather than explaining it to the player.
const WEEK_STORIES: Record<number, string[]> = {
  2: [
    'Blue found a Shade at the Academy gate, holding a map with every route crossed out.',
    '“They called it erratic,” the Shade said. Blue kept the map open between them.',
    'A note appeared in the margin: not good enough. Blue folded that edge under.',
    'In the simulator, doubt had always arrived first. It wore familiar voices.',
    'Blue moved the field notes into a locked drawer. Some beginnings need privacy.',
    'Outside, a crowd asked the Shade to return to the old shape. The Shade did not answer.',
    'Blue marked one small room on the map. A desk. A lamp. An hour kept intact.',
    'The Shade drew a new boundary in blue pencil, then another.',
    'At the Ethereal Horizon, Blue kept the map. This time, it had a way forward.',
  ],
  3: [
    'The simulator registered a heat spike before Blue did. A Shade had been swallowing anger for years.',
    'Blue set a glass of water beside her. The surface shook, then settled.',
    'They followed the signal backward through old criticism and the rooms it had sealed.',
    'One accusation had no evidence. Blue tagged it as noise.',
    'The Shade named the thing that hurt. Its shadow lost some of its size.',
    'They tested a small action. The door opened without asking permission.',
    'Joy arrived too, sharp as static. Blue recorded that signal beside the grief.',
    'The Shade stood taller in the doorway. Nothing had been repaired for her.',
    'Blue watched her carry her own power toward the Ethereal Horizon.',
  ],
  4: [
    'Blue stopped reading for one night. The Academy was quiet enough to hear the pipes cool.',
    'A Shade brought her field notes, unopened. “I know what is in there,” she said.',
    'Blue placed the pages on the table. They held small hurts and one success nobody had counted.',
    'In the simulator, false versions of a life looked smoother from a distance.',
    'The Shade crossed out an old name and wrote the name she had been avoiding.',
    'A buried dream moved beneath the paper like a seed under glass.',
    'Blue waited while the Shade chose what could stay and what had to end.',
    'By morning, the notes were still untidy. They were also true. Blue kept them.',
  ],
  5: [
    'A bus passed the Academy with one empty seat. Blue saw a Shade let it go by.',
    '“Someone else may need it,” the Shade said. Blue looked at the empty street.',
    'They followed the old instructions: be realistic. stay useful. wait your turn.',
    'At the river, Blue put a coin in the Shade’s palm. It was warm from the machine room.',
    'The Shade spent an afternoon on the small thing she had postponed for years.',
    'Nothing collapsed. No alarm sounded.',
    'A letter arrived from a future she had never permitted herself to picture.',
    'Blue ran beside her as the next bus came. This time, the Shade stepped on.',
  ],
  6: [
    'The Academy ledger showed a deficit where a Shade had written her own name.',
    'Blue had seen this accounting in the simulator: every desire entered as a debt.',
    'They counted what the Shade had already made with almost nothing. The list became long.',
    'At the market, she touched the good paper and did not apologize for wanting it.',
    'Blue opened the old money story. Its numbers had been copied from frightened hands.',
    'The Shade changed one line. enough was no longer somewhere else.',
    'She bought the small necessary thing and carried it home carefully.',
    'Blue added the receipt to the ledger. Permission had a record now.',
  ],
  7: [
    'A Shade kept redrawing one corner of a picture until the paper tore.',
    'Blue took the pencil away and set a rough first page beside it.',
    'They listened in the workshop while other Shades made imperfect things together.',
    'One failed note became a melody when someone else answered it.',
    'Jealousy visited the room. Blue asked it where it wanted to go.',
    'The answer was a door the Shade had been afraid to touch.',
    'She made a bad first attempt. The room stayed with her.',
    'Blue passed the work around without grading it. Hands returned it warmer.',
    'Beyond the Academy windows, the Ethereal Horizon made room for every unfinished song.',
  ],
  8: [
    'The clock in the simulator had been set to too late. Blue knew that setting.',
    'A Shade carried an old teacher’s voice like a stone in her pocket.',
    'Blue asked her to put it down. The floor held.',
    'They chose the next small thing before the large question could speak.',
    'The Shade began badly, then began again. Her hands learned the hour was still hers.',
    'Blue logged the work, not the age of the person doing it.',
    'At dusk, the Shade left one mark on the page and kept walking.',
    'The clock moved forward. So did she.',
    'Blue filed the day under strength and turned toward the Ethereal Horizon.',
  ],
  9: [
    'A Shade called herself lazy and would not enter the studio.',
    'Blue found fear sitting beside the door, very small and very busy.',
    'They made room for it, then made one mark anyway.',
    'When the Shade turned back toward the work, Blue left the light on.',
  ],
  10: [
    'Blue found the studio full of borrowed noise: deadlines, messages, comparisons, hunger.',
    'A Shade named the one habit she used when the work began to matter.',
    'They made a short list of what could no longer cross the threshold.',
    'During the dry week, Blue kept the field notes open beside an empty cup.',
    'The Shade returned for ten minutes. The work had been waiting, not judging.',
  ],
  11: [
    'Blue built a small desk at the edge of the Academy, where the light changed slowly.',
    'A Shade filled it with stones, paper, a candle, and one letter to herself.',
    'She moved until the thoughts in her head became footsteps.',
    'When she returned, Blue found her making the next thing without asking the room.',
  ],
  12: [
    'Blue placed the Shade’s fears in a jar and set it beside the first page.',
    'They could not see the whole road. The next action was visible.',
    'A message from an old doubt arrived. Blue left it unopened.',
    'The Shade carried her tools past the Academy gate. The Ethereal Horizon was still there.',
  ],
};

function getScenesForWeek(weekNumber: number): Scene[] {
  if (weekNumber === 1) return WEEK_ONE_SCENES;

  const count = WEEK_ART_COUNTS[weekNumber] ?? 0;
  const weekPath = String(weekNumber).padStart(2, '0');
  return Array.from({ length: count }, (_, index) => ({
    id: `week-${weekPath}-${index + 1}`,
    image: `/stories/week-${weekPath}/${String(index + 1).padStart(2, '0')}.png`,
    body: WEEK_STORIES[weekNumber]?.[index],
  }));
}

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait' | 'any' | 'natural' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
};

export default function WeekOneVisualNovel({
  isOpen,
  onClose,
  weekNumber = 1,
  weekTitle = 'Creative Healing',
}: WeekOneVisualNovelProps) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claimed' | 'already-claimed' | 'error'>('idle');
  const [showRewardAnimation, setShowRewardAnimation] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const spokenSceneRef = useRef<string | null>(null);
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const narrationEnabledRef = useRef(false);
  const scenes = useMemo(() => getScenesForWeek(weekNumber), [weekNumber]);
  const hasCheckIn = weekNumber === 1;

  useEffect(() => {
    const stored = getStorageItem(NARRATION_PREF_KEY);
    if (stored === '1') {
      setNarrationEnabled(true);
      narrationEnabledRef.current = true;
    }
  }, []);

  const toggleNarration = () => {
    setNarrationEnabled((prev) => {
      const next = !prev;
      narrationEnabledRef.current = next;
      setStorageItem(NARRATION_PREF_KEY, next ? '1' : '0');
      if (!next) {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
        spokenSceneRef.current = null;
      } else {
        // Turning on mid-scene: clear spokenScene so the effect loads & plays.
        spokenSceneRef.current = null;
      }
      return next;
    });
  };

  // Letter-by-letter animation
  useEffect(() => {
    if (!shouldRender || showCheckIn) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }

    const fullText = scenes[sceneIndex]?.body ?? '';
    setDisplayedText('');
    setIsTyping(true);
    spokenSceneRef.current = null;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;

    let i = 0;
    intervalRef.current = setInterval(() => {
      i += 1;
      setDisplayedText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(intervalRef.current!);
        setIsTyping(false);
      }
    }, WEEK_ONE_TYPING_DELAY_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sceneIndex, scenes, shouldRender, showCheckIn]);

  // Load current scene audio as soon as scene changes (during typing).
  // Also preload the next scene's audio so it's ready when the user advances.
  useEffect(() => {
    if (!shouldRender || showCheckIn) return;
    if (!narrationEnabledRef.current) return;

    const currentScene = scenes[sceneIndex];
    if (!currentScene?.audio || spokenSceneRef.current === currentScene.id) return;

    spokenSceneRef.current = currentScene.id;

    const el = audioRef.current ?? new Audio();
    audioRef.current = el;
    el.volume = 0.4;
    el.preload = 'auto';
    el.src = currentScene.audio;
    el.currentTime = 0;
    // Audio loads in the background. Playback triggers when typing completes.

    // Preload next scene audio
    const nextIndex = sceneIndex + 1;
    if (nextIndex < scenes.length && scenes[nextIndex].audio) {
      const nextEl = preloadAudioRef.current ?? new Audio();
      preloadAudioRef.current = nextEl;
      nextEl.preload = 'auto';
      nextEl.src = scenes[nextIndex].audio!;
    }
  }, [sceneIndex, scenes, shouldRender, showCheckIn, narrationEnabled]);

  // Play narration once the typewriter animation finishes.
  useEffect(() => {
    if (!shouldRender || isTyping || showCheckIn) return;
    if (!narrationEnabledRef.current) return;

    const el = audioRef.current;
    if (!el || !el.src) return;

    void el.play().catch(() => {});
  }, [sceneIndex, shouldRender, isTyping, showCheckIn, narrationEnabled]);

  // Orientation detection + landscape lock
  useEffect(() => {
    if (!isOpen) return;

    const syncOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    const lockLandscape = async () => {
      try {
        const orientation = typeof screen !== 'undefined' && 'orientation' in screen
          ? (screen.orientation as ScreenOrientationWithLock)
          : null;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape');
        }
      } catch {
        // Rejected outside fullscreen/PWA — portrait overlay handles this case
      }
    };

    syncOrientation();
    lockLandscape();
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);

    return () => {
      window.removeEventListener('resize', syncOrientation);
      window.removeEventListener('orientationchange', syncOrientation);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      preloadAudioRef.current?.pause();
      if (preloadAudioRef.current) {
        preloadAudioRef.current.removeAttribute('src');
        preloadAudioRef.current.load();
      }
    };
  }, []);

  // Keyboard nav + open/close lifecycle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (showCheckIn) return;
      if (e.key === 'ArrowRight' && sceneIndex < scenes.length - 1) setSceneIndex((c) => c + 1);
      if (e.key === 'ArrowRight' && sceneIndex === scenes.length - 1) {
        if (hasCheckIn) setShowCheckIn(true);
        else onClose();
      }
      if (e.key === 'ArrowLeft' && sceneIndex > 0) setSceneIndex((c) => c - 1);
    };

    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      preloadAudioRef.current?.pause();
      if (preloadAudioRef.current) preloadAudioRef.current.currentTime = 0;
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setSceneIndex(0);
        setShowCheckIn(false);
        setDisplayedText('');
        setClaimStatus('idle');
        setShowRewardAnimation(false);
      }, 250);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasCheckIn, isOpen, onClose, sceneIndex, scenes.length, showCheckIn]);

  if (!shouldRender) return null;

  const scene = scenes[sceneIndex];
  const isLast = sceneIndex === scenes.length - 1;

  const goNext = () => {
    if (isTyping) {
      // Skip animation on tap if still typing
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayedText(scene.body ?? '');
      setIsTyping(false);
    } else if (!isLast) {
      spokenSceneRef.current = null;
      setSceneIndex((c) => c + 1);
    } else {
      spokenSceneRef.current = null;
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      if (hasCheckIn) setShowCheckIn(true);
      else onClose();
    }
  };

  const goPrev = () => {
    if (showCheckIn) {
      setShowCheckIn(false);
      return;
    }
    if (sceneIndex > 0) {
      spokenSceneRef.current = null;
      setSceneIndex((c) => c - 1);
    }
  };

  const claimCheckInReward = async () => {
    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }

    setIsClaiming(true);
    setClaimStatus('idle');
    try {
      const token = await getAccessToken();
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch('/api/quests/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          questId: WEEK_ONE_CHECKIN_QUEST_ID,
          shards: WEEK_ONE_CHECKIN_REWARD,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.ok) {
        setClaimStatus('claimed');
        setShowRewardAnimation(true);
        window.dispatchEvent(new Event('shardsUpdated'));
        return;
      }

      if (response.status === 409) {
        setClaimStatus('already-claimed');
        return;
      }

      setClaimStatus('error');
    } catch {
      setClaimStatus('error');
    } finally {
      setIsClaiming(false);
    }
  };

  const claimButtonLabel = !ready
    ? 'Loading...'
    : !authenticated
      ? 'Sign in to claim 50 diamonds'
      : isClaiming
        ? 'Claiming...'
        : claimStatus === 'claimed'
          ? '50 diamonds awarded'
          : claimStatus === 'already-claimed'
            ? 'Already completed'
            : 'Complete check-in (+50 credits)';

  return (
    <>
      <div
        className={`${styles.backdrop} ${isAnimating ? styles.backdropVisible : ''}`}
        onClick={onClose}
      />

      <div className={`${styles.modal} ${isAnimating ? styles.modalOpen : ''} ${showCheckIn ? styles.modalCheckIn : ''}`}>
        {/* Close — mounted on the bezel */}
        <button
          type="button"
          className={`${styles.closeButton} ${showCheckIn ? styles.closeButtonCheckIn : ''}`}
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Narration toggle — opt-in, off by default, also mounted on the bezel */}
        {!showCheckIn && weekNumber === 1 && (
          <button
            type="button"
            className={`${styles.audioButton} ${narrationEnabled ? styles.audioButtonOn : ''}`}
            onClick={toggleNarration}
            aria-pressed={narrationEnabled}
            aria-label={narrationEnabled ? 'Turn off narration' : 'Turn on narration'}
            title={narrationEnabled ? 'Narration on' : 'Narration off — tap to enable'}
          >
            {narrationEnabled ? (
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
        )}

        {!showCheckIn && (
          <div className={styles.screen}>
            {/* Background image */}
            <Image
              key={scene.image}
              src={scene.image}
              alt={`${weekTitle}, scene ${sceneIndex + 1}`}
              fill
              priority
              className={styles.bgImage}
              sizes="(min-width: 900px) min(1120px, calc(100vw - 96px)), 100vw"
            />

            {/* Shading gradients */}
            <div className={styles.shade} />

            {/* Story text overlay — top-left, well inset */}
            <div className={styles.overlay}>
              <p className={styles.body}>
                {displayedText}
                {isTyping && <span className={styles.cursor}>|</span>}
              </p>
            </div>

            {/* Invisible tap zones for prev / next */}
            <button type="button" className={styles.tapPrev} onClick={goPrev} aria-label="Previous scene" disabled={sceneIndex === 0} />
            <button type="button" className={styles.tapNext} onClick={goNext} aria-label="Next scene" />

            {/* Bottom bar: dots only */}
            <div className={styles.bottomBar}>
              <div className={styles.dots} role="tablist">
                {scenes.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={i === sceneIndex}
                    aria-label={`Scene ${i + 1}`}
                    className={`${styles.dot} ${i === sceneIndex ? styles.dotActive : ''}`}
                    onClick={() => setSceneIndex(i)}
                  />
                ))}
              </div>
            </div>

            {/* Portrait hard-block overlay */}
            {isPortrait && (
              <div className={styles.portraitOverlay}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className={styles.rotateIcon}>
                  <path d="M4 9V5a1 1 0 0 1 1-1h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20 15v4a1 1 0 0 1-1 1h-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20 8a8 8 0 0 0-13.66-5.66L4 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 16a8 8 0 0 0 13.66 5.66L20 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className={styles.portraitText}>Rotate your phone to continue.</p>
              </div>
            )}
          </div>
        )}

        {showCheckIn && (
          <div className={styles.checkInScreen}>
            <div className={styles.checkInCard}>
              <div className={styles.checkInHeader}>
                <div className={styles.checkInAvatar}>
                  <Image src="/images/blue-portrait.png" alt="Blue" width={56} height={56} unoptimized />
                </div>
                <div className={styles.checkInHeading}>
                  <span className={styles.checkInEyebrow}>Week {weekNumber} · Check-in</span>
                  <h2 className={styles.checkInTitle}>You made it to the end of the week.</h2>
                </div>
              </div>

              <p className={styles.checkInIntro}>
                Take a moment with your journal and answer these by hand before claiming your reward.
              </p>

              <ol className={styles.checkInList}>
                {CHECK_IN_QUESTIONS.map((q, i) => (
                  <li key={i} className={styles.checkInItem}>
                    <span className={styles.checkInNumber}>{i + 1}</span>
                    <span className={styles.checkInQuestion}>{q}</span>
                  </li>
                ))}
              </ol>

              <button
                type="button"
                className={styles.completeButton}
                onClick={claimCheckInReward}
                disabled={!ready || isClaiming || claimStatus === 'claimed' || claimStatus === 'already-claimed'}
              >
                {claimButtonLabel}
              </button>

              {claimStatus === 'error' && (
                <p className={styles.claimMessage}>The reward did not post. Try again in a moment.</p>
              )}
              {claimStatus === 'already-claimed' && (
                <p className={styles.claimMessage}>This check-in has already been completed.</p>
              )}

              <button type="button" className={styles.backLink} onClick={goPrev}>
                Back to story
              </button>
            </div>
          </div>
        )}

        {showRewardAnimation && (
          <>
            <ConfettiCelebration trigger={true} />
            <DiamondReward
              amount={WEEK_ONE_CHECKIN_REWARD}
              onComplete={() => setShowRewardAnimation(false)}
            />
          </>
        )}
      </div>
    </>
  );
}
