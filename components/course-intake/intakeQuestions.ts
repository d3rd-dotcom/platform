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
    key: 'courseFocus',
    label: 'Course focus',
    blueText: 'Picture someone finishing your course. What changed for them along the way?',
    audioSrc: '/audio/onboarding/course-intake/course-focus.mp3',
    choices: [
      { label: 'A new skill', value: 'Learners leave with a concrete new skill they can practice' },
      { label: 'A shift in perspective', value: 'Learners leave seeing themselves or the world differently' },
      { label: 'A body of knowledge', value: 'Learners leave with a solid grasp of a subject they knew little about' },
      { label: 'A habit that sticks', value: 'Learners leave with a daily or weekly habit built into their routine' },
    ],
  },
  {
    key: 'learningStyle',
    label: 'How learners engage',
    blueText: 'Every course has a texture. How do you want yours to feel from the inside?',
    audioSrc: '/audio/onboarding/course-intake/learning-style.mp3',
    choices: [
      { label: 'Reading first', value: 'Reading-led course built around weekly readings and reflection' },
      { label: 'Doing first', value: 'Practice-led course built around missions and hands-on exercises' },
      { label: 'Checked by quizzes', value: 'Quiz-checked course where learners test their understanding as they go' },
      { label: 'Led by video', value: 'Video-led course where learners watch first, then act' },
    ],
  },
  {
    key: 'courseScope',
    label: 'Scope and pace',
    blueText: 'Now the shape of it. How long should this journey run?',
    audioSrc: '/audio/onboarding/course-intake/course-scope.mp3',
    choices: [
      { label: 'Short and sharp', value: 'A short course, one to two weeks, quick sessions learners can finish fast' },
      { label: 'A steady month', value: 'A four-week course with a session or two each week' },
      { label: 'A longer arc', value: 'An eight-week or longer course that builds slowly and goes deep' },
    ],
  },
  {
    key: 'creatorNotes',
    label: 'Anything else',
    blueText: "Last one. Tell me anything else about the course you imagine. I'll keep it in mind while we build.",
    audioSrc: '/audio/onboarding/course-intake/creator-notes.mp3',
    allowText: true,
    optional: true,
    textPlaceholder: 'Describe the course in your head...',
  },
];
