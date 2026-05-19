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
  /** Static narration file; configured prompts skip generated speech. */
  audioSrc?: string;
  choices?: IntakeChoice[];
  allowText?: boolean;
  textPlaceholder?: string;
  optional?: boolean;
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    key: 'goal',
    label: 'Focus',
    blueText: 'What brings you to this world?',
    audioSrc: '/audio/onboarding/course-intake/goal.mp3',
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
    blueText: 'When you tackle a new problem, what helps you stick with it?',
    audioSrc: '/audio/onboarding/course-intake/accountability.mp3',
    choices: [
      { label: 'Gentle check-ins help', value: 'Gentle check-ins help' },
      { label: 'I like a teammate', value: 'Likes an accountability teammate' },
      { label: "I'm a lone wolf", value: 'Prefers to work solo' },
    ],
  },
  {
    key: 'mood',
    label: 'Check-in',
    blueText: 'How are you feeling overall this week?',
    audioSrc: '/audio/onboarding/course-intake/mood.mp3',
    choices: [
      { label: 'Great', value: 'Feeling great this week' },
      { label: 'Okay', value: 'Feeling okay this week' },
      { label: 'Struggling', value: 'Struggling this week' },
      { label: 'Overwhelmed', value: 'Feeling overwhelmed this week' },
    ],
  },
  {
    key: 'timeCommitment',
    label: 'Time each day',
    blueText: 'How much time do you set aside for your mental wellness each day?',
    audioSrc: '/audio/onboarding/course-intake/time-commitment.mp3',
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
    audioSrc: '/audio/onboarding/course-intake/experience.mp3',
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
    audioSrc: '/audio/onboarding/course-intake/voice-context.mp3',
    allowText: true,
    optional: true,
    textPlaceholder: "Type anything you'd like Blue to know...",
  },
];
