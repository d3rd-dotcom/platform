import { NextResponse } from 'next/server';
import { elizaAPI } from '@/lib/eliza-api';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ELIZA_API_KEY = process.env.ELIZA_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const CHAT_MODEL = process.env.ELIZA_CHAT_MODEL || 'anthropic/claude-sonnet-4.6';

const GENERATE_SYSTEM_PROMPT = `You are a course curriculum designer for Mental Wealth Academy, an online learning platform.
Generate a structured multi-week course based on the user's topic.

OUTPUT FORMAT: Return ONLY raw JSON, no prose, no markdown fences.

SCHEMA:
{
  "title": "string — direct, concrete course title",
  "focus": "string — 2-4 word theme or focus area",
  "weeks": [
    {
      "weekNumber": 1,
      "title": "string — week title",
      "theme": "string — 2-4 word theme",
      "components": [
        {
          "componentType": "string",
          "title": "string",
          "config": { ... },
          "required": true
        }
      ]
    }
  ]
}

COMPONENT TYPES AND CONFIG:

1. rich_text — A lesson or reading passage.
   config: { "content": "string — full markdown body" }

2. multiple_choice — A knowledge check question.
   config: {
     "question": "string",
     "options": [{ "id": "a", "text": "string", "isCorrect": false }],
     "selectMultiple": false,
     "revealAnswers": true
   }
   Exactly one option should have isCorrect: true unless selectMultiple is true.
   Always include 4 options.

3. reflection_journal — A guided journal prompt.
   config: { "prompt": "string — reflective writing prompt", "minWords": 50, "saveEnabled": true }

4. video_embed — An embedded video lesson.
   config: { "url": "string — YouTube or Vimeo URL, use a well-known example URL like https://www.youtube.com/watch?v=dQw4w9WgXcQ", "provider": "youtube" }

5. image_embed — An illustrative image.
   config: { "url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800", "alt": "string — description", "caption": "string — caption" }

6. text_input — A short-answer question.
   config: { "placeholder": "string — hint text", "maxLength": 500, "inputType": "text" }

7. rating_scale — A self-assessment rating.
   config: { "min": 1, "max": 5, "step": 1, "minLabel": "Not confident", "maxLabel": "Very confident" }

8. quiz_block — A timed quiz.
   config: { "timeLimitMinutes": 5, "passingScore": 80 }

9. password_gate — A password-protected bonus content reveal.
   config: { "password": "unlock", "hint": "Think about what we learned this week", "content": "🎉 Bonus content revealed!" }

10. file_upload — A file submission.
    config: { "maxSizeMb": 10, "multiple": false }

RULES:
- Generate 4-8 weeks.
- Each week should have 3-6 components.
- Include a variety of component types across the course — at minimum rich_text (for lessons), multiple_choice (for checks), and reflection_journal (for reflection).
- Week 1 should be gentle and introductory.
- Week 4-8 should build depth and culminate.
- The course should feel complete and self-contained.
- All content must be original. No placeholder text.
- No factual claims about medicine, neuroscience, or psychology research.
- Use plain, warm, second-person ("you") language in content.`;

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
        { role: 'system', content: GENERATE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
      max_tokens: 4000,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('DeepSeek returned empty response');
  return content;
}

function parseGeneratedCourse(raw: string): { title: string; focus: string; weeks: Array<unknown> } | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.focus !== 'string' ||
      !Array.isArray(parsed.weeks) ||
      (parsed.weeks as unknown[]).length < 2
    ) return null;
    return parsed as { title: string; focus: string; weeks: Array<unknown> };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to generate a course.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { prompt?: unknown };
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    return NextResponse.json({ error: 'Tell Blue what course you want to create.' }, { status: 400 });
  }

  let raw: string;
  try {
    if (DEEPSEEK_API_KEY) {
      raw = await callDeepSeek(prompt);
    } else if (ELIZA_API_KEY) {
      raw = await elizaAPI.chat({
        messages: [
          { role: 'system', content: GENERATE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        id: CHAT_MODEL,
        maxTokens: 4000,
      });
    } else {
      return NextResponse.json({ error: 'No LLM configured.' }, { status: 503 });
    }
  } catch (err) {
    console.error('[vip/courses/generate] LLM call failed:', err);
    return NextResponse.json({ error: 'Course generation failed. Try again.' }, { status: 500 });
  }

  const course = parseGeneratedCourse(raw);
  if (!course) {
    return NextResponse.json(
      { error: 'Could not generate a course from that. Try being more specific about your topic.' },
      { status: 422 },
    );
  }
  return NextResponse.json({ course });
}
