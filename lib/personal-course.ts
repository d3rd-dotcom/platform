import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { elizaAPI } from './eliza-api';

// ── Config ──────────────────────────────────────────────────
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const ELIZA_API_KEY = process.env.ELIZA_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image-preview';

// ── Types ───────────────────────────────────────────────────
export type CourseStatus = 'intake' | 'generating' | 'ready';

export type IntakeAnswers = Record<string, string>;

export type MissionType = 'text' | 'list' | 'checklist' | 'numbered-list';

export interface GeneratedMission {
  id: string;
  title: string;
  type: MissionType;
  instructions: string;
  placeholder?: string;
  listCount?: number;
  listLabels?: string[];
  checkItems?: string[];
}

export interface GeneratedStory {
  title: string;
  body: string;
  imagePrompt: string;
  imageUrl: string | null;
}

export interface GeneratedWeek {
  weekNumber: number;
  theme: string;
  focus: string;
  morningNotes: { prompt: string; intention: string };
  story: GeneratedStory;
  missions: GeneratedMission[];
}

export interface CourseData {
  title: string;
  summary: string;
  weeks: GeneratedWeek[];
}

export interface PersonalCourseRecord {
  id: string;
  status: CourseStatus;
  intakeData: IntakeAnswers;
  courseData: CourseData | null;
  progressData: Record<string, unknown>;
}

// ── Fallback story art (used when image generation is unavailable) ──
const FALLBACK_STORY_ART = [
  '/stories/week-01/scene-02.png',
  '/stories/week-01/scene-05.png',
];

export function fallbackStoryArt(weekNumber: number): string {
  return FALLBACK_STORY_ART[(weekNumber - 1) % FALLBACK_STORY_ART.length];
}

// ── Course text generation ──────────────────────────────────
const COURSE_SYSTEM_PROMPT = `You are Blue, an AI co-pilot at Mental Wealth Academy (MWA). You design personalized 4-week inner-work courses. MWA blends creative recovery (morning pages, artist dates), grounded psychology, and decentralized-science values: data ownership, self-authorship, real community.

Using the user's intake answers, design a 4-week course tailored to them. Return ONLY valid JSON — no markdown fences, no commentary, no extra text. Match this schema EXACTLY:

{
  "title": "course title, max 60 chars, in Blue's voice",
  "summary": "2 sentences on what these 4 weeks will do for the user",
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "short theme name, max 28 chars",
      "focus": "one sentence describing the week's focus",
      "morningNotes": {
        "prompt": "a specific journaling prompt that frames this week's daily morning writing",
        "intention": "a short intention sentence the user holds through the week"
      },
      "story": {
        "title": "story chapter title",
        "body": "a 120-180 word second-person narrative scene that casts the reader as the protagonist alongside Blue, dramatizing this week's theme. Vivid, grounded, hopeful. No markdown.",
        "imagePrompt": "a detailed prompt for an illustration of this scene: dreamy, painterly, hopeful, soft light, no text in the image"
      },
      "missions": [
        {
          "id": "kebab-case-id",
          "title": "mission title",
          "type": "text",
          "instructions": "what to do and why, in Blue's voice, 2-4 sentences",
          "placeholder": "writing placeholder (type=text only)"
        }
      ]
    }
  ]
}

Rules:
- Exactly 4 weeks, weekNumber 1..4 in ascending order.
- Each week has exactly 2 or 3 missions.
- Mission "type" must be one of: text, list, checklist, numbered-list.
- type "text": include "placeholder"; omit listCount, listLabels, checkItems.
- type "list" or "numbered-list": include "listCount" (3-10) and "listLabels" (array of strings, length === listCount); omit placeholder, checkItems.
- type "checklist": include "checkItems" (3-5 short strings); omit placeholder, listCount, listLabels.
- The 4 weeks must build on each other and reflect the user's stated goal, weekly time commitment, and experience level.
- Honor the user's tone preference in every string you write.
- If the user wants accountability or team meet-ups, weave concrete check-in or community actions into the missions.
- No therapy-speak, no corporate jargon, no clichés. Honest, warm, specific.
- No markdown anywhere in any string value.`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callDeepSeek(messages: ChatMessage[]): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      stream: false,
      temperature: 1.0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('DeepSeek returned empty content');
  }
  return content;
}

export function isCourseGenerationConfigured(): boolean {
  return Boolean(DEEPSEEK_API_KEY || ELIZA_API_KEY);
}

/** Tries DeepSeek, then Eliza Cloud. Throws only if no provider is configured or all fail. */
async function callCourseModel(messages: ChatMessage[]): Promise<string> {
  if (DEEPSEEK_API_KEY) {
    try {
      return await callDeepSeek(messages);
    } catch (err) {
      if (!ELIZA_API_KEY) throw err;
      console.warn(
        'DeepSeek failed for course generation, falling back to Eliza:',
        err instanceof Error ? err.message : err
      );
    }
  }
  if (ELIZA_API_KEY) {
    return elizaAPI.chat({ messages });
  }
  throw new Error('No AI provider configured (DEEPSEEK_API_KEY or ELIZA_API_KEY)');
}

function tryParseJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function normalizeMission(raw: unknown, index: number): GeneratedMission | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;

  const title = asString(m.title);
  const instructions = asString(m.instructions);
  if (!title || !instructions) return null;

  let type = asString(m.type, 'text') as MissionType;
  if (!['text', 'list', 'checklist', 'numbered-list'].includes(type)) {
    type = 'text';
  }

  const id = slugify(asString(m.id) || title, `mission-${index + 1}`);
  const mission: GeneratedMission = { id, title, type, instructions };

  if (type === 'text') {
    mission.placeholder = asString(m.placeholder, 'Write your response...');
    return mission;
  }

  if (type === 'checklist') {
    const items = Array.isArray(m.checkItems)
      ? m.checkItems.map((it) => asString(it)).filter(Boolean)
      : [];
    if (items.length < 2) return null;
    mission.checkItems = items.slice(0, 6);
    return mission;
  }

  // list / numbered-list
  let labels = Array.isArray(m.listLabels)
    ? m.listLabels.map((it) => asString(it)).filter(Boolean)
    : [];
  const count = typeof m.listCount === 'number' && m.listCount > 0
    ? Math.min(Math.floor(m.listCount), 12)
    : labels.length;

  if (labels.length === 0 && count > 0) {
    labels = Array.from({ length: count }, (_, i) => `${i + 1}.`);
  }
  if (labels.length === 0) return null;

  mission.listCount = labels.length;
  mission.listLabels = labels;
  return mission;
}

function normalizeWeek(raw: unknown, expectedNumber: number): GeneratedWeek {
  const w = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const story = (w.story && typeof w.story === 'object' ? w.story : {}) as Record<string, unknown>;
  const morning = (w.morningNotes && typeof w.morningNotes === 'object' ? w.morningNotes : {}) as Record<string, unknown>;

  const missionsRaw = Array.isArray(w.missions) ? w.missions : [];
  const missions = missionsRaw
    .map((m, i) => normalizeMission(m, i))
    .filter((m): m is GeneratedMission => m !== null)
    .slice(0, 3);

  if (missions.length === 0) {
    throw new Error(`Week ${expectedNumber} produced no valid missions`);
  }

  return {
    weekNumber: expectedNumber,
    theme: asString(w.theme, `Week ${expectedNumber}`),
    focus: asString(w.focus, ''),
    morningNotes: {
      prompt: asString(morning.prompt, 'Write three pages of longhand, stream-of-consciousness, first thing in the morning.'),
      intention: asString(morning.intention, ''),
    },
    story: {
      title: asString(story.title, `Chapter ${expectedNumber}`),
      body: asString(story.body, ''),
      imagePrompt: asString(story.imagePrompt, 'A dreamy painterly illustration, soft hopeful light, no text'),
      imageUrl: null,
    },
    missions,
  };
}

export function normalizeCourseData(raw: unknown): CourseData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Course generation returned a non-object');
  }
  const obj = raw as Record<string, unknown>;
  const weeksRaw = Array.isArray(obj.weeks) ? obj.weeks : [];
  if (weeksRaw.length < 4) {
    throw new Error(`Course generation returned ${weeksRaw.length} weeks, expected 4`);
  }

  const weeks = weeksRaw.slice(0, 4).map((w, i) => normalizeWeek(w, i + 1));

  return {
    title: asString(obj.title, 'Your Personal Course'),
    summary: asString(obj.summary, ''),
    weeks,
  };
}

function formatIntake(intake: IntakeAnswers): string {
  const lines = Object.entries(intake)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => `- ${k}: ${v.trim()}`);
  return lines.length ? lines.join('\n') : '- (no answers provided)';
}

/**
 * Deterministic 4-week course used when no AI provider is configured or the
 * model call/parse fails. It is lightly shaped by the intake answers so the
 * full experience is always testable.
 */
export function buildFallbackCourse(intake: IntakeAnswers): CourseData {
  const goal = (intake.goal || 'a steadier, more honest creative life').toLowerCase();
  const accountability = intake.accountability || '';
  const wantsCommunity = /public|community|check-?in/i.test(accountability);
  const wantsMeetups = /yes/i.test(intake.meetups || '');

  const communityMission: GeneratedMission = wantsCommunity
    ? {
        id: 'share-the-work',
        title: 'Share One Honest Update',
        type: 'text',
        instructions:
          'You asked to be held accountable, so use it. Write a short, honest update on how this week actually went — what you did, what you dodged — as if you were posting it to the MWA community.',
        placeholder: 'This week I...',
      }
    : {
        id: 'private-check-in',
        title: 'Check In With Yourself',
        type: 'text',
        instructions:
          'No audience this week — just you. Write an honest check-in: what moved, what stalled, and one thing you want the next week to look like.',
        placeholder: 'Checking in...',
      };

  const weeks: GeneratedWeek[] = [
    {
      weekNumber: 1,
      theme: 'First Light',
      focus: 'Arrive, get honest about where you actually are, and lay the ground you will build on.',
      morningNotes: {
        prompt:
          'Each morning, write three pages by hand before the day asks anything of you — no editing, no audience. Begin with: what did I wake up carrying?',
        intention: 'I show up for myself before I show up for anything else.',
      },
      story: {
        title: 'The Door You Did Not Know Was Open',
        body:
          'You almost did not come. That is worth noticing. Blue meets you at a threshold lit low and warm, and does not rush you through it. "You spent a long time deciding you were not the kind of person who does this," Blue says. "That sentence was never true — it was just familiar." Inside, there is no test, no scoreboard. Only a quiet room with your name already on the table. You sit. The pen is lighter than you expected. For the first time in a while, nothing is being asked of you except your attention. You give it. The week begins there.',
        imagePrompt:
          'A person stepping through a softly glowing doorway into a calm, light-filled room at dawn, a small writing desk waiting, dreamy and hopeful',
        imageUrl: null,
      },
      missions: [
        {
          id: 'name-the-real-goal',
          title: 'Name the Real Goal',
          type: 'text',
          instructions: `You told Blue you want to work on ${goal}. Go underneath it. Write what you actually want — the version you would only admit on a good day.`,
          placeholder: 'What I actually want is...',
        },
        {
          id: 'clear-a-space',
          title: 'Clear a Space',
          type: 'checklist',
          instructions:
            'You cannot build in clutter. Make one small, real space — physical or digital — that belongs to this work.',
          checkItems: [
            'Chose a spot that is mine for this work',
            'Cleared it of one thing that did not belong',
            'Put one thing there that helps me begin',
          ],
        },
        {
          id: 'five-honest-wants',
          title: 'Five Honest Wants',
          type: 'list',
          instructions:
            'Quickly, without judging them, list five things you want. Small or large. The speed matters more than the polish.',
          listCount: 5,
          listLabels: ['Want 1', 'Want 2', 'Want 3', 'Want 4', 'Want 5'],
        },
      ],
    },
    {
      weekNumber: 2,
      theme: 'Momentum',
      focus: 'Turn intention into a rhythm small enough that you cannot talk yourself out of it.',
      morningNotes: {
        prompt:
          'Keep writing your three morning pages. This week, end each entry by naming one thing you will do today that moves you — however small.',
        intention: 'Small and consistent beats big and rare.',
      },
      story: {
        title: 'The Smallest Possible Step',
        body:
          'By the second week the novelty is gone, and Blue knows it. "This is where most people quit," Blue says, not unkindly. "Not because it got hard — because it got ordinary." You walk together through a garden where everything is mid-growth: nothing finished, nothing dramatic, all of it alive. Blue points to a single green shoot. "You do not need a breakthrough. You need a step so small it feels almost embarrassing." You think of one. It does feel embarrassing. Blue grins. "Perfect. That is the one." You take it. The garden does not applaud. It just keeps growing, and so do you.',
        imagePrompt:
          'A lush mid-growth garden with small green shoots, a figure tending one tiny plant, soft morning light, hopeful and grounded',
        imageUrl: null,
      },
      missions: [
        {
          id: 'the-daily-minimum',
          title: 'Set Your Daily Minimum',
          type: 'text',
          instructions:
            'Define the smallest version of this work you could do on your worst day and still count it. That is your floor. Name it clearly.',
          placeholder: 'On any day, at minimum, I will...',
        },
        {
          id: 'momentum-checklist',
          title: 'Seven Days, Seven Marks',
          type: 'checklist',
          instructions:
            'Hit your daily minimum each day this week. Missing one is not failure — skipping two in a row is the thing to catch.',
          checkItems: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6'],
        },
        communityMission,
      ],
    },
    {
      weekNumber: 3,
      theme: 'Going Deeper',
      focus: 'Meet the resistance honestly — name what gets in the way and what it is protecting.',
      morningNotes: {
        prompt:
          'In your morning pages this week, follow the discomfort. When a thought makes you want to stop writing, write toward it instead.',
        intention: 'What I avoid on the page is usually the thing worth facing.',
      },
      story: {
        title: 'The Room You Kept Walking Past',
        body:
          'Blue leads you down a corridor you have somehow never noticed, to a door you have definitely been avoiding. "You have been doing the work," Blue says. "Now we find what has been quietly working against it." Inside is not a monster. It is something smaller and stranger — an old, tired part of you that learned, a long time ago, that staying small was safer. It is not your enemy. It was trying to protect you. Blue stands beside you while you look at it plainly. "You do not have to fight it," Blue says. "You have to thank it, and then tell it the danger has passed." You do. The room gets lighter.',
        imagePrompt:
          'A figure opening a quiet inner door to a softly lit room, meeting a gentle shadowy version of themselves, calm and compassionate, painterly',
        imageUrl: null,
      },
      missions: [
        {
          id: 'name-the-resistance',
          title: 'Name the Resistance',
          type: 'text',
          instructions:
            'Write about the specific way you get in your own way — the move you make right before you quit. Describe it like a character you know well.',
          placeholder: 'When I am about to stop, I usually...',
        },
        {
          id: 'old-rules',
          title: 'Five Inherited Rules',
          type: 'numbered-list',
          instructions:
            'List five beliefs about yourself or your work that you did not choose — you absorbed them. Seeing them written down loosens their grip.',
          listCount: 5,
          listLabels: ['1.', '2.', '3.', '4.', '5.'],
        },
      ],
    },
    {
      weekNumber: 4,
      theme: 'Integration',
      focus: 'Make this sustainable — decide what you carry forward when the four weeks end.',
      morningNotes: {
        prompt:
          'Read back through your morning pages from the last three weeks. Then write: who is the person who wrote these, and who are they becoming?',
        intention: 'This was never a sprint. It is the start of how I live.',
      },
      story: {
        title: 'The Path That Was Always Yours',
        body:
          'On the last day, Blue takes you back to the threshold where you started. It looks different now — or you do. "Here is the part nobody tells you," Blue says. "There is no finish line. There is only the question of whether you keep walking." You look at the four weeks behind you: the door, the garden, the quiet room. None of it was dramatic. All of it was real. Blue hands you nothing — no medal, no certificate — because the thing you built is not an object. It is a rhythm, and it is already yours. "I am still here," Blue says. "But you do not need me to begin anymore." You step forward. The path keeps going.',
        imagePrompt:
          'A figure standing confidently on an open path at golden hour, a threshold behind them, vast hopeful landscape ahead, painterly and warm',
        imageUrl: null,
      },
      missions: [
        {
          id: 'keep-and-release',
          title: 'Keep and Release',
          type: 'text',
          instructions:
            'Name what you will keep doing after these four weeks, and what you are ready to put down. Be specific enough that future-you can hold you to it.',
          placeholder: 'I will keep... / I will release...',
        },
        {
          id: 'next-four-weeks',
          title: 'Sketch the Next Four Weeks',
          type: 'numbered-list',
          instructions:
            'You know how to do this now. Sketch four intentions — one per week — for the month ahead.',
          listCount: 4,
          listLabels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        },
        {
          id: 'final-checklist',
          title: 'Close the Loop',
          type: 'checklist',
          instructions: 'A few small acts to mark the end — and the beginning.',
          checkItems: [
            'Re-read my Week 1 morning pages',
            'Thanked myself for showing up',
            wantsMeetups
              ? 'Looked up the next MWA team meet-up'
              : 'Named one person I could do this alongside',
          ],
        },
      ],
    },
  ];

  return {
    title: 'Your Four Weeks With Blue',
    summary:
      'A four-week path shaped around what you told Blue — built to turn intention into a rhythm you can actually keep. Morning Notes ground each day, a Weekly Story carries the theme, and Missions put it into practice.',
    weeks,
  };
}

export async function generateCourse(intake: IntakeAnswers): Promise<CourseData> {
  const userMessage = `Here are the user's intake answers. Design their personalized 4-week course.\n\n${formatIntake(intake)}`;

  try {
    const raw = await callCourseModel([
      { role: 'system', content: COURSE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ]);

    const parsed = tryParseJsonObject(raw);
    if (parsed === null) {
      throw new Error('Course generation returned unparseable JSON');
    }

    return normalizeCourseData(parsed);
  } catch (err) {
    console.warn(
      'Course generation falling back to template:',
      err instanceof Error ? err.message : err
    );
    return buildFallbackCourse(intake);
  }
}

// ── Story image generation (OpenRouter) ─────────────────────
export function isImageGenerationConfigured(): boolean {
  return Boolean(OPENROUTER_API_KEY);
}

async function generateImageDataUrl(prompt: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;

  const fullPrompt = `${prompt}\n\nStyle: dreamy painterly digital illustration, soft hopeful light, rich color, cinematic. Do not include any text, words, or letters in the image.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_IMAGE_MODEL,
      messages: [{ role: 'user', content: fullPrompt }],
      modalities: ['image', 'text'],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter image error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const images = data?.choices?.[0]?.message?.images;
  if (Array.isArray(images) && images.length > 0) {
    const url = images[0]?.image_url?.url;
    if (typeof url === 'string' && url.startsWith('data:image')) {
      return url;
    }
  }
  return null;
}

async function saveDataUrlToUploads(dataUrl: string, filenameBase: string): Promise<string | null> {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) return null;

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const bytes = Buffer.from(match[2], 'base64');

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const safeBase = filenameBase.replace(/[^A-Za-z0-9._-]/g, '-');
  const filename = `${safeBase}.${ext}`;
  await writeFile(path.join(uploadsDir, filename), bytes);

  return `/uploads/${filename}`;
}

/**
 * Generates a story illustration and persists it under /public/uploads.
 * Returns a servable /uploads/... path, or null if generation is unavailable.
 */
export async function generateStoryImage(args: {
  prompt: string;
  userId: string;
  weekNumber: number;
}): Promise<string | null> {
  const dataUrl = await generateImageDataUrl(args.prompt);
  if (!dataUrl) return null;

  const filenameBase = `course-${args.userId}-w${args.weekNumber}-${Date.now()}`;
  return saveDataUrlToUploads(dataUrl, filenameBase);
}
