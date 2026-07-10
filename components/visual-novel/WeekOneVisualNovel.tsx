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
const WEEK_STORY_TYPING_DELAY_MS = 18;
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
    'Blue found a Shade at the Academy gate with a map of her life. Every route past the familiar district had been crossed out. “I have been changing,” she said, as if change were evidence against her.',
    'The Shade opened her field notes and read the first line twice. The second pass said the work was temporary, amateur, already late. Blue recognized the old simulator pattern: self-doubt arrives dressed as analysis.',
    'Blue left the voice on the page and wrote its claim in the margin. Then she asked for evidence. The page stayed quiet. Some thoughts borrow authority they have not earned.',
    'At the workshop door, another Shade asked to see the notes. Blue closed the book gently. Early work needs a protected room before it can survive an audience.',
    'Outside, the loudest people wanted her back in the role they understood. They called her different, then selfish, then unrealistic. Blue watched the Shade feel the pull of each word.',
    'The Academy scheduler kept offering her empty hours. She chose one, set a lamp on the desk, and made it hers. A boundary became real when it appeared on the calendar.',
    'Blue asked which friends left the Shade feeling larger after a conversation. Three names came easily. The rest of the list took longer, and told the truth anyway.',
    'The Shade drew a new line across the map in blue pencil. Fear still waited at the edge of it. The next hour had a direction.',
    'At the Ethereal Horizon, Blue kept the map beside the field notes. The route was still unfinished. For the first time, it belonged to the person holding it.',
  ],
  3: [
    'The simulator registered a heat spike before Blue saw the Shade in the corridor. She had been swallowing anger until it felt like a personal flaw. Blue placed a glass of water on the floor between them and waited.',
    'The anger had a message. A film she wanted to make had been made by someone else, and the loss stung. Blue wrote down the useful part: she wanted to make films.',
    'They followed the heat backward through an old review and a classroom where a teacher had laughed. The memory still had authority because nobody had asked whether it was accurate. Blue asked now.',
    'Some criticism named a craft problem and could be used. The rest was vague, shaming noise. Blue put the useful note in one column and the wound in another.',
    'The Shade wrote the critic a letter she would never send. She defended the work, named what had hurt, and left room for the one revision she actually wanted to make.',
    'A door opened on a beginner class. The Shade nearly called it coincidence, then remembered she had made the inquiry yesterday. Opportunity had followed a visible step.',
    'Joy arrived after the fear, sudden and embarrassing. Blue logged it beside grief and anger. All three were data about what mattered.',
    'The Shade kept her fear and made one call, bought one notebook, and returned to the unfinished scene. Power looked smaller than the fantasy and more useful.',
    'Blue watched her leave the Academy with the map of her anger folded in her pocket. It pointed toward the Ethereal Horizon because she had learned to read it.',
  ],
  4: [
    'Blue turned off the Academy feed for one night. Without articles, alerts, or borrowed opinions, the rooms sounded different. The pipes cooled. A Shade heard her own thoughts arrive without an audience.',
    'She brought her field notes unopened. “I am fine with it,” she said. Blue asked what fine meant today: numb, resigned, relieved, or afraid.',
    'The pages held a small hurt she had minimized and a success she had never allowed herself to count. Blue placed both on the table. Reality needed the whole record.',
    'The Shade’s body had been sending reports before her mind would read them: exhaustion after caretaking, a tight chest before a deadline, sleep after a hard truth. Blue treated each signal as information with a purpose.',
    'In the closet, she found clothes for a version of herself she no longer recognized. She gave one away. The empty hanger made room without explaining what would come next.',
    'Blue set a timer for five fast lists: classes, hobbies, skills, silly risks, old pleasures. The Shade wrote before the censor could make the choices respectable.',
    'By the end of the week, the silence no longer felt blank. It held French lessons, clay, a private corner, and a letter from her eight-year-old self.',
    'At dawn, Blue returned the field notes. They were messy and specific. The Shade carried them out as proof that integrity begins by naming what is true.',
  ],
  5: [
    'A bus passed the Academy with one empty seat. Blue watched a Shade let it go by. “Someone else may need it more,” she said, and the empty street held the sentence for a moment.',
    'The old instructions were familiar: be realistic, stay useful, wait your turn. They had arrived from frightened teachers, tired parents, and friends who mistook shrinking for wisdom.',
    'Blue opened the field notes to a clean page and asked for nineteen wishes. The Shade wrote too fast to edit: a class, a trip, boots, a studio, a bolder life.',
    'At the river, Blue gave her an afternoon with no task attached. The Shade walked, drew in a sketchbook, and noticed how quickly guilt tried to turn rest into evidence.',
    'Nothing collapsed when she chose the pottery class over another obligation. The friend moved without her. The world remained intact. Her own attention returned with oxygen in it.',
    'A useful contact appeared through a path she had not planned. Blue recorded the sequence carefully: she made room, took one step, and a new option became visible.',
    'The Shade stopped calling the wish list frivolous. It became data about the life she wanted and a direction she could defend.',
    'When the next bus came, Blue ran beside her. The Shade stepped on before the old instructions could finish speaking.',
  ],
  6: [
    'Blue found a deficit in the Academy ledger where a Shade had written her own name. Every desire had been entered as a cost. Every bill had become proof that her creative life should wait.',
    'Blue counted the rent with her. Then they counted the fifteen minutes for field notes, the windowsill, the clean desk, and the walk home.',
    'For one week, the Shade wrote down every purchase without scolding herself. Coffee. Transit. A late fee. A small object she loved. The numbers began to show what her money was actually protecting.',
    'At the market, she touched good paper and almost put it back. Blue asked which old belief had reached for her hand. The answer came from a family story about people like them never having enough.',
    'They wrote the story out fast: money equals danger, art equals waste, receiving equals taking. Seeing the sentences on paper made them less like laws.',
    'The Shade bought one useful thing for the work and carried it home carefully. It was a small decision, but the room changed once it had a place for her practice.',
    'Blue entered the receipt in the ledger beside the time she protected that week. Abundance had become a record of attention, choice, and practical care.',
    'The balance did not become infinite. The Shade’s options became easier to see. Blue called that a resource worth building.',
  ],
  7: [
    'A Shade redrew one corner of a portrait until the paper tore. She called it standards. Blue set a fresh page beside her and named the loop: perfection had stopped the work from moving.',
    'In the workshop, Blue asked the Shades to listen before they tried to invent. One caught a line of dialogue from the room. Another heard a rhythm in a failed note. The work began by getting something down.',
    'A rough first page passed from hand to hand. Nobody graded it. Someone answered its melody, and the wrong note became part of a song.',
    'The Shade saw another artist receive the opportunity she wanted. Her stomach tightened. Blue did not ask her to be nicer about it; she asked what the jealousy was pointing toward.',
    'The answer was a door she had avoided for years. She wanted to perform. She wanted to risk looking new at something.',
    'Blue helped her make the risk small enough to begin: one class, one draft, one person safe enough to hear it. The goal was a real attempt before a polished debut.',
    'The first attempt was awkward. The room stayed with her. A second attempt had more air in it.',
    'Blue wrote the outcome in the field notes: there was room for other artists and room for her work too. Envy had become a direction instead of a verdict.',
    'Beyond the Academy windows, the Ethereal Horizon held every unfinished song. The Shade stopped waiting to deserve a place in it.',
  ],
  8: [
    'The simulator clock had been set to too late. Blue knew the setting well. A Shade held an old teacher’s voice in her pocket: you missed your chance, you were never serious enough.',
    'They gave the loss its real name. The rejection, the canceled project, the cruel review, and the years spent recovering all belonged in the record. Nothing healed by pretending it had not happened.',
    'Blue asked what small care would support the artist today. The Shade bought flowers, cleared a corner of the desk, and let the next action be modest.',
    'The large question arrived on schedule: How will I change my whole life? Blue set it aside. First came the class listing, the clean brush, the one phone call, the page for today.',
    'The Shade began as a beginner and hated the feeling for ten minutes. Then her hands learned the hour was still hers. The work did not ask her age before accepting a mark.',
    'They revisited the old lesson from childhood and wrote the part that had been missing: one person had believed in her. The earlier shame was real. It was not the only evidence.',
    'Blue logged the work instead of the fantasy of a finished career. Process gave the day a shape that comparison could not take away.',
    'At dusk, the Shade left one line on the page and kept walking. The clock moved forward. So did she.',
    'Blue filed the day under strength, then turned the Academy lights toward the Ethereal Horizon.',
  ],
  9: [
    'A Shade stood outside the studio and called herself lazy. Blue found fear beside the door instead: fear of failing, fear of succeeding, fear that the work would make her easier to leave. Naming it changed the next step.',
    'Blue made the task smaller. One paragraph. One color on the page. One message to a supportive person. The Shade entered before she had time to demand a masterpiece from herself.',
    'When a promising opening appeared, the Shade almost made her usual U-turn: delay the reply, abandon the draft, start a fight. Blue asked what she gained by leaving first. The answer was safety, old and expensive.',
    'They made a different deal. The Shade would show up for the quantity; Blue would help her notice the quality later. When she turned back toward the work, the Academy light was already on.',
  ],
  10: [
    'Blue found the studio full of borrowed noise: late-night work, messages, comparison, hunger, and a deadline used to justify all of it. A Shade had built a life so busy that her own field notes could not reach her.',
    'They named the habit she used when the work began to matter. It had become a way to mute anxiety about change. Naming the payoff gave her a choice.',
    'Blue helped her write five bottom lines on the wall: what could no longer take the evening, the money, the sleep, or the desk. Boundaries made room for play to feel safe again.',
    'Then came a dry week. The pages felt mechanical and foolish. Blue left them open beside an empty cup and asked only for ten minutes. Drought was a season, not a verdict.',
    'The Shade stopped checking who was ahead. She returned to the workbench, used a touchstone she loved, and made something small. The work had been waiting, not judging.',
  ],
  11: [
    'Blue built a small desk at the edge of the Academy, where the light changed slowly. A Shade filled it with stones, paper, a candle, and one letter to the artist she had kept waiting.',
    'She tested the life around the work instead of copying someone else’s. A steady job gave her one kind of freedom. A different schedule gave her another. Practice and judgment decided what fit.',
    'When her last project worked, the old temptation returned: repeat it exactly, accept every request, protect the formula. Blue kept one hour free for the strange project with no obvious market.',
    'The Shade walked until the argument in her head became footsteps. She returned to the desk with a new line and no need to ask the room for permission.',
  ],
  12: [
    'Blue set a jar beside the first page. A Shade filled it with the worries she had been carrying: the unfinished work, the late start, the people who would not understand. Then she wrote the next action where she could see it.',
    'The whole road stayed hidden. Blue had no false map for that. She had the evidence of the field notes, the artist dates, and every small move that had made an option appear.',
    'A message from an old doubt arrived just as the Shade prepared to leave. Blue let it wait unopened while the Shade named the people safe enough to hear her real plans.',
    'She carried her tools past the Academy gate and made a ninety-day promise: keep the notes, keep the dates, keep taking the next action. The Ethereal Horizon was still there because she had learned how to travel toward it.',
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
    }, weekNumber === 1 ? WEEK_ONE_TYPING_DELAY_MS : WEEK_STORY_TYPING_DELAY_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sceneIndex, scenes, shouldRender, showCheckIn, weekNumber]);

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
