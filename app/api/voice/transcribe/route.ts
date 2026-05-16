import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const rl = checkRateLimit({
    max: 12,
    windowMs: 10 * 60 * 1000,
    identifier: `transcribe:${getClientIdentifier(request)}`,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many recordings. Try again shortly.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: 'transcription_unconfigured', message: 'Voice transcription is not configured.' },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('audio');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'audio file is empty' }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'audio file too large' }, { status: 413 });
  }

  const elForm = new FormData();
  elForm.append('file', file, file.name || 'recording.webm');
  elForm.append('model_id', 'scribe_v1');

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body: elForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('ElevenLabs STT error:', res.status, errText.slice(0, 220));
      return NextResponse.json({ error: 'transcription_failed', message: 'Could not transcribe the recording.' }, { status: 502 });
    }

    const data = await res.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    return NextResponse.json({ text });
  } catch (err) {
    console.error('Transcribe route error:', err);
    return NextResponse.json({ error: 'transcription_failed', message: 'Could not transcribe the recording.' }, { status: 502 });
  }
}
