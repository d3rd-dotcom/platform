import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PING_TIMEOUT_MS = 8000;
const PING_MODEL = process.env.ELIZA_CHAT_MODEL || 'anthropic/claude-sonnet-4.6';

function maskKey(key: string | undefined | null): string {
  if (!key) return 'missing';
  if (key.length <= 8) return `${key.length} chars`;
  return `${key.slice(0, 4)}…${key.slice(-4)} (len ${key.length})`;
}

function normalizeBaseUrl(raw: string | undefined): string {
  let baseUrl = raw || 'http://localhost:3001';
  baseUrl = baseUrl.replace(/\/+$/, '');
  baseUrl = baseUrl.replace(/\/api\/v1$/, '');
  return baseUrl;
}

export async function GET() {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const rawBase = process.env.ELIZA_API_BASE_URL;
  const rawKey = process.env.ELIZA_API_KEY;
  const baseUrl = normalizeBaseUrl(rawBase);
  const url = `${baseUrl}/api/v1/chat/completions`;

  const env = {
    baseUrlRaw: rawBase || null,
    baseUrlNormalized: baseUrl,
    pingUrl: url,
    model: PING_MODEL,
    apiKeyPresent: Boolean(rawKey),
    apiKeyMasked: maskKey(rawKey),
    apiKeyHasWhitespace: rawKey ? rawKey !== rawKey.trim() : false,
  };

  if (!rawKey) {
    return NextResponse.json({
      ok: false,
      stage: 'pre-flight',
      reason: 'ELIZA_API_KEY is not set in the runtime env.',
      env,
    });
  }

  if (!rawBase) {
    return NextResponse.json({
      ok: false,
      stage: 'pre-flight',
      reason: 'ELIZA_API_BASE_URL is not set — falling back to localhost:3001 which is wrong in production.',
      env,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawKey}`,
        'X-API-Key': rawKey,
      },
      body: JSON.stringify({
        model: PING_MODEL,
        messages: [
          { role: 'user', content: 'Reply with exactly: ok' },
        ],
        max_tokens: 8,
        stream: true,
      }),
    });

    const elapsedMs = Date.now() - startedAt;
    const text = await response.text();
    const preview = text.slice(0, 400);

    return NextResponse.json({
      ok: response.ok,
      stage: 'eliza-response',
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      elapsedMs,
      responsePreview: preview,
      env,
      hint: response.status === 401
        ? 'Eliza returned 401. The key is being sent but rejected. Verify the key in your Eliza Cloud dashboard matches ELIZA_API_KEY exactly (no whitespace, same account as the credits).'
        : response.status === 404
          ? 'Eliza returned 404. The base URL likely points at the wrong host or path.'
          : response.ok
            ? 'Eliza accepted the ping. Key + base URL are valid.'
            : `Eliza returned ${response.status}. Inspect responsePreview for cause.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const aborted = (err as { name?: string })?.name === 'AbortError';
    return NextResponse.json({
      ok: false,
      stage: 'network',
      reason: aborted ? `Timed out after ${PING_TIMEOUT_MS}ms` : message,
      env,
      hint: 'Could not reach the Eliza host at all. Check ELIZA_API_BASE_URL is reachable from the deployment.',
    });
  } finally {
    clearTimeout(timer);
  }
}
