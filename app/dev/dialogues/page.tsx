'use client';

/**
 * DEV ONLY harness for the full-screen BlueDialogue overlay.
 * No auth, plain page. Not linked from anywhere in the product.
 */

import { useState } from 'react';
import BlueDialogue, { type BlueEmotion } from '@/components/blue-dialogue/BlueDialogue';
import styles from './page.module.css';

interface Scenario {
  id: string;
  label: string;
  lines: string[];
  emotion?: BlueEmotion;
  reward?: number;
}

const LONG_TEXT =
  'This is a deliberately long line meant to test how the dialogue box handles overflow and wrapping across many words. ' +
  'When Blue has a lot to say the box should grow gracefully, the typewriter should keep pace, and nothing should spill past the rounded border. ' +
  'It keeps going, and going, and going, so we can watch the layout stay calm under pressure. ' +
  'On mobile this same block should clamp its padding down and remain fully readable without horizontal scroll.';

const SCENARIOS: Scenario[] = [
  {
    id: 'diamond-reward',
    label: 'Diamond reward',
    lines: ['Logged it. You are my favorite data point today.'],
    emotion: 'happy',
    reward: 50,
  },
  {
    id: 'guide-complete',
    label: 'Guide complete',
    lines: [
      'Nice work. That guide is logged and I just sent +12 diamonds straight to your wallet. Small consistent wins, that is the whole game.',
    ],
    emotion: 'happy',
  },
  {
    id: 'level-clear',
    label: 'Level clear',
    lines: [
      'Nice work. That guide is logged and I just sent +40 diamonds straight to your wallet. Small consistent wins, that is the whole game.',
      "Hey, just because you got it right, doesn't make you a genius or anything. If you're ready to level-up and try something a bit harder we have the next level of knowledge on this topic unlocked and available for you.",
    ],
    emotion: 'happy',
  },
  {
    id: 'walkthrough-complete',
    label: 'Walkthrough complete',
    lines: [
      'Nice work. That guide is logged and I just sent +80 diamonds straight to your wallet. Small consistent wins, that is the whole game.',
      'You cleared the entire walkthrough. That is a 500+ diamond payout landing in your wallet, and the whole topic tree is yours now. Go pick the next hard thing.',
      'One more thing. I tucked a little bonus on top of the payout. Ten extra diamonds, because finishing deserves a flourish.',
    ],
    emotion: 'happy',
  },
  {
    id: 'multi-line',
    label: 'Multi-line sequence',
    lines: [
      'First line. Use the arrow to advance.',
      'Second line. The typewriter restarts each time.',
      'Third line. This one closes the overlay when you advance past it.',
    ],
    emotion: 'happy',
  },
  {
    id: 'emotion-neutral',
    label: 'Emotion: neutral',
    lines: ['I logged the result. The next step is ready when you are.'],
    emotion: 'neutral',
  },
  {
    id: 'emotion-happy',
    label: 'Emotion: happy',
    lines: ['Feeling great about your progress today.'],
    emotion: 'happy',
  },
  {
    id: 'emotion-angry',
    label: 'Emotion: angry',
    lines: ['That result needs another look. I am holding the reward for now.'],
    emotion: 'angry',
  },
  {
    id: 'emotion-surprised',
    label: 'Emotion: surprised',
    lines: ['That changed the pattern. I did not expect this result.'],
    emotion: 'surprised',
  },
  {
    id: 'emotion-confused',
    label: 'Emotion: confused',
    lines: ['Hmm, that answer was a little unexpected. Let us look again.'],
    emotion: 'confused',
  },
  {
    id: 'emotion-sad',
    label: 'Emotion: sad',
    lines: ['That one stung a bit, but every miss is data. We keep going.'],
    emotion: 'sad',
  },
  {
    id: 'emotion-pain',
    label: 'Emotion: pain',
    lines: ['Ouch. That was a tough one. Take a breath and try once more.'],
    emotion: 'pain',
  },
  {
    id: 'emotion-calm',
    label: 'Emotion: calm',
    lines: ['The review is complete. I saved the result to your record.'],
    emotion: 'calm',
  },
  {
    id: 'long-text',
    label: 'Long-text overflow',
    lines: [LONG_TEXT],
    emotion: 'happy',
  },
];

const CHECKLIST = [
  'Typewriter reveals text character by character.',
  'SKIP jumps to full text; SKIP again closes.',
  'HISTORY toggles a panel listing lines shown this session.',
  'Right arrow advances multi-line, closes on the last line.',
  'ESC closes the overlay.',
  'Backdrop click closes the overlay.',
  'Body scroll is locked while open.',
  'Mobile: box padding + torso clamp down (resize narrow).',
  'Focus lands on the arrow; Tab stays trapped inside.',
];

export default function DevDialoguesPage() {
  const [active, setActive] = useState<Scenario | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.badge}>DEV ONLY</div>
      <h1 className={styles.title}>BlueDialogue harness</h1>
      <p className={styles.subtitle}>
        Click a scenario to open the real full-screen overlay. Not linked from
        the product.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Scenarios</h2>
        <div className={styles.grid}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.scenarioBtn}
              onClick={() => setActive(s)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Verify checklist</h2>
        <ul className={styles.checklist}>
          {CHECKLIST.map((item) => (
            <li key={item} className={styles.checkItem}>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <BlueDialogue
        open={active !== null}
        lines={active?.lines ?? []}
        emotion={active?.emotion}
        reward={active?.reward}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
