import { NextResponse } from 'next/server';
import { elizaAPI } from '@/lib/eliza-api';
import type { CourseData } from '@/lib/personal-course';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ELIZA_API_KEY = process.env.ELIZA_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const CHAT_MODEL = process.env.ELIZA_CHAT_MODEL || 'anthropic/claude-sonnet-4.6';

const DRAFT_SYSTEM_PROMPT = `You are a course curriculum designer for Mental Wealth Academy, a mental wellness platform.
Generate a practical 4-week micro-course based on the user's topic and goal.

RULES:
- Generate ONLY concrete, behavioral tasks — specific actions the user will take each day or week.
- Do NOT make factual claims about medicine, neuroscience, or psychology research. No "studies show..." statements.
- Tasks must be actionable: "write for 5 minutes each morning", "take a 10-minute walk", "practice one breathing exercise before bed".
- Each week has a short theme (2–4 words) and exactly 4 tasks.
- Tasks are 1 sentence each, plain language, active voice.
- Title: direct and concrete — "Build a drawing practice", "Start a running habit", "Develop a public speaking skill".
- Build on widely accepted behavioral principles: small steps, consistency, gradual progression, reflection.
- Week 1 should be very gentle. Week 4 should lock in the habit.

Return ONLY raw JSON, no prose, no markdown fences, exactly this shape:
{"title":"string","focus":"string","weeks":[{"weekNumber":1,"theme":"string","tasks":["","","",""]},{"weekNumber":2,"theme":"string","tasks":["","","",""]},{"weekNumber":3,"theme":"string","tasks":["","","",""]},{"weekNumber":4,"theme":"string","tasks":["","","",""]}]}`;

async function callDeepSeek(prompt: string): Promise<string> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: DRAFT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
      max_tokens: 1200,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('DeepSeek returned empty response');
  return content;
}

function parseCourse(raw: string): CourseData | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.focus !== 'string' ||
      !Array.isArray(parsed.weeks) ||
      (parsed.weeks as unknown[]).length !== 4
    ) return null;
    return parsed as unknown as CourseData;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { prompt?: unknown };
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    return NextResponse.json({ error: 'Tell Blue what you want to learn.' }, { status: 400 });
  }

  let raw: string;
  try {
    if (DEEPSEEK_API_KEY) {
      raw = await callDeepSeek(prompt);
    } else if (ELIZA_API_KEY) {
      raw = await elizaAPI.chat({
        messages: [
          { role: 'system', content: DRAFT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        id: CHAT_MODEL,
        maxTokens: 1200,
      });
    } else {
      return NextResponse.json({ error: 'No LLM configured.' }, { status: 503 });
    }
  } catch (err) {
    console.error('[course/draft] LLM call failed:', err);
    return NextResponse.json({ error: 'Course generation failed. Try again.' }, { status: 500 });
  }

  const course = parseCourse(raw);
  if (!course) {
    return NextResponse.json(
      { error: 'Could not generate a course from that. Try being more specific about your topic and goal.' },
      { status: 422 },
    );
  }
  return NextResponse.json({ course });
}
