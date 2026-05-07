import { NextRequest, NextResponse } from 'next/server';
import bluePersona from '@/lib/bluepersonality.json';

const ELIZA_BASE_URL = (process.env.ELIZA_API_BASE_URL || 'https://www.elizacloud.ai').replace(/\/+$/, '');
const ELIZA_API_KEY = process.env.ELIZA_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const blueConfig = bluePersona as {
  settings?: { voice?: { voiceId?: string; model?: string } };
  tts?: { elevenlabs?: { voiceId?: string; modelId?: string } };
};
const BLUE_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ||
  blueConfig.settings?.voice?.voiceId ||
  blueConfig.tts?.elevenlabs?.voiceId ||
  '';
const BLUE_VOICE_MODEL =
  blueConfig.settings?.voice?.model ||
  blueConfig.tts?.elevenlabs?.modelId ||
  'eleven_flash_v2_5';

async function requestElevenLabsTts(text: string, voiceId: string, modelId?: string) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId || BLUE_VOICE_MODEL,
    }),
  });
}

async function requestTts(path: string, text: string, voiceId?: string, modelId?: string) {
  const payload: Record<string, string> = {
    text,
    modelId: modelId || BLUE_VOICE_MODEL,
  };

  if (voiceId) {
    payload.voiceId = voiceId;
  }

  return fetch(`${ELIZA_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ELIZA_API_KEY}`,
      'X-API-Key': ELIZA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function POST(req: NextRequest) {
  if (!ELEVENLABS_API_KEY && !ELIZA_API_KEY) {
    return NextResponse.json({ error: 'TTS not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const text = body?.text;
    const voiceId = typeof body?.voiceId === 'string' ? body.voiceId : undefined;
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;

    if (!text || typeof text !== 'string' || text.length > 5000) {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }

    const resolvedVoiceId = voiceId || BLUE_VOICE_ID || undefined;
    const resolvedModelId = modelId || BLUE_VOICE_MODEL;
    if (ELEVENLABS_API_KEY && resolvedVoiceId) {
      const elevenLabsResponse = await requestElevenLabsTts(text, resolvedVoiceId, resolvedModelId);

      if (elevenLabsResponse.ok) {
        const arrayBuffer = await elevenLabsResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return NextResponse.json({ audio: base64 });
      }

      const errText = await elevenLabsResponse.text();
      console.error('ElevenLabs TTS error:', elevenLabsResponse.status, errText.slice(0, 200));

      if (!ELIZA_API_KEY) {
        return NextResponse.json({ error: 'TTS generation failed' }, { status: elevenLabsResponse.status });
      }
    }

    const attempts: Array<{ label: string; path: string; voiceId?: string }> = [
      { label: 'v1-configured-voice', path: '/api/v1/voice/tts', voiceId: resolvedVoiceId },
      { label: 'v1-default-voice', path: '/api/v1/voice/tts' },
      { label: 'legacy-configured-voice', path: '/api/elevenlabs/tts', voiceId: resolvedVoiceId },
      { label: 'legacy-default-voice', path: '/api/elevenlabs/tts' },
    ];

    let response: Response | null = null;
    let lastStatus = 500;
    let lastErrorText = '';

    for (const attempt of attempts) {
      response = await requestTts(attempt.path, text, attempt.voiceId, resolvedModelId);

      if (response.ok) {
        if (attempt.label !== 'v1-configured-voice') {
          console.warn(`Eliza TTS succeeded via fallback path: ${attempt.label}`);
        }
        break;
      }

      const errText = await response.text();
      lastStatus = response.status;
      lastErrorText = errText;
      console.error(`Eliza TTS attempt failed: ${attempt.label}`, response.status, errText.slice(0, 200));
    }

    if (!response || !response.ok) {
      console.error('Eliza TTS error:', lastStatus, lastErrorText.slice(0, 200));
      return NextResponse.json({ error: 'TTS generation failed' }, { status: lastStatus });
    }

    // Eliza returns streaming audio/mpeg
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return NextResponse.json({ audio: base64 });
  } catch (err) {
    console.error('TTS route error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
