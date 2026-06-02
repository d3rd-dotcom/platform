/**
 * One-off smoke test for the Resend integration.
 *
 * It sends a single "Hello World" email so you can confirm your API key works
 * end-to-end before relying on the event-reminder cron.
 *
 * It uses Resend's sandbox sender `onboarding@resend.dev`, which works WITHOUT
 * verifying a domain — but Resend only delivers sandbox mail to the email
 * address your Resend account is registered under. So the recipient must be
 * your own account email (defaults to jquinnmarsh@gmail.com below).
 *
 * Once mentalwealthacademy.net is verified in the Resend dashboard, swap the
 * `from` to research@mentalwealthacademy.net (or set EVENTS_FROM_EMAIL) and you
 * can send to anyone.
 *
 * Setup:  put your key in .env.local as
 *           RESEND_API_KEY=re_your_real_key_here
 * Run:    npx tsx scripts/test-resend.ts
 *         npx tsx scripts/test-resend.ts someone@else.com   (override recipient)
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { Resend } from 'resend';

const API_KEY = process.env.RESEND_API_KEY;
const TO = process.argv[2] || 'jquinnmarsh@gmail.com';
// Sandbox sender — works before any domain is verified.
const FROM = 'onboarding@resend.dev';

async function main() {
  if (!API_KEY) {
    console.error('Missing RESEND_API_KEY. Add it to .env.local:\n  RESEND_API_KEY=re_your_real_key_here');
    process.exit(1);
  }

  const resend = new Resend(API_KEY);

  console.log(`Sending test email from ${FROM} to ${TO} ...`);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
  });

  if (error) {
    console.error('Resend returned an error:', error);
    process.exit(1);
  }

  console.log('Sent. Message id:', data?.id);
  console.log('Check the inbox for', TO, '(and the spam folder just in case).');
}

main().catch((err) => {
  console.error('Unexpected failure:', err);
  process.exit(1);
});
