export interface IntakeChoice {
  label: string;
  value: string;
}

export interface IntakeQuestion {
  key: string;
  /** Short label shown in the "your answers" summary. */
  label: string;
  /** What Blue says when asking. */
  blueText: string;
  choices?: IntakeChoice[];
  allowText?: boolean;
  /** Small label above the free-text field. */
  textPrompt?: string;
  textPlaceholder?: string;
  optional?: boolean;
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    key: 'goal',
    label: 'Focus',
    blueText:
      'Hey, let me build your starter course. To begin, what would you like to focus on?',
    choices: [
      { label: 'A creative practice', value: 'A creative practice' },
      { label: 'Mental clarity and focus', value: 'Mental clarity and focus' },
      { label: 'Daily habits and routine', value: 'Building daily habits and routine' },
      { label: 'Self-trust and healing', value: 'Self-trust and healing' },
    ],
    textPlaceholder: 'What would you like to focus on?',
  },
  {
    key: 'accountability',
    label: 'Staying on track',
    blueText:
      'thank you for sharing that. everyone keeps going in their own way — what tends to help you stay with something?',
    choices: [
      { label: 'I do better on my own', value: 'Prefers to work solo' },
      { label: 'Gentle check-ins help me', value: 'Likes gentle weekly check-ins' },
      { label: 'I like sharing with others', value: 'Likes sharing progress with a community' },
    ],
  },
  {
    key: 'meetups',
    label: 'Meet-ups',
    blueText:
      "the mwa team holds live meet-ups from time to time. they're always optional — would you like me to include them?",
    choices: [
      { label: "Yes, I'd like that", value: 'Wants MWA team meet-ups included' },
      { label: 'Maybe later', value: 'Open to meet-ups later' },
      { label: "I'd rather not", value: 'Prefers a self-paced path without meet-ups' },
    ],
  },
  {
    key: 'timeCommitment',
    label: 'Time each day',
    blueText:
      "how much time feels realistic for you on most days? it's completely okay to start small.",
    choices: [
      { label: 'A little — around 10 minutes', value: 'About 10 minutes a day' },
      { label: 'Some — around 30 minutes', value: 'About 30 minutes a day' },
      { label: 'More — an hour or so', value: 'An hour or more a day' },
    ],
  },
  {
    key: 'experience',
    label: 'Experience',
    blueText:
      'have you spent much time with reflective practices, like journaling? either answer is welcome.',
    choices: [
      { label: "It's fairly new to me", value: 'New to reflective practice' },
      { label: "I've tried it here and there", value: 'Some experience with reflective practice' },
      { label: "It's a regular part of my life", value: 'Experienced with reflective practice' },
    ],
  },
  {
    key: 'tone',
    label: 'How Blue speaks',
    blueText: 'how would you like me to show up for you as we go?',
    choices: [
      { label: 'Gently and patiently', value: 'Gentle and patient' },
      { label: 'Honestly and directly', value: 'Honest and direct' },
      { label: 'Warmly and lightly', value: 'Warm and light' },
    ],
  },
  {
    key: 'anythingElse',
    label: 'Anything else',
    blueText:
      "last one — is there anything else you'd like me to know? a hope, a worry, anything on your mind. you're welcome to skip this.",
    allowText: true,
    optional: true,
    textPlaceholder: "Share whatever feels right — or skip this question.",
  },
];
