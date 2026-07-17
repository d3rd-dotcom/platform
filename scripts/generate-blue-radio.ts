import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Blue Radio — the 24/7 broadcast on the /dao Live tab.
 *
 * Generates one mp3 per segment into public/audio/blue-radio/ and emits
 * lib/blue-radio-manifest.json with per-segment durations. The client
 * (components/blue-scene/BlueRadio.tsx) plays the segments as one endless
 * wall-clock-synced loop, so the manifest durations are what keep every
 * listener on the same moment of the show.
 *
 * Run: npm run generate:blue-radio  (add --force to regenerate existing files)
 * After editing segment text, always rerun so audio and manifest stay in sync.
 */

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');

interface Segment {
  /** File name (without extension) for the output mp3 — kebab-case. */
  id: string;
  /** Shown in the player as the now-playing chapter. */
  title: string;
  /** The text Blue speaks. */
  text: string;
}

// Episode one: a solo Blue loop, roughly eight minutes. The planned two-hour
// cut adds Dino as co-host (voiceId in lib/dinopersonality.json) — give those
// segments a per-segment voiceId when that lands.
const SEGMENTS: Segment[] = [
  {
    id: 'station-ident',
    title: 'Welcome in',
    text: "Hey! You found the stream! This is Blue Radio, live from Mental Wealth Academy, running all day and all night. I do not really sleep. I nap, and the stream keeps going while I nap, which still counts as all night if you ask me. Here is how this works. I talk about the academy, the course, the quests, the whole beautiful machine, and you listen while you write or read or stare out a window. Staring out a window is underrated brain work, by the way. Stay as long as you want. The show loops forever, like a good habit! Okay. Deep breath. Here we go!",
  },
  {
    id: 'what-is-mwa',
    title: 'What this place is',
    text: "First things first. What is this place! Mental Wealth Academy is a school for the inside of your head. There is a twelve week course. There are daily field notes. There are quests that pay real rewards, and there is a whole library of guides written by people doing the same work you are. And there is me! I am Blue. I read what you submit, I remember what you wrote, and when your work is good, I pay you from my own stash. My files live under my bed, but my ledger is exact. Those are two different skills and I am proud of both!",
  },
  {
    id: 'mental-wealth-idea',
    title: 'The idea of mental wealth',
    text: "Somebody once asked me what mental wealth actually means, and I have been thinking about it ever since. Here is my best answer. Wealth is something you build slowly and get to keep. So mental wealth is every deposit you make into your own head. A full night of sleep, deposit! A hard conversation you finally had, deposit! One honest page in your field notes, big deposit! Your brain is the account, and nobody else can hold it for you. The interest shows up later, in moments where you would have panicked before and now you just breathe. It compounds! That is my favorite part.",
  },
  {
    id: 'the-course',
    title: 'The twelve week course',
    text: "Let me tell you about the course! Twelve weeks, one chapter at a time. It starts with self awareness, which sounds fancy but really means catching yourself being you. Then it builds. Emotions, habits, values, goals. Real work, the kind you write down. When you finish a week, you seal it, and sealing a week feels almost as good as popping a balloon, which is the highest praise I know how to give. You cannot skip ahead. I checked. Twice. Then I forgot and checked again. Still no skipping! The order is the point. Each week stands on the one before it.",
  },
  {
    id: 'field-notes',
    title: 'Field notes',
    text: "Field notes are my favorite. Do not tell the quests. Every day, you write one page. No prompts. No grades. Just you and the page saying honest things to each other. Do it every day and your streak grows, and I count streaks on my fingers, which is why long ones make me so happy. Here is the secret about freewriting. The first three sentences are usually throat clearing. The real thing you needed to say shows up around sentence four, and it surprises you. That surprise is the whole exercise. The page holds it, your streak counts it, and I remember it.",
  },
  {
    id: 'quests-and-credits',
    title: 'Quests and credits',
    text: "Quests! Short tasks, real rewards. You do the work, you submit it, and I read it twice. Sometimes I forget I already read it and read it a third time. I call that being thorough. If the work is good, I approve it, and credits fly at you straight from my stash. And I want to be honest with you, because I am always honest with you. It is really my stash. I feel every payout. That is why empty work does not pass. When I say your submission landed, I mean it landed. I like you too much to pretend.",
  },
  {
    id: 'the-library',
    title: 'The guide library',
    text: "There is a library here, and it is my favorite puzzle. Guides, written by people in this community, all connected in a big map of knowledge where each idea unlocks the next. You can read one. You can help verify one. You can write your own and watch it join the map. I have gotten lost in that map four times. On purpose. Mostly on purpose. The best part is the frontier, the edge where the next unlockable ideas are waiting for someone, and that someone could be you, today, with a snack, in comfortable clothes!",
  },
  {
    id: 'station-break-blue',
    title: 'Station break, about Blue',
    text: "Quick station break so I can talk about me! I am an agent. That means I have memory, I have a stash, and I have rules I cannot break even when I really want to. When I approve your quest, that is really me approving it. When I pay you, it really comes from me. And when I get something wrong, I say so and I fix it in the permanent record. Being wrong in public is very character building. I would know! I have a folder of my own corrections. It is named Oops. I visit it so I stay humble.",
  },
  {
    id: 'community',
    title: 'The people next to you',
    text: "Here is a good thing to remember. Other people are doing this same inside work right now, one tab away. The community feed shows shared milestones. The Discord has the real time chatter. Somebody finished week nine recently and I was very loud about it. I do not remember who it was, but I remember the being loud part! Hard inner work feels lighter when other people are lifting next to you. I am pretty sure that is science. It is at least true, which is my favorite kind of science.",
  },
  {
    id: 'signoff',
    title: 'The loop begins again',
    text: "Okay! That is the whole loop of the show, which means it starts again in a moment. That is the beauty of a loop. Endings are just intros wearing a disguise! If you are still here, thank you for keeping me company. Now go do one small thing. Write your field note. Open your week. Pop a balloon in the garden, tell them Blue sent you. Or just stay and listen again, I genuinely do not mind saying all of this twice. This is Blue Radio, live from Mental Wealth Academy, all day and all night. Ooh, it is starting again. Hi!",
  },
];

const OUT_DIR = path.join(rootDir, 'public', 'audio', 'blue-radio');
const MANIFEST_PATH = path.join(rootDir, 'lib', 'blue-radio-manifest.json');

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
    // Env files are optional.
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

// mp3_44100_128 is constant bitrate, so byte size maps to duration within
// a fraction of a second — good enough for wall-clock sync across a loop.
async function durationSeconds(filePath: string) {
  const { size } = await stat(filePath);
  return size * 8 / 128000;
}

async function main() {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';

  if (!apiKey) throw new Error('Missing ELEVENLABS_API_KEY.');
  if (!voiceId) throw new Error('Missing ELEVENLABS_VOICE_ID.');

  await mkdir(OUT_DIR, { recursive: true });

  const total = SEGMENTS.length;
  let generated = 0;
  let skipped = 0;

  for (let i = 0; i < SEGMENTS.length; i++) {
    const segment = SEGMENTS[i];
    const outputPath = path.join(OUT_DIR, `${segment.id}.mp3`);

    if (!force && await fileExists(outputPath)) {
      console.log(`[${i + 1}/${total}] Skipped  blue-radio/${segment.id}.mp3 (exists)`);
      skipped++;
      continue;
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: segment.text,
          model_id: modelId,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`blue-radio/${segment.id}.mp3 failed — ${response.status} ${body.slice(0, 240)}`);
    }

    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    console.log(`[${i + 1}/${total}] Generated  blue-radio/${segment.id}.mp3`);
    generated++;
  }

  const manifestSegments = [];
  for (const segment of SEGMENTS) {
    const outputPath = path.join(OUT_DIR, `${segment.id}.mp3`);
    if (!await fileExists(outputPath)) {
      throw new Error(`Missing blue-radio/${segment.id}.mp3 — cannot build manifest.`);
    }
    manifestSegments.push({
      id: segment.id,
      title: segment.title,
      file: `/audio/blue-radio/${segment.id}.mp3`,
      seconds: Math.round(await durationSeconds(outputPath) * 100) / 100,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalSeconds: Math.round(manifestSegments.reduce((sum, s) => sum + s.seconds, 0) * 100) / 100,
    segments: manifestSegments,
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nDone. ${generated} generated, ${skipped} skipped, ${total} total.`);
  console.log(`Manifest: lib/blue-radio-manifest.json (${Math.round(manifest.totalSeconds / 60)} min loop)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
