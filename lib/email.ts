import { Resend } from 'resend';
import type { EventItem } from './events';

/**
 * Transactional email via Resend.
 *
 * Guarded like the Mailchimp route: if RESEND_API_KEY isn't set (local dev,
 * preview builds), every send is a no-op that logs and returns false rather than
 * throwing — so a missing key never breaks a request or a cron run.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// Must be on a Resend-verified domain. mentalwealthacademy.net is the domain we
// currently control (research@ mailbox); switch to Blue's address once that
// Google account exists and its domain is verified in Resend.
const FROM_EMAIL = process.env.EVENTS_FROM_EMAIL || 'Mental Wealth Academy <research@mentalwealthacademy.net>';
const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://mentalwealthacademy.world';

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

function formatWhen(ev: EventItem): string {
  if (!ev.startsAt) return `${ev.dateLabel} · ${ev.timeLabel}`;
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: 'UTC',
    }).format(new Date(ev.startsAt));
  } catch {
    return `${ev.dateLabel} · ${ev.timeLabel}`;
  }
}

/**
 * Send the day-before reminder for an event the user registered for.
 * Returns true if Resend accepted the message.
 */
export async function sendEventReminderEmail(to: string, ev: EventItem): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping reminder for', ev.id, '->', to);
    return false;
  }

  const when = formatWhen(ev);
  const homeUrl = `${SITE_URL}/courses`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 13px; letter-spacing: 0.04em; color: #5168FF; margin: 0 0 8px;">${ev.category} · reminder</p>
      <h1 style="font-size: 22px; margin: 0 0 12px;">${ev.heading}</h1>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px; color: #333;">${ev.description}</p>
      <table style="font-size: 14px; margin: 0 0 20px;">
        <tr><td style="padding: 2px 12px 2px 0; color: #777;">When</td><td><strong>${when}</strong></td></tr>
        ${ev.location ? `<tr><td style="padding: 2px 12px 2px 0; color: #777;">Where</td><td><strong>${ev.location}</strong></td></tr>` : ''}
      </table>
      <a href="${homeUrl}" style="display: inline-block; background: #5168FF; color: #fff; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">Open your dashboard</a>
      <p style="font-size: 12px; color: #999; margin: 24px 0 0;">You're getting this because you registered for this event on Mental Wealth Academy.</p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Reminder: ${ev.heading} — ${ev.timeLabel}`,
      html,
    });
    if (error) {
      console.error('[email] Resend error for', ev.id, '->', to, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to send reminder for', ev.id, '->', to, err);
    return false;
  }
}

/**
 * Instant "hello from Blue" intro email — powers the Meet Blue card's button.
 * Doubles as a live prod check that the email pipeline reaches an inbox.
 * Returns true if Resend accepted the message.
 */
export async function sendMeetBlueEmail(to: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping Meet Blue email ->', to);
    return false;
  }

  const homeUrl = `${SITE_URL}/courses`;
  // Structured like a short letter from the Academy, signed off by Blue with a
  // cursive signature in the footer (font stack degrades gracefully per client).
  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 520px; margin: 0 auto; color: #1a1a1a; line-height: 1.62;">
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; letter-spacing: 0.08em; color: #5168ff; margin: 0 0 20px;">Mental Wealth Academy</p>

      <p style="font-size: 16px; margin: 0 0 14px;">Dear scholar,</p>

      <p style="font-size: 15px; margin: 0 0 14px;">Welcome. I am Blue, your guide and study companion here at the Academy. It is a quiet pleasure to make your acquaintance.</p>

      <p style="font-size: 15px; margin: 0 0 14px;">My role is a simple one: to keep your learning on course. I will share the sessions and circles on our calendar, and remind you the day before anything you choose to attend, so the work never slips past you.</p>

      <p style="font-size: 15px; margin: 0 0 22px;">Consider this short letter your first piece of correspondence, and proof that my notes will reach your inbox when they matter.</p>

      <p style="font-size: 15px; margin: 0 0 4px;">Warmly, and in study,</p>

      <p style="font-family: 'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive; font-size: 32px; line-height: 1; color: #5168ff; margin: 6px 0 4px;">Blue</p>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #777; margin: 0 0 26px;">Your guide at Mental Wealth Academy</p>

      <a href="${homeUrl}" style="display: inline-block; background: #5168ff; color: #ffffff; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Open your dashboard</a>

      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #999; margin: 28px 0 0;">You received this because you asked Blue to say hello from your Mental Wealth Academy dashboard.</p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'A welcome from Blue — Mental Wealth Academy',
      html,
    });
    if (error) {
      console.error('[email] Resend error for Meet Blue ->', to, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to send Meet Blue email ->', to, err);
    return false;
  }
}
