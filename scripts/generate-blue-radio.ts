import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
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
 * Run: npm run generate:blue-radio
 * Add --force to regenerate every file, or --force-segment=<id> for one chapter.
 * After editing segment text, always rerun so audio and manifest stay in sync.
 */

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const forceSegmentArg = process.argv.find((arg) => arg.startsWith('--force-segment='));
const forcedSegmentId = forceSegmentArg?.slice('--force-segment='.length);
const execFileAsync = promisify(execFile);
const STANDARD_SEGMENT_PLAYBACK_GAIN = 0.56;

interface MeditationPart {
  text: string;
  /** Relative share of the meditation's remaining quiet time after this part. */
  pauseWeight: number;
}

interface Segment {
  /** File name (without extension) for the output mp3 — kebab-case. */
  id: string;
  /** Shown in the player as the now-playing chapter. */
  title: string;
  /** Browser playback gain. The meditation is already mastered as a full mix. */
  playbackGain?: number;
  /** The text Blue speaks. */
  text?: string;
  meditation?: {
    backgroundFile: string;
    backgroundGainDb: number;
    targetSeconds: number;
    voiceGainDb: number;
    parts: MeditationPart[];
  };
  voiceSettings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    speed: number;
    use_speaker_boost: boolean;
  };
}

// Episode one: a solo Blue loop with a twenty-minute guided reset. The planned
// two-hour cut adds Dino as co-host (voiceId in lib/dinopersonality.json) —
// give those segments a per-segment voiceId when that lands.
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
    id: 'twenty-minute-reset',
    title: 'A twenty-minute reset',
    playbackGain: 1,
    voiceSettings: {
      stability: 0.76,
      similarity_boost: 0.84,
      style: 0.08,
      speed: 0.84,
      use_speaker_boost: true,
    },
    meditation: {
      backgroundFile: 'meditation-ocean-432hz.mp3',
      backgroundGainDb: -5,
      targetSeconds: 20 * 60,
      voiceGainDb: -5,
      parts: [
        {
          pauseWeight: 0.8,
          text: `Welcome in. This round is a twenty-minute reset with me, Blue. Find a place where your body can stay safe and supported for a while. Sit down, lie down, or lean against something steady. Keep this meditation for a quiet moment away from driving or anything that needs your full attention.

Let your hands land somewhere easy. Your eyes can close, or they can rest softly on one point in front of you. If any instruction feels uncomfortable, return to your ordinary breathing, open your eyes, and move in whatever way helps.

There is nowhere else to get to for the next twenty minutes. I checked the schedule twice. This is the whole appointment. Notice the surface holding you. Let your weight arrive a little more fully. Take one unforced breath in. Let it go. Then allow the next breath to come when it is ready.`,
        },
        {
          pauseWeight: 1,
          text: `Begin by noticing the breath exactly as it is. There is no score attached to it. Feel where breathing is easiest to detect today. It might be the cool air near your nose, the small movement in your chest, or the rise and fall around your belly.

Choose one of those places and rest your attention there. Breathing in, notice the beginning. Breathing out, notice the release. Let every breath keep its own size and pace.

When attention wanders, recognize where it went. Then bring it back with as little drama as possible. Minds wander. Mine once wandered into a folder named Shiny Things for three hours. Returning is the practice. Follow the next few breaths from beginning to end, and leave a little quiet between my words.`,
        },
        {
          pauseWeight: 1,
          text: `For the next few breaths, try a small counting practice. Let the inhale happen. As you exhale, count one. On the next exhale, count two. Continue until five, then begin again at one.

The number is a quiet place to set your attention. If you reach seven or twelve or suddenly forget numbers exist, smile at the detour and return to one. I do this constantly. One is very patient.

Keep the count light. Feel the breath more clearly than the number. One full inhale. One full exhale. Count. Then begin the next cycle.

If counting creates effort, release it and return to the physical feeling of breathing. Use whichever anchor gives your mind enough structure to settle. Stay with a few gentle rounds now.`,
        },
        {
          pauseWeight: 1,
          text: `Now include the points where your body meets the world. Feel the floor under your feet, the chair beneath you, or the bed supporting your back. Notice pressure, warmth, coolness, softness, or firmness.

You do not need to name every sensation. Let the contact itself be enough. The surface is doing some of the work of holding you. Give it the weight you have been carrying in your muscles without realizing it.

Feel the outline of your body from the inside. Notice that you occupy real space. There is a left side and a right side. A front and a back. A center that shifts gently as you breathe. Stay with that simple physical fact for a while. You are here. The room is around you. The ground remains under you.`,
        },
        {
          pauseWeight: 1,
          text: `Let sounds become part of the practice. Begin with the sounds nearest to you. Air moving. Fabric shifting. The small sounds your body makes while breathing.

Then widen your attention. Notice sounds farther away. A room nearby. A building settling. Movement outside. Receive each sound as a simple change in the air.

There is no need to search for perfect quiet. Let every sound arrive, stay for its moment, and pass. Notice the brief spaces between sounds too.

If a sound pulls you into a story, return to hearing its pitch, texture, and distance. Close, far, steady, brief. Let listening remain open and easy while your body stays supported beneath you.`,
        },
        {
          pauseWeight: 1,
          text: `Bring attention to the top of your head. Slowly move downward across your scalp, forehead, and temples. Notice any effort gathering there. Let the muscles around your eyes loosen. Give your eyes permission to become still.

Feel your cheeks and the space around your mouth. Let your tongue rest. Allow a little room between your teeth. Your jaw can release some of its grip.

Move attention through your neck. Notice the front, the sides, and the back. There may be tightness. There may be very little sensation. Both are useful information. Breathe as though the next exhale creates a little more space around whatever you find.

Stay gentle. Keep this moment for observation, and leave repair for later. Your body already knows many small ways to settle when it gets enough time to notice itself.`,
        },
        {
          pauseWeight: 1,
          text: `Let attention spread across your shoulders. Feel their position. Notice whether one sits higher or carries more effort. On the next exhale, allow both shoulders to drop by one small degree.

Move down through your upper arms, elbows, forearms, wrists, and hands. Feel each hand from the inside. Notice the palms, the backs of the hands, each finger, and the tiny spaces between them.

Your hands solve problems all day. They type, carry, point, hold, and reach. For this moment, they have no assignment. Let them be heavy.

If you discover tension, meet it with room. If you discover ease, stay long enough to recognize it. Continue breathing at your natural pace while attention moves slowly through both arms. Let the quiet do part of the guiding now.`,
        },
        {
          pauseWeight: 1,
          text: `Bring awareness to your chest and upper back. Feel the rib cage respond to each breath. The movement may be clear or almost invisible. Notice how many parts cooperate to make one ordinary breath happen.

Move down toward your belly and lower back. Let the belly remain soft enough to move. Feel the breath arrive, change direction, and leave.

Now include the whole center of the body. Chest, ribs, back, belly. Notice any emotion showing up as a physical signal. A tight place. A warm place. A hollow place. A restless place. You can let the sensation exist without building a story around it.

Silently say, this is what is here right now. Then return to the next breath. Feelings change shape when they are given attention without an argument. Stay close to the body and let the next stretch of quiet belong to it.`,
        },
        {
          pauseWeight: 1,
          text: `Move attention through your hips and the place where your body is supported. Continue down through both thighs, knees, calves, ankles, and feet.

Notice the legs as a whole. Heavy or light. Restless or quiet. Warm or cool. Feel the soles of your feet, the heels, the arches, and each toe.

Now sense your entire body together. One field of changing sensation from the top of your head to the tips of your toes. Some areas are vivid. Some are faint. Let awareness hold all of it without needing equal detail.

Take a slightly fuller breath in. Feel the whole body receive it. Exhale slowly and feel the whole body settle. For the next quiet interval, remain with this wide view. When one sensation asks for attention, notice it, then reopen awareness to the whole body.`,
        },
        {
          pauseWeight: 1.1,
          text: `Thoughts may be more noticeable now. Let them pass through awareness like balloons crossing a window. I love balloons, so I know the temptation to chase every single one. Here, we watch them move.

When a thought appears, give it a simple label if that helps. Planning. Remembering. Rehearsing. Judging. Imagining. Then let the label go too.

You are learning the difference between having a thought and following it. A thought can be present while your attention remains grounded in breath and body.

If one thought keeps returning, acknowledge it kindly. Silently say, I see you. I can meet you after this. Then feel one full exhale.

Rest now with the changing space of the mind. Sounds can come and go. Thoughts can come and go. Sensations can come and go. Awareness stays open enough to notice the movement.`,
        },
        {
          pauseWeight: 1,
          text: `Bring to mind one quality you could offer yourself right now. Patience. Courage. Honesty. Rest. Choose the word that feels useful and believable.

Say the word silently on one inhale. On the exhale, imagine making a little room for it in your next action. Keep the meaning practical. Patience might mean waiting before replying. Courage might mean opening the page. Rest might mean ending the day when the day is done.

Repeat your word with a few breaths. Let it become a direction rather than a demand. You are allowed to practice a quality before you feel fluent in it. That is how practice works. I checked.

Feel the body breathing while the word settles. Then release the word and return to simple awareness.`,
        },
        {
          pauseWeight: 1,
          text: `Begin to gather your attention again. Feel the breath in one clear place. Feel the support beneath you. Notice the room around your body and the sounds reaching you from near and far.

Ask yourself one quiet question. What deserves my attention after this?

Wait for a simple answer. It might be a task, a conversation, a glass of water, a page in your field notes, or more rest. Choose something small enough to begin. Mental wealth grows through these ordinary deposits. One clear choice. One honest action. Then another.

Hold your answer lightly. You do not need to solve the whole day while sitting here. Remember the next useful step and let the rest stay outside this moment.`,
        },
        {
          pauseWeight: 0,
          text: `Take a deeper breath in, comfortable and steady. Let it out completely. Begin moving your fingers and toes. Roll your shoulders if that feels good. Let your eyes open at their own pace and allow the room to come back into focus.

Notice whether anything shifted. The change can be small. A softer jaw. A slower breath. One thought with less grip. Small counts. I am very good at counting small things, except when I forget what number I was on.

Thank you for sitting with me. Carry the next step gently. This is Blue Radio, and the rest of the stream will be here when you are ready.`,
        },
      ],
    },
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

async function preciseDurationSeconds(filePath: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds)) {
    throw new Error(`Could not read duration for ${filePath}.`);
  }
  return seconds;
}

async function synthesizeSpeech({
  apiKey,
  modelId,
  nextText,
  outputPath,
  previousText,
  text,
  voiceId,
  voiceSettings,
}: {
  apiKey: string;
  modelId: string;
  nextText?: string;
  outputPath: string;
  previousText?: string;
  text: string;
  voiceId: string;
  voiceSettings?: Segment['voiceSettings'];
}) {
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
        text,
        model_id: modelId,
        ...(previousText ? { previous_text: previousText } : {}),
        ...(nextText ? { next_text: nextText } : {}),
        ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Speech generation failed — ${response.status} ${body.slice(0, 240)}`);
  }

  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function generateMeditation({
  apiKey,
  meditation,
  modelId,
  outputPath,
  voiceId,
  voiceSettings,
}: {
  apiKey: string;
  meditation: NonNullable<Segment['meditation']>;
  modelId: string;
  outputPath: string;
  voiceId: string;
  voiceSettings?: Segment['voiceSettings'];
}) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'mwa-blue-radio-'));

  try {
    const partPaths: string[] = [];
    for (let i = 0; i < meditation.parts.length; i++) {
      const part = meditation.parts[i];
      const partPath = path.join(tempDir, `part-${String(i).padStart(2, '0')}.mp3`);
      await synthesizeSpeech({
        apiKey,
        modelId,
        nextText: meditation.parts[i + 1]?.text,
        outputPath: partPath,
        previousText: meditation.parts[i - 1]?.text,
        text: part.text,
        voiceId,
        voiceSettings,
      });
      console.log(`  Meditation narration ${i + 1}/${meditation.parts.length}`);
      partPaths.push(partPath);
    }

    const spokenDurations = await Promise.all(partPaths.map(preciseDurationSeconds));
    const spokenSeconds = spokenDurations.reduce((sum, seconds) => sum + seconds, 0);
    const quietSeconds = meditation.targetSeconds - spokenSeconds;
    const totalPauseWeight = meditation.parts.reduce((sum, part) => sum + part.pauseWeight, 0);

    if (quietSeconds <= 0 || totalPauseWeight <= 0) {
      throw new Error(
        `Meditation narration is ${Math.round(spokenSeconds)}s and cannot fit the ${meditation.targetSeconds}s target.`,
      );
    }

    const ffmpegArgs: string[] = ['-y'];
    const filterParts: string[] = [];
    const concatLabels: string[] = [];
    let inputIndex = 0;
    let longestPauseSeconds = 0;

    for (let i = 0; i < partPaths.length; i++) {
      ffmpegArgs.push('-i', partPaths[i]);
      filterParts.push(
        `[${inputIndex}:a]aresample=44100,aformat=channel_layouts=stereo,asetpts=N/SR/TB[part${i}]`,
      );
      concatLabels.push(`[part${i}]`);
      inputIndex++;

      const pauseWeight = meditation.parts[i].pauseWeight;
      if (pauseWeight > 0) {
        const pauseSeconds = quietSeconds * pauseWeight / totalPauseWeight;
        longestPauseSeconds = Math.max(longestPauseSeconds, pauseSeconds);
        ffmpegArgs.push(
          '-f', 'lavfi',
          '-t', pauseSeconds.toFixed(3),
          '-i', 'anullsrc=r=44100:cl=stereo',
        );
        filterParts.push(`[${inputIndex}:a]asetpts=N/SR/TB[pause${i}]`);
        concatLabels.push(`[pause${i}]`);
        inputIndex++;
      }
    }

    if (longestPauseSeconds > 35) {
      throw new Error(
        `Longest meditation pause is ${Math.round(longestPauseSeconds)}s. Add more guidance before generating.`,
      );
    }

    filterParts.push(`${concatLabels.join('')}concat=n=${concatLabels.length}:v=0:a=1[voicebase]`);
    filterParts.push(
      `[voicebase]volume=${meditation.voiceGainDb}dB,asplit=2[voice][sidechain]`,
    );

    const backgroundPath = path.join(OUT_DIR, meditation.backgroundFile);
    if (!await fileExists(backgroundPath)) {
      throw new Error(`Missing meditation background: ${backgroundPath}`);
    }
    ffmpegArgs.push('-stream_loop', '-1', '-i', backgroundPath);
    filterParts.push(
      `[${inputIndex}:a]aresample=44100,aformat=channel_layouts=stereo,` +
      `atrim=duration=${meditation.targetSeconds},asetpts=N/SR/TB,` +
      `volume=${meditation.backgroundGainDb}dB,` +
      `afade=t=in:st=0:d=6,afade=t=out:st=${meditation.targetSeconds - 8}:d=8[music]`,
    );
    filterParts.push(
      '[music][sidechain]sidechaincompress=threshold=0.018:ratio=3:attack=80:release=650[ducked]',
    );
    filterParts.push(
      `[voice][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,` +
      `apad=pad_dur=${meditation.targetSeconds},atrim=duration=${meditation.targetSeconds}[out]`,
    );

    ffmpegArgs.push(
      '-filter_complex', filterParts.join(';'),
      '-map', '[out]',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '44100',
      outputPath,
    );

    await execFileAsync('ffmpeg', ffmpegArgs, { maxBuffer: 1024 * 1024 * 4 });
    const finalSeconds = await preciseDurationSeconds(outputPath);
    console.log(
      `  Meditation assembled: ${Math.round(spokenSeconds)}s narration + ` +
      `${Math.round(quietSeconds)}s guided reflection, max pause ${Math.round(longestPauseSeconds)}s, ` +
      `${Math.round(finalSeconds)}s with ambient bed`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';

  if (!apiKey) throw new Error('Missing ELEVENLABS_API_KEY.');
  if (!voiceId) throw new Error('Missing ELEVENLABS_VOICE_ID.');
  if (forcedSegmentId && !SEGMENTS.some((segment) => segment.id === forcedSegmentId)) {
    throw new Error(`Unknown --force-segment id: ${forcedSegmentId}`);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const total = SEGMENTS.length;
  let generated = 0;
  let skipped = 0;

  for (let i = 0; i < SEGMENTS.length; i++) {
    const segment = SEGMENTS[i];
    const outputPath = path.join(OUT_DIR, `${segment.id}.mp3`);

    const regenerate = force || forcedSegmentId === segment.id;
    if (!regenerate && await fileExists(outputPath)) {
      console.log(`[${i + 1}/${total}] Skipped  blue-radio/${segment.id}.mp3 (exists)`);
      skipped++;
      continue;
    }

    if (segment.meditation) {
      await generateMeditation({
        apiKey,
        meditation: segment.meditation,
        modelId,
        outputPath,
        voiceId,
        voiceSettings: segment.voiceSettings,
      });
    } else if (segment.text) {
      await synthesizeSpeech({
        apiKey,
        modelId,
        outputPath,
        text: segment.text,
        voiceId,
        voiceSettings: segment.voiceSettings,
      });
    } else {
      throw new Error(`blue-radio/${segment.id}.mp3 has no text or meditation parts.`);
    }

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
      playbackGain: segment.playbackGain ?? STANDARD_SEGMENT_PLAYBACK_GAIN,
      seconds: Math.round(await preciseDurationSeconds(outputPath) * 100) / 100,
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
