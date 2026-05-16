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

  // Browsers disagree on the recording container — Chrome/Firefox produce
  // audio/webm, Safari produces audio/mp4. ElevenLabs rejects the file when the
  // filename extension doesn't match its real format, so derive both from the
  // actual MIME type rather than trusting a hardcoded name.
  const mimeType = (file.type || 'audio/webm').split(';')[0].trim().toLowerCase();
  const EXT_BY_MIME: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'aac',
  };
  const ext = EXT_BY_MIME[mimeType] || 'webm';
  const audioBlob = new Blob([await file.arrayBuffer()], { type: mimeType });

  const elForm = new FormData();
  elForm.append('file', audioBlob, `recording.${ext}`);
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
      return NextResponse.json(
        { error: 'transcription_failed', message: 'Could not transcribe the recording.', detail: errText.slice(0, 220) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    return NextResponse.json({ text });
  } catch (err) {
    console.error('Transcribe route error:', err);
    return NextResponse.json({ error: 'transcription_failed', message: 'Could not transcribe the recording.' }, { status: 502 });
  }
}
