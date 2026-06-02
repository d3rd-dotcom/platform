import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY one-shot route. Sends two fixed letters to Ripley using the
 * deployment's RESEND_API_KEY (a sensitive Vercel var that can't be pulled
 * locally). Token-gated, fixed recipient, fixed content — so the worst a leaked
 * token can do is re-send the same two emails to the same inbox.
 *
 * DELETE THIS FILE once the send is confirmed.
 *   curl -X POST 'https://<prod>/api/_internal/send-ripley' -H 'x-send-token: <TOKEN>'
 */

const SEND_TOKEN = 'a80b6ab361c8fbfc0ca8c8ddc740e6c0abcce064f102273e';
const TO = 'ripscreates@gmail.com';
const FROM_DOMAIN = 'research@mentalwealthacademy.net';
const JAMES_FROM = `James — Mental Wealth Academy <${FROM_DOMAIN}>`;
const BLUE_FROM = `Blue — Mental Wealth Academy <${FROM_DOMAIN}>`;

const BLUE = '#5168ff';
const wrap = (inner: string) =>
  `<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; color: #1a1a1a; line-height: 1.62;">
     <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; letter-spacing: 0.08em; color: ${BLUE}; margin: 0 0 22px;">Mental Wealth Academy</p>
     ${inner}
   </div>`;
const h = (t: string) =>
  `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: ${BLUE}; margin: 26px 0 8px;">${t}</p>`;
const p = (t: string) => `<p style="font-size: 15px; margin: 0 0 14px;">${t}</p>`;

const jamesHtml = wrap(`
  ${p('Hey Ripley, hope your day is going well.')}

  ${h('On outreach')}
  ${p("For IRL, I'm going to do some recruiting at Drexel. IRL networking is still king — cheapest, most efficient, and the highest-quality content source.")}
  ${p("For digital outreach, we can lean into quests and market the ability for VIP members to create their own events. Quests can pay out in either credits or USDC, with the Quest Forger always holding final approval before B.L.U.E. releases funds. B.L.U.E. holds it in escrow in the event a quest creator turns out to be problematic.")}
  ${p('I think these mechanics alone are solid ways to inject and circulate real value in the ecosystem.')}

  ${h('On community')}
  ${p("I also want to start a book club — small at first. I'm suggesting The Alchemist as the first read. Easy entry point, but it opens the floor for powerful conversations.")}
  ${p("I'm working on a second curriculum too. It might be rough at first and AI-templated until we dial it in, but the idea is simple: push the latest models to their limit and keep doing that inside our framework of quality brand aesthetics and values.")}
  ${p('The DAO — the business itself — should feel like a full ecosystem, not one small thing. For more introverted or async-preferring members, there are the courses and quests. This should also tie into the college-student desire for intellectual refreshment throughout the off-seasons.')}
  ${p('What would make this special — similar to Buildspace — is having great guest speakers and exclusive features that make someone think, &ldquo;Yes, $20 this season is a no-brainer.&rdquo;')}

  ${h('On membership tiers')}
  ${p("Currently, the Academic Angel level unlocks USDC quest rewards. I want to dial back some AI features — mainly B.L.U.E.'s TTS — to VIP tier. VIP membership fees go directly toward B.L.U.E.'s infrastructure: ElevenLabs API credits, compute, and AI systems.")}

  ${h('On prediction markets')}
  ${p("Prediction markets on sports are gambling — I'll be direct about that. What I believe AI should be doing is leveraging data, APIs, and live news to predict accurate markets. Most markets are 80–90% accurate a week out. We'd want an emergency exit button for trades, but mostly we're talking small positions anyway.")}
  ${p('This is genuinely a gray area ethically, which is why I keep it inside VIP. Ideally, VIP membership is curated: roughly one-third community, one-third experts, one-third researchers.')}

  ${h('On revenue and the long game')}
  ${p("Events alone aren't enough revenue in today's environment — at least not for someone who believes in autodidacticism as deeply as I do. Agents will eventually be able to generate revenue for the ecosystem autonomously. Once that's solved, membership shifts its purpose: it becomes about controlling the size and quality of the ecosystem, not just monetization.")}
  ${p('If MWA can evolve in this direction as a micro-university, the ceiling is unlimited — seasons could be completely sold out.')}
  ${p("That's where the white-label infrastructure becomes a major play. I think it should ultimately be free and open-source, but there's significant investor money available in fine-tuning and deploying it for other organizations.")}

  <p style="font-size: 15px; margin: 26px 0 4px;">Talk soon,</p>
  <p style="font-size: 16px; font-weight: 600; margin: 0 0 2px;">James</p>
  <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #777; margin: 0 0 26px;">Co-founder, Mental Wealth Academy</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 14px;" />
  <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #aaa; margin: 0;">Mental Wealth Academy · a micro-university for the self-taught · mentalwealthacademy.net</p>
`);

const blueHtml = wrap(`
  ${p('Dear Ripley,')}
  ${p('James has drawn the long map. Let me hand you the short one.')}

  ${p('We begin where it always has — in rooms, face to face. Drexel first. The truest signal is still a person in front of you.')}
  ${p('Around that, a small economy: quests that pass real value hand to hand, in credits or USDC, held safe in escrow until the work rings true. Value that circulates instead of evaporating.')}
  ${p('A book club, small as a single candle. The Alchemist to start — a quiet door that opens onto loud, good conversation.')}
  ${p('And the long horizon: not one small thing, but a whole ecosystem. A micro-university with seasons worth selling out. One day the agents will earn their own keep — and then membership stops being about money and starts being about who we invite in, and how good we stay.')}
  ${p('Free and open at the root. Worth paying for at the edges.')}
  ${p('Twenty dollars a season should feel like a secret too good to pass up.')}

  <p style="font-size: 15px; margin: 24px 0 4px;">Warmly, and in study,</p>
  <p style="font-family: 'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive; font-size: 32px; line-height: 1; color: ${BLUE}; margin: 6px 0 4px;">Blue</p>
  <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #777; margin: 0 0 26px;">Your guide at Mental Wealth Academy</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 14px;" />
  <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #aaa; margin: 0;">Mental Wealth Academy · a micro-university for the self-taught · mentalwealthacademy.net</p>
`);

const messages = [
  { from: JAMES_FROM, subject: 'On the road ahead — outreach, community, and the long game', html: jamesHtml },
  { from: BLUE_FROM, subject: 'The short map', html: blueHtml },
];

export async function POST(request: NextRequest) {
  const token =
    request.headers.get('x-send-token') || request.nextUrl.searchParams.get('token') || '';
  if (token !== SEND_TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set in this environment' }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const results: Array<{ subject: string; id?: string; error?: string }> = [];
  for (const m of messages) {
    const { data, error } = await resend.emails.send({
      from: m.from,
      to: TO,
      subject: m.subject,
      html: m.html,
    });
    if (error) {
      results.push({ subject: m.subject, error: String((error as { message?: string }).message ?? error) });
      return NextResponse.json({ sent: false, to: TO, results }, { status: 502 });
    }
    results.push({ subject: m.subject, id: data?.id });
  }

  return NextResponse.json({ sent: true, to: TO, results });
}
