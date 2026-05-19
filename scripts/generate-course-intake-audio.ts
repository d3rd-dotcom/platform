import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTAKE_QUESTIONS } from '../components/course-intake/intakeQuestions';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');

async function loadEnvFile(fileName: string) {
  const filePath = path.join(rootDir, fileName);
  try {
    const raw = await readFile(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Env files are optional; deployed environments can pass variables directly.
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';

  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY.');
  }

  if (!voiceId) {
    throw new Error('Missing ELEVENLABS_VOICE_ID.');
  }

  for (const question of INTAKE_QUESTIONS) {
    if (!question.audioSrc) continue;

    const relativePath = question.audioSrc.replace(/^\/+/, '');
    const outputPath = path.join(rootDir, 'public', relativePath);

    if (!force && await fileExists(outputPath)) {
      console.log(`Skipped existing public/${relativePath}`);
      continue;
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: question.blueText,
          model_id: modelId,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs failed for ${question.key}: ${response.status} ${body.slice(0, 240)}`);
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    console.log(`Generated public/${relativePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
