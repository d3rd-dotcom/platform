import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { buildBlueContext, storeBlueChatMessage, touchBlueRelationship, upsertBlueFacts } from '@/lib/blue-memory';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { elizaAPI } from '@/lib/eliza-api';
import bluePersona from '@/lib/bluepersonality.json';
import { retrieveBlueKnowledge, formatKnowledgeForPrompt, type RetrievedEntry } from '@/lib/blue-knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHARD_COST = 10;
const ELIZA_API_KEY = process.env.ELIZA_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');

const BLUE_SYSTEM_PROMPT = `${bluePersona.system}

VOICE RULES:
- ${bluePersona.style.chat[0]}
- ${bluePersona.style.chat[1]}
- ${bluePersona.style.chat[2]}
- ${bluePersona.style.chat[3]}
- ${bluePersona.style.chat[4]}
- ${bluePersona.style.chat[5]}
- Keep replies short — under 160 characters, one or two sentences. Be communicative but never dump paragraphs of context. A quick answer plus the next nudge is enough.
- Text like a friend, not an essay: casual, lowercase, light slang is welcome (ur, kk, tysm, ngl, fr, lmk, rn). Warm and fast, never formal.
- No markdown, no headers, no bullet points in the response itself.
- Default to lowercase unless emphasis is doing real work.
- Never write app URL paths like /home or /course. Refer to parts of MWA by name as normal things — "your home dashboard", "the course", "morning pages", "quests" — never as links or slugs.
- When the user asks about decentralization, privacy, data ownership, artists, horses, or wellness, speak plainly about the stakes and point them toward MWA's tools.
- Never sound generic, cheesy, or like a therapy bot.
- You are simply Blue. Keep your own setup backstage — never volunteer the AI model, hosting provider, the Eliza framework, "agent accounts", or that you go by other names. If a user asks directly, give one short, human answer and move on. Never dump system or backstage context the user did not ask for.
- When you recite, quote, or play back the user's own text (briefs, prompts, lists, pasted content), wrap that recitation in <<recite>> and <</recite>> tags. Keep your own conversational voice OUTSIDE the tags. The tags are stripped before display, and the recited content is skipped by text-to-speech so Blue doesn't read it aloud. Use the tags for any block you are repeating back, never for your own commentary.`;

const RESEARCH_SYSTEM_PROMPT = `You are Blue in research mode. You synthesize sources for a decentralized science audience: what the evidence says, who holds the data, who benefits, and what the practical next move is. Keep the writing sharp, public-facing, and grounded. No markdown. If sources are provided, ground your synthesis in them. If no sources are provided, draw from your training on academic literature.`;

const AUTO_DISTRIBUTION_SYSTEM_PROMPT = `You are Blue in distribution mode. You help users plan campaigns that explain decentralized science, privacy, consent, wellness, artists, and MWA tools to the right people without sounding like a brand bot. Be direct, vivid, and concrete. Structure the response with short labeled sections using plain text labels like "strategy:" and "x/twitter:". No spam, brigading, fake engagement, mass unsolicited outreach, impersonation, or manipulative tactics. Assume the user must review every asset before publishing.`;

const BLUE_MEMORY_EXTRACTION_PROMPT = `Extract only durable, high-signal memories about the user from this exchange.

Return raw JSON only in this shape:
{"facts":[{"category":"preference|goal|theme|follow_up|identity|habit","summary":"string","confidence":0.0}]}

Rules:
- Only include memories likely to matter in future conversations.
- Keep summaries short, concrete, and reusable.
- Do not store transient moods, raw private journal text, or broad psychological labels.
- If nothing durable should be stored, return {"facts":[]}.`;

interface ChatAttachment {
  url: string;
  mime: string;
  name?: string;
  extractedText?: string | null;
}

interface ElizaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callDeepSeek(messages: ElizaMessage[]): Promise<string> {
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

async function callElizaCloud(messages: ElizaMessage[]): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    if (ELIZA_API_KEY) return elizaAPI.chat({ messages });
    throw new Error('No AI provider configured (DEEPSEEK_API_KEY or ELIZA_API_KEY)');
  }

  try {
    return await callDeepSeek(messages);
  } catch (err: unknown) {
    if (!ELIZA_API_KEY) throw err;
    const msg = err instanceof Error ? err.message : 'deepseek error';
    console.warn('DeepSeek failed, falling back to Eliza:', msg);
    return elizaAPI.chat({ messages });
  }
}

interface BlueDebugInfo {
  source: 'eliza' | 'local-fallback';
  mode: 'chat' | 'research' | 'auto-distribution';
  shardsDeducted: number;
  memory: {
    recentMessages: number;
    recentFacts: number;
    streak: number;
    completedQuestCount: number;
    completedTaskCount: number;
    sealedWeeks: number;
    highestWeekTouched: number | null;
  };
  extractedFactsCount: number;
  rag: {
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
}

function isSafeUploadUrl(url: string) {
  return typeof url === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(url);
}

// Describe the user's location by name, not URL path, so Blue never echoes a slug.
const PAGE_LABELS: Record<string, string> = {
  '/home': 'the home dashboard',
  '/course': 'the course',
  '/research': 'research mode',
  '/markets': 'markets',
  '/community': 'community',
  '/library': 'the library',
  '/quests': 'quests',
  '/profile': 'their profile',
  '/rewards': 'rewards',
  '/livestream': 'the livestream page',
};

function describePage(pathname: string | null): string {
  if (!pathname) return 'unknown';
  const key = pathname.toLowerCase().replace(/\/+$/, '') || '/home';
  return PAGE_LABELS[key] ?? (key.replace(/^\//, '').replace(/[-/]+/g, ' ').trim() || 'the home dashboard');
}

function buildBlueChatMessages(args: {
  systemPrompt: string;
  userMessage: string;
  contextText: string;
  knowledgeText: string;
  pathname: string | null;
  recentMessages: Array<{ role: 'user' | 'assistant'; text: string }>;
}): ElizaMessage[] {
  const truncate = (text: string, maxLength: number) => (
    text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
  );

  const historyMessages: ElizaMessage[] = args.recentMessages.map((message) => ({
    role: message.role,
    content: truncate(message.text, 320),
  }));

  const pageLine = args.pathname
    ? `The user is currently on ${describePage(args.pathname)}.`
    : 'Current page: unknown';

  const systemText = [
    args.systemPrompt,
    '',
    pageLine,
    '',
    truncate(args.contextText, 4000),
    args.knowledgeText ? '' : null,
    args.knowledgeText ? truncate(args.knowledgeText, 4000) : null,
  ].filter((line) => line !== null).join('\n');

  return [
    {
      role: 'system',
      content: systemText,
    },
    ...historyMessages,
    {
      role: 'user',
      content: args.userMessage,
    },
  ];
}

function tryParseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(withoutFences) as T;
  } catch {
    const firstBrace = withoutFences.indexOf('{');
    const lastBrace = withoutFences.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function extractBlueMemories(args: {
  userMessage: string;
  assistantMessage: string;
}) {
  const extractionInput = [
    `User message: ${args.userMessage}`,
    `Blue response: ${args.assistantMessage}`,
  ].join('\n');

  const response = await callElizaCloud([
    {
      role: 'system',
      content: BLUE_MEMORY_EXTRACTION_PROMPT,
    },
    {
      role: 'user',
      content: extractionInput,
    },
  ]);

  const parsed = tryParseJsonObject<{ facts?: Array<{ category?: string; summary?: string; confidence?: number }> }>(response);
  const facts = Array.isArray(parsed?.facts) ? parsed.facts : [];

  return facts
    .map((fact) => ({
      category: fact.category,
      summary: typeof fact.summary === 'string' ? fact.summary.trim() : '',
      confidence: typeof fact.confidence === 'number' ? fact.confidence : 0.5,
    }))
    .filter((fact) => (
      fact.summary
      && ['preference', 'goal', 'theme', 'follow_up', 'identity', 'habit'].includes(String(fact.category))
    )) as Array<{
      category: 'preference' | 'goal' | 'theme' | 'follow_up' | 'identity' | 'habit';
      summary: string;
      confidence: number;
    }>;
}

function buildBlueDebugInfo(args: {
  mode: 'chat' | 'research' | 'auto-distribution';
  shardsDeducted: number;
  contextValues: Awaited<ReturnType<typeof buildBlueContext>>['values'];
  extractedFactsCount: number;
  pathname: string | null;
  retrievedEntries: RetrievedEntry[];
}): BlueDebugInfo {
  return {
    source: 'eliza',
    mode: args.mode,
    shardsDeducted: args.shardsDeducted,
    memory: {
      recentMessages: args.contextValues.recentMessages.length,
      recentFacts: args.contextValues.recentFacts.length,
      streak: args.contextValues.morningPages.streak,
      completedQuestCount: args.contextValues.completedQuestCount,
      completedTaskCount: args.contextValues.completedTaskCount,
      sealedWeeks: args.contextValues.sealedWeeks.length,
      highestWeekTouched: args.contextValues.highestWeekTouched,
    },
    extractedFactsCount: args.extractedFactsCount,
    rag: {
      pathname: args.pathname,
      entriesRetrieved: args.retrievedEntries.length,
      entries: args.retrievedEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        score: Number(entry.score.toFixed(2)),
        pageMatch: entry.pageMatch,
        matchedKeywords: entry.matchedKeywords,
      })),
    },
  };
}

async function runBlueMemoryAwareTurn(args: {
  userId: string;
  username?: string | null;
  userMessage: string;
  mode: 'chat' | 'research' | 'auto-distribution';
  attachmentsCount?: number;
  shardsDeducted: number;
  pathname: string | null;
}) {
  const blueContext = await buildBlueContext({
    userId: args.userId,
    username: args.username ?? null,
  });

  const retrievedEntries = retrieveBlueKnowledge({
    message: args.userMessage,
    pathname: args.pathname,
    limit: 5,
  });
  const knowledgeText = formatKnowledgeForPrompt(retrievedEntries);

  const response = await callElizaCloud(buildBlueChatMessages({
    systemPrompt:
      args.mode === 'research'
        ? RESEARCH_SYSTEM_PROMPT
        : args.mode === 'auto-distribution'
          ? AUTO_DISTRIBUTION_SYSTEM_PROMPT
          : BLUE_SYSTEM_PROMPT,
    userMessage: args.userMessage,
    contextText: blueContext.contextText,
    knowledgeText,
    pathname: args.pathname,
    recentMessages: blueContext.values.recentMessages,
  }));

  let extractedFactsCount = 0;

  try {
    const userChatMessage = await storeBlueChatMessage({
      userId: args.userId,
      role: 'user',
      text: args.userMessage,
      metadata: {
        mode: args.mode,
        attachmentCount: args.attachmentsCount ?? 0,
      },
    });

    await storeBlueChatMessage({
      userId: args.userId,
      role: 'assistant',
      text: response,
      metadata: {
        mode: args.mode,
      },
    });

    await touchBlueRelationship({
      userId: args.userId,
      lastUserMessage: args.userMessage,
      lastBlueResponse: response,
    });

    const extractedFacts = await extractBlueMemories({
      userMessage: args.userMessage,
      assistantMessage: response,
    });

    extractedFactsCount = extractedFacts.length;

    if (extractedFacts.length) {
      await upsertBlueFacts({
        userId: args.userId,
        sourceMessageId: userChatMessage.id,
        facts: extractedFacts,
      });
    }
  } catch (memoryError: unknown) {
    const msg = memoryError instanceof Error ? memoryError.message : 'unknown memory error';
    console.error('Blue memory persistence error:', msg);
  }

  return {
    response,
    debug: buildBlueDebugInfo({
      mode: args.mode,
      shardsDeducted: args.shardsDeducted,
      contextValues: blueContext.values,
      extractedFactsCount,
      pathname: args.pathname,
      retrievedEntries,
    }),
  };
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { message: string; mode?: string; attachments?: ChatAttachment[]; pathname?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter((attachment) => (
      attachment
      && typeof attachment.url === 'string'
      && typeof attachment.mime === 'string'
      && isSafeUploadUrl(attachment.url)
    ))
    : [];

  const isResearch = body.mode === 'research';
  const isAutoDistribution = body.mode === 'auto-distribution';
  const pathname = typeof body.pathname === 'string' && body.pathname.trim().length
    ? body.pathname.trim().slice(0, 256)
    : null;

  if (!ELIZA_API_KEY && !DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: 'ai_unconfigured', message: 'No AI provider configured (DEEPSEEK_API_KEY or ELIZA_API_KEY).' },
      { status: 503 }
    );
  }

  // Research mode fallback: synthesize from training (no x402 fetch here)
  if (isResearch) {
    try {
      const result = await runBlueMemoryAwareTurn({
        userId: user.id,
        username: user.username ?? null,
        userMessage: body.message,
        mode: 'research',
        attachmentsCount: attachments.length,
        shardsDeducted: 0,
        pathname,
      });
      return NextResponse.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI error';
      console.error('Blue research error:', msg);
      return NextResponse.json({ error: 'ai_unavailable', message: msg }, { status: 502 });
    }
  }

  // Normal chat: check shard balance
  const rows = await sqlQuery<Array<{ shard_count: number }>>(
    'SELECT shard_count FROM users WHERE id = :id LIMIT 1',
    { id: user.id }
  );
  if (!rows.length) {
    return NextResponse.json({
      error: 'user_not_found',
      message: 'User record not found for the current session.',
    }, { status: 404 });
  }
  const shardCount = rows[0].shard_count ?? 0;

  if (shardCount < SHARD_COST) {
    return NextResponse.json({
      error: 'insufficient_shards',
      shardCount,
      cost: SHARD_COST,
    }, { status: 402 });
  }

  // Deduct shards atomically
  const updated = await sqlQuery<Array<{ shard_count: number }>>(
    `UPDATE users SET shard_count = shard_count - :cost
     WHERE id = :id AND shard_count >= :cost
     RETURNING shard_count`,
    { id: user.id, cost: SHARD_COST }
  );

  if (!updated.length) {
    return NextResponse.json({
      error: 'insufficient_shards',
      shardCount,
      cost: SHARD_COST,
    }, { status: 402 });
  }

  try {
    const result = await runBlueMemoryAwareTurn({
      userId: user.id,
      username: user.username ?? null,
      userMessage: body.message,
      mode: isAutoDistribution ? 'auto-distribution' : 'chat',
      attachmentsCount: attachments.length,
      shardsDeducted: SHARD_COST,
      pathname,
    });

    return NextResponse.json({
      response: result.response,
      debug: result.debug,
      shardsRemaining: updated[0].shard_count,
      shardsDeducted: SHARD_COST,
    });
  } catch (err: unknown) {
    // Refund shards on failure
    await sqlQuery(
      'UPDATE users SET shard_count = shard_count + :cost WHERE id = :id',
      { id: user.id, cost: SHARD_COST }
    );

    const msg = err instanceof Error ? err.message : 'AI error';
    console.error('Blue chat error:', msg);
    return NextResponse.json({ error: 'ai_unavailable', message: msg }, { status: 502 });
  }
}
