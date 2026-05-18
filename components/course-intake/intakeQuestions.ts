export interface IntakeChoice {
  label: string;
  value: string;
}

export interface IntakeQuestion {
  key: string;
  /** Short label shown in the dashboard / summary. */
  label: string;
  /** What Blue says (and speaks) when asking. */
  blueText: string;
  choices?: IntakeChoice[];
  allowText?: boolean;
  textPlaceholder?: string;
  optional?: boolean;
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    key: 'goal',
    label: 'Focus',
    blueText: 'Hey, let me build your starter course. To begin — what would you like to focus on?',
    choices: [
      { label: 'Creativity', value: 'Creativity' },
      { label: 'Exercise', value: 'Exercise' },
      { label: 'Wellness', value: 'Wellness' },
      { label: 'Healing', value: 'Healing' },
    ],
  },
  {
    key: 'accountability',
    label: 'Accountability',
    blueText: 'Thank you for sharing. How do you feel about accountability?',
    choices: [
      { label: 'Gentle check-ins help', value: 'Gentle check-ins help' },
      { label: 'I like a teammate', value: 'Likes an accountability teammate' },
      { label: "I'm a lone wolf", value: 'Prefers to work solo' },
    ],
  },
  {
    key: 'meetups',
    label: 'Meet-ups',
    blueText: 'Would you like to join live meet-ups with the MWA team?',
    choices: [
      { label: 'Yes, count me in', value: 'Wants MWA team meet-ups' },
      { label: 'Maybe later', value: 'Open to meet-ups later' },
      { label: 'Not for me', value: 'Prefers a self-paced path' },
    ],
  },
  {
    key: 'timeCommitment',
    label: 'Time each day',
    blueText: 'How much time can you give this each day?',
    choices: [
      { label: '10 minutes', value: 'About 10 minutes a day' },
      { label: '30 minutes', value: 'About 30 minutes a day' },
      { label: 'An hour or more', value: 'An hour or more a day' },
    ],
  },
  {
    key: 'experience',
    label: 'Experience',
    blueText: 'Have you done reflective work before, like journaling?',
    choices: [
      { label: "It's new to me", value: 'New to reflective practice' },
      { label: 'A little', value: 'Some experience with reflective practice' },
      { label: 'Often', value: 'Experienced with reflective practice' },
    ],
  },
  {
    key: 'voiceContext',
    label: 'About you',
    blueText: "Last one — tell me as much about you as you'd like me to know. I'll use it to help you best.",
    allowText: true,
    optional: true,
    textPlaceholder: "Type anything you'd like Blue to know...",
  },
];
