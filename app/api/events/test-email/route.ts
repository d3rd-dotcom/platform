import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { sendMeetBlueEmail, isEmailConfigured } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/events/test-email
 * Body: { email: string }
 *
 * Powers the "Meet Blue" card button: sends an instant intro email to the given
 * address — a live prod check of the Resend pipeline. Auth-gated and rate
 * limited so it can't be used to fire mail at arbitrary inboxes.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const rl = checkRateLimit({
    max: 3,
    windowMs: 60 * 1000,
    identifier: `test-email:${getClientIdentifier(request, user.id)}`,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many emails — give it a minute.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Email is not configured (RESEND_API_KEY is missing).' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  const ok = await sendMeetBlueEmail(email);
  if (!ok) {
    return NextResponse.json({ error: 'Could not send the email. Try again.' }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
