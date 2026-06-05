// Static 4-week task tracks. The intake's focus answer (Q1) selects a track —
// no model generation, no narrative stories: just practical tasks that help a
// user build better daily patterns for the thing they chose.

export type CourseStatus = 'intake' | 'generating' | 'ready';
export type IntakeAnswers = Record<string, string>;

export interface CourseRead {
  title: string;
  body: string;
}

export interface CourseWeek {
  weekNumber: number;
  theme: string;
  read?: CourseRead;
  tasks: string[];
}

export interface CourseData {
  focus: string;
  title: string;
  weeks: CourseWeek[];
}

export interface PersonalCourseRecord {
  id: string;
  status: CourseStatus;
  intakeData: IntakeAnswers;
  courseData: CourseData | null;
  progressData: Record<string, unknown>;
}

const FOCUS_TRACKS: Record<string, CourseData> = {
  Creativity: {
    focus: 'Creativity',
    title: 'Build a creative practice',
    weeks: [
      {
        weekNumber: 1,
        theme: 'Make space',
        tasks: [
          'Set up a small spot that is just for creating',
          'Block 15 minutes a day on your calendar',
          'Gather your tools in one place',
          'Tell one person you are starting',
        ],
      },
      {
        weekNumber: 2,
        theme: 'Show up daily',
        tasks: [
          'Make one small thing each day — no judging it',
          'Keep a one-line log of what you made',
          'Follow one artist whose work moves you',
          'Save three things that catch your eye',
        ],
      },
      {
        weekNumber: 3,
        theme: 'Go a little deeper',
        tasks: [
          'Spend one full session on a single piece',
          'Share one thing with someone you trust',
          'Try a medium you have not used before',
          'Note what felt most alive',
        ],
      },
      {
        weekNumber: 4,
        theme: 'Make it yours',
        tasks: [
          'Settle on a weekly rhythm you can keep',
          'Finish one small project start to end',
          'Reflect on what changed in four weeks',
          'Pick your focus for next month',
        ],
      },
    ],
  },
  Exercise: {
    focus: 'Exercise',
    title: 'Build a movement habit',
    weeks: [
      {
        weekNumber: 1,
        theme: 'Start small',
        tasks: [
          'Move your body 10 minutes a day',
          'Pick a time of day that will stick',
          'Lay out your clothes the night before',
          'Mark each day you moved',
        ],
      },
      {
        weekNumber: 2,
        theme: 'Add consistency',
        tasks: [
          'Move 20 minutes a day',
          'Try two different kinds of movement',
          'Stretch for five minutes afterward',
          'Notice how your energy shifts',
        ],
      },
      {
        weekNumber: 3,
        theme: 'Build strength',
        tasks: [
          'Add one strength-focused session',
          'Take a short walk after one meal a day',
          'Drink water before each session',
          'Take one full rest day',
        ],
      },
      {
        weekNumber: 4,
        theme: 'Lock it in',
        tasks: [
          'Set a weekly movement schedule',
          'Complete four sessions this week',
          'Reflect on how your body feels',
          'Plan next month of movement',
        ],
      },
    ],
  },
  Wellness: {
    focus: 'Wellness',
    title: 'Build daily wellness',
    weeks: [
      {
        weekNumber: 1,
        theme: 'Ground yourself',
        tasks: [
          'Choose a consistent wake-up time',
          'Drink a glass of water first thing',
          'Take five quiet minutes each morning',
          'Step outside at least once a day',
        ],
      },
      {
        weekNumber: 2,
        theme: 'Tend your body',
        tasks: [
          'Eat one mindful, unhurried meal a day',
          'Put screens away before bed',
          'Move your body every day',
          'Note how you slept each morning',
        ],
      },
      {
        weekNumber: 3,
        theme: 'Tend your mind',
        tasks: [
          'Write three lines each morning',
          'Name one thing you are grateful for',
          'Take a real break in the middle of the day',
          'Cut back one draining habit',
        ],
      },
      {
        weekNumber: 4,
        theme: 'Make it a rhythm',
        tasks: [
          'Set a simple evening wind-down routine',
          'Protect a consistent sleep window',
          'Reflect on what actually helped',
          'Plan next month of wellness',
        ],
      },
    ],
  },
  Healing: {
    focus: 'Healing',
    title: 'Rebuild self-trust',
    weeks: [
      {
        weekNumber: 1,
        theme: 'Be gentle',
        tasks: [
          'Write freely for five minutes each morning',
          'Speak to yourself kindly once a day',
          'Rest once without guilt',
          'Name how you feel each evening',
        ],
      },
      {
        weekNumber: 2,
        theme: 'Make small promises',
        tasks: [
          'Make one small promise to yourself daily and keep it',
          'Notice each time you follow through',
          'Forgive yourself for one slip',
          'Track the promises you kept',
        ],
      },
      {
        weekNumber: 3,
        theme: 'Set a boundary',
        tasks: [
          'Say no to one thing that drains you',
          'Ask for one thing you need',
          'Spend time with someone who feels safe',
          'Note what felt hard and why',
        ],
      },
      {
        weekNumber: 4,
        theme: 'Trust yourself',
        tasks: [
          'Make one slightly bigger commitment and keep it',
          'Reflect on what you proved to yourself',
          'Write yourself a kind letter',
          'Plan next month of healing',
        ],
      },
    ],
  },
};

const DEFAULT_FOCUS = 'Wellness';

/** Resolves the intake focus answer to a static 4-week task track. */
export function buildCourse(intake: IntakeAnswers): CourseData {
  const focus = intake.goal && FOCUS_TRACKS[intake.goal] ? intake.goal : DEFAULT_FOCUS;
  return FOCUS_TRACKS[focus];
}
