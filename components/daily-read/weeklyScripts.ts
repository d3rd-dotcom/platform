import type { BlueEmotion } from '@/components/blue-dialogue/BlueDialogue';

/**
 * Blue's weekly intro / check-in scripts, shown once per season week through
 * the centered BlueDialogue pop-up on /home (where field notes live).
 */

export const WEEKLY_SEEN_KEY = 'dailyReadLastSeenWeek';

const SUBTITLE = 'Let this frame the week, then keep the mission alive in your field notes.';

export interface WeekScript {
  title: string;
  subtitle: string;
  emotion: BlueEmotion;
  lines: string[];
  /** Check-in weeks open the chatback reply field under Blue's questions. */
  chatback?: boolean;
}

const WEEK_SCRIPTS: Record<number, WeekScript> = {
  5: {
    title: 'Recovering a Sense of Possibility',
    subtitle: SUBTITLE,
    emotion: 'confused',
    lines: [
      'Week 5 asks you to examine the payoff of staying stuck.',
      'Inherited limits. The cost of performing goodness. The places you make other people responsible for your constriction.',
      'Notice where you have built small cages out of old limits. Bring that tension into your field notes instead of smoothing it over.',
    ],
  },
  6: {
    title: 'Recovering a Sense of Abundance',
    subtitle: SUBTITLE,
    emotion: 'sad',
    lines: [
      'Week 6 examines money as a creative constraint.',
      'You will study the stories you carry about scarcity, worth, and what you are allowed to receive.',
      'The counting exercise gives you a clear view of spending, values, and where they diverge.',
      'This week tends to stir things up. Stay close to your field notes. They will help you hear what is actually yours.',
    ],
  },
  7: {
    title: 'Check-in [Week 7]',
    subtitle: SUBTITLE,
    emotion: 'calm',
    chatback: true,
    lines: [
      'So. How many days this week did you fill out your field notes?',
      'Did you take your artist date? What risk did it carry?',
      'Did you notice any useful timing, support, or opportunity this week? What was it?',
      'Anything else that felt significant for your recovery? Name it here, then carry the rest to your field notes. I read what you keep.',
    ],
  },
};

export function scriptForWeek(week: number): WeekScript {
  return (
    WEEK_SCRIPTS[week] ?? {
      title: `Week ${week}`,
      subtitle: 'The core ideas underneath the work. Read them once before you begin.',
      emotion: 'happy',
      lines: [
        'Before you move, ground this week in the basics.',
        'Creativity is a practice you can return to. You can shape what you notice.',
        'Ideas get clearer when you give them time. Small work becomes real when you repeat it.',
        'Let those set the tone for your field notes before the day starts talking over you.',
      ],
    }
  );
}
