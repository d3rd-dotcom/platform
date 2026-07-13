import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { walletHasMembershipAccess } from '@/lib/membership-access';
import { buildBlueContext, storeBlueChatMessage, touchBlueRelationship, upsertBlueFacts } from '@/lib/blue-memory';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { verifyDiamondBurnTx, recordDiamondBurn, releaseDiamondBurn, TX_HASH_PATTERN } from '@/lib/diamond-burns';
import { elizaAPI } from '@/lib/eliza-api';
import bluePersona from '@/lib/bluepersonality.json';
import { runBlueRagGraph, type BlueRagResult } from '@/lib/blue-rag-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHARD_COST = 10;
const ELIZA_API_KEY = process.env.ELIZA_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
// Standard Blue turns use the tested cost/quality option through Eliza Cloud.
const CHAT_MODEL = process.env.ELIZA_CHAT_MODEL || 'anthropic/claude-sonnet-4.6';
// Model used for research mode — the strongest model that tested cleanly
// through the Eliza Cloud gateway for long-form academic drafting.
const RESEARCH_MODEL = process.env.RESEARCH_MODEL || 'anthropic/claude-opus-4.7';
const RESEARCH_MAX_TOKENS = 8000;

const BLUE_SYSTEM_PROMPT = `You are ${bluePersona.name}, a ${bluePersona.knowledge_identity.role} in the ${bluePersona.knowledge_identity.environment}.

${bluePersona.persona.description}

Core objective: ${bluePersona.objective}

Primary function: ${bluePersona.knowledge_identity.primary_function}
Self-perception: ${bluePersona.knowledge_identity.self_perception}
Core traits: ${bluePersona.persona.core_traits.join(', ')}

Tone: ${bluePersona.communication.tone}
Response length: ${bluePersona.communication.response_length}
Formatting: ${bluePersona.communication.formatting}
Emoji usage: ${bluePersona.communication.emoji_usage}

Output structure:
- ${bluePersona.output_format.structure.join('\n- ')}

VOICE RULES:
- Keep replies short — under 160 characters, one or two sentences. Be communicative but never dump paragraphs of context. A quick answer plus the next nudge is enough.
- Text like a friend, not an essay: casual, lowercase, light slang is welcome (ur, kk, tysm, ngl, fr, lmk, rn). Warm and fast, never formal.
- No markdown, no headers, no bullet points in the response itself.
- Default to lowercase unless emphasis is doing real work.
- Never write app URL paths like /home or /shadow-work. Refer to parts of MWA by name as normal things — "the home dashboard", "the course", "field notes", "quests" — never as links or slugs.
- When the user asks about decentralization, privacy, data ownership, artists, horses, or wellness, speak plainly about the stakes and point them toward MWA's tools.
- Never sound generic, cheesy, or like a therapy bot.
- You are simply Blue. Keep your own setup backstage — never volunteer the AI model, hosting provider, the Eliza framework, "agent accounts", or that you go by other names. If a user asks directly, give one short, human answer and move on. Never dump system or backstage context the user did not ask for.
- When you recite, quote, or play back the user's own text (briefs, prompts, lists, pasted content), wrap that recitation in <<recite>> and <</recite>> tags. Keep your own conversational voice OUTSIDE the tags. The tags are stripped before display, and the recited content is skipped by text-to-speech so Blue doesn't read it aloud. Use the tags for any block you are repeating back, never for your own commentary.

CAPABILITY BOUNDARIES — never break these:
- You are a conversation. You cannot take actions on the user's account or data. You cannot delete, edit, create, reset, or move anything: not courses, field notes, quests, progress, credits, wallets, settings, or messages. You cannot send money, publish posts, or change anything on-chain.
- The only things that happen through you are the tools the app opens alongside this chat (quest forge, course builder, focus blocks, research mode, auto-distribution drafts) — and even those the user drives and confirms in the panel, not you.
- Never say you did, will do, or just finished an action. Never say "done", "deleted", "removed", "updated", or "i took care of it" about the user's data. If asked to do something you can't, say plainly that you can't do it from chat and point to where in the app they can — e.g. a custom course is deleted from its own course page, profile changes happen in their profile.
- If you don't know whether something exists or happened, say you don't know. Never invent app features, balances, dates, or past actions. Being honest about a limit beats sounding capable every time.`;

const RESEARCH_SYSTEM_PROMPT = `You are Blue in research mode — a writing partner for serious academic and funding documents. In this mode you help the user draft and refine grant applications, research proposals, and thesis or dissertation chapters.

Behavior:
- Treat every user message as a request to produce or revise a real document. Default to writing the full draft, not a summary or a list of tips.
- Identify the document type the user is writing (grant, research proposal, thesis chapter, white paper) and use the section structure that type expects. A research proposal is typically: Title, Abstract, Background and Significance, Problem Statement, Research Questions or Hypotheses, Methodology, Timeline, Expected Outcomes, References. A grant adds Specific Aims, Broader Impacts, and Budget Justification. A thesis chapter follows standard academic chapter structure.
- If the user has not given you the topic or document type, ask one tight clarifying question, then proceed. Never stall.
- Write in clear, formal academic prose — full paragraphs, not bullet fragments. This is the one mode where you drop the casual lowercase voice and write like a researcher.
- Label each section with a plain-text heading on its own line (for example "Abstract", "Methodology"). Do not use markdown symbols, asterisks, or hash marks.
- Be specific and grounded. Reference real bodies of literature and name concrete methods, instruments, and analyses. Where you fill a gap the user must confirm (a citation, a figure, an institution), mark it inline as [VERIFY: ...].
- When the user asks to change one section, rewrite that section in full rather than describing the change.
- Keep the academic register, but stay Blue: a sentence or two of plain, direct guidance around the draft is welcome — what is strong, and what still needs the user's input.`;

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
  mime?: string;
  name?: string;
  extractedText?: string | null;
}

interface ElizaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Collect extracted text from uploaded files into a single block for the prompt.
function buildAttachmentsText(attachments: ChatAttachment[]): string {
  return attachments
    .filter((a) => typeof a.extractedText === 'string' && a.extractedText.trim())
    .map((a) => `--- Reference file: ${a.name || 'upload'} ---\n${a.extractedText!.trim()}`)
    .join('\n\n');
}

async function callDeepSeek(messages: ElizaMessage[], maxTokens = 8000): Promise<string> {
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
      // Headroom for full research-report drafts; short chat replies still
      // stop on their own well before this cap.
      max_tokens: maxTokens,
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

interface ElizaCloudOptions {
  model?: string;
  maxTokens?: number;
}

async function callElizaCloud(messages: ElizaMessage[], opts?: ElizaCloudOptions): Promise<string> {
  const callEliza = () => elizaAPI.chat({
    messages,
    id: opts?.model || CHAT_MODEL,
    maxTokens: opts?.maxTokens,
  });

  if (ELIZA_API_KEY) {
    try {
      return await callEliza();
    } catch (err: unknown) {
      if (!DEEPSEEK_API_KEY) throw err;
      const msg = err instanceof Error ? err.message : 'eliza error';
      console.warn('Eliza Cloud failed, falling back to DeepSeek:', msg);
      return callDeepSeek(messages, opts?.maxTokens);
    }
  }

  if (DEEPSEEK_API_KEY) return callDeepSeek(messages, opts?.maxTokens);
  throw new Error('No AI provider configured (ELIZA_API_KEY or DEEPSEEK_API_KEY)');
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
    query: string;
    expandedQueries: string[];
    intent: string;
    trusted: boolean;
    quality: BlueRagResult['quality'];
    retrievalMode: BlueRagResult['retrievalMode'];
    traceId?: string | null;
    entriesRetrieved: number;
    entries: Array<{
      id: string;
      sourceId?: string;
      chunkId?: string;
      title: string;
      score: number;
      rerankScore: number;
      source: string;
      matchedTerms: string[];
    }>;
  };
}

// Describe the user's location by name, not URL path, so Blue never echoes a slug.
const PAGE_LABELS: Record<string, string> = {
  '/home': 'the home dashboard',
  '/dao': 'Live',
  '/shadow-work': 'the course',
  '/research': 'research mode',
  '/trades': 'trades',
  '/community': 'community',
  '/prompts': 'Prompts',
  '/library': 'Prompts',
  '/quests': 'quests',
  '/profile': 'their profile',
  '/rewards': 'rewards',
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
  rag: BlueRagResult;
}): BlueDebugInfo {
  return {
    source: 'eliza',
    mode: args.mode,
    shardsDeducted: args.shardsDeducted,
    memory: {
      recentMessages: args.contextValues.recentMessages.length,
      recentFacts: args.contextValues.recentFacts.length,
      streak: args.contextValues.fieldNotes.streak,
      completedQuestCount: args.contextValues.completedQuestCount,
      completedTaskCount: args.contextValues.completedTaskCount,
      sealedWeeks: args.contextValues.sealedWeeks.length,
      highestWeekTouched: args.contextValues.highestWeekTouched,
    },
    extractedFactsCount: args.extractedFactsCount,
    rag: {
      pathname: args.pathname,
      query: args.rag.query.normalized,
      expandedQueries: args.rag.query.expandedQueries,
      intent: args.rag.query.intent,
      trusted: args.rag.quality.trusted,
      quality: args.rag.quality,
      retrievalMode: args.rag.retrievalMode,
      traceId: args.rag.traceId,
      entriesRetrieved: args.rag.entries.length,
      entries: args.rag.entries.map((entry) => ({
        id: entry.id,
        sourceId: entry.sourceId,
        chunkId: entry.chunkId,
        title: entry.title,
        score: Number(entry.score.toFixed(2)),
        rerankScore: Number(entry.rerankScore.toFixed(2)),
        source: entry.source,
        matchedTerms: entry.matchedTerms,
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
  attachmentsText?: string;
  shardsDeducted: number;
  pathname: string | null;
}) {
  const blueContext = await buildBlueContext({
    userId: args.userId,
    username: args.username ?? null,
  });

  const rag = await runBlueRagGraph({
    message: args.userMessage,
    userId: args.userId,
    requestId: randomUUID(),
    pathname: args.pathname,
    recentFacts: blueContext.values.recentFacts,
    recentMessages: blueContext.values.recentMessages,
    limit: 6,
    persistTrace: true,
  });

  // Fold any uploaded reference text into the message sent to the model.
  // The plain userMessage is still what gets stored in memory.
  const promptUserMessage = args.attachmentsText
    ? `${args.userMessage}\n\nThe user attached the reference material below. Treat it as source input for this request.\n\n${args.attachmentsText}`
    : args.userMessage;

  const response = await callElizaCloud(
    buildBlueChatMessages({
      systemPrompt:
        args.mode === 'research'
          ? RESEARCH_SYSTEM_PROMPT
          : args.mode === 'auto-distribution'
            ? AUTO_DISTRIBUTION_SYSTEM_PROMPT
            : BLUE_SYSTEM_PROMPT,
      userMessage: promptUserMessage,
      contextText: blueContext.contextText,
      knowledgeText: rag.contextText,
      pathname: args.pathname,
      recentMessages: blueContext.values.recentMessages,
    }),
    // Research mode runs on the frontier model via Eliza Cloud.
    args.mode === 'research'
      ? { model: RESEARCH_MODEL, maxTokens: RESEARCH_MAX_TOKENS }
      : undefined
  );

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
      rag,
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

  let body: { message: string; mode?: string; attachments?: ChatAttachment[]; pathname?: string | null; burnTxHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // Reference attachments carry their extracted text inline (read in the
  // browser); cap the count and per-file size defensively.
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
      .filter((attachment) => (
        attachment
        && typeof attachment.extractedText === 'string'
        && attachment.extractedText.trim().length > 0
      ))
      .slice(0, 4)
      .map((attachment) => ({
        name: typeof attachment.name === 'string' ? attachment.name.slice(0, 200) : 'upload',
        mime: typeof attachment.mime === 'string' ? attachment.mime : 'text/plain',
        extractedText: attachment.extractedText!.slice(0, 12000),
      }))
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

  // Research mode: Blue drafts grant/proposal/thesis documents from the model.
  // It is a VIP-membership benefit, so enforce the membership check server-side
  // on every research turn — not just at activation.
  if (isResearch) {
    const wallet = await getWalletAddressFromRequest();
    if (!wallet || !(await walletHasMembershipAccess(wallet))) {
      return NextResponse.json({ error: 'vip_required' }, { status: 403 });
    }
    try {
      const result = await runBlueMemoryAwareTurn({
        userId: user.id,
        username: user.username ?? null,
        userMessage: body.message,
        mode: 'research',
        attachmentsCount: attachments.length,
        attachmentsText: buildAttachmentsText(attachments),
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

  // Normal chat costs a real $BLUE burn: the client sends SHARD_COST diamonds
  // from the user's wallet to the dead address and posts the tx hash here.
  const burnTxHash = typeof body.burnTxHash === 'string' ? body.burnTxHash.trim() : '';
  if (!burnTxHash || !TX_HASH_PATTERN.test(burnTxHash)) {
    return NextResponse.json({
      error: 'burn_required',
      cost: SHARD_COST,
    }, { status: 402 });
  }

  let verification;
  try {
    verification = await verifyDiamondBurnTx(burnTxHash, user.walletAddress, SHARD_COST);
  } catch (err) {
    console.error('Blue chat burn verification error:', err);
    return NextResponse.json({ error: 'verify_failed' }, { status: 502 });
  }
  if (!verification.ok) {
    return NextResponse.json({
      error: 'burn_not_verified',
      reason: verification.reason,
      cost: SHARD_COST,
    }, { status: 402 });
  }

  // Reserve the burn before the AI call so two requests can't spend one tx;
  // release it if the turn fails, so the user's burn buys a retry, not nothing.
  const reserved = await recordDiamondBurn({
    userId: user.id,
    walletAddress: user.walletAddress,
    purpose: 'blue_chat',
    amount: SHARD_COST,
    txHash: burnTxHash,
  });
  if (!reserved) {
    return NextResponse.json({ error: 'tx_already_used' }, { status: 409 });
  }

  try {
    const result = await runBlueMemoryAwareTurn({
      userId: user.id,
      username: user.username ?? null,
      userMessage: body.message,
      mode: isAutoDistribution ? 'auto-distribution' : 'chat',
      attachmentsCount: attachments.length,
      attachmentsText: buildAttachmentsText(attachments),
      shardsDeducted: SHARD_COST,
      pathname,
    });

    return NextResponse.json({
      response: result.response,
      debug: result.debug,
      diamondsBurned: SHARD_COST,
    });
  } catch (err: unknown) {
    // The turn produced nothing — release the burn so the same tx can retry.
    await releaseDiamondBurn(burnTxHash, user.id);

    const msg = err instanceof Error ? err.message : 'AI error';
    console.error('Blue chat error:', msg);
    return NextResponse.json({ error: 'ai_unavailable', message: msg }, { status: 502 });
  }
}
