interface TemplateComponent {
  componentType: string;
  title: string;
  config: Record<string, unknown>;
  required?: boolean;
}

interface TemplateWeek {
  weekNumber: number;
  title: string;
  theme: string;
  components: TemplateComponent[];
}

export interface CourseTemplate {
  id: string;
  title: string;
  focus: string;
  weeks: TemplateWeek[];
}

const MENTAL_WELLNESS: CourseTemplate = {
  id: 'mental-wellness',
  title: 'Mental Wellness',
  focus: 'Mental Wellness',
  weeks: [
    {
      weekNumber: 1,
      title: 'Understanding Your Mind',
      theme: 'Awareness',
      components: [
        { componentType: 'rich_text', title: 'Introduction to Mental Wellness', config: { content: '# Mental Wellness\n\nA journey toward understanding and nurturing your mental health.' } },
        { componentType: 'reflection_journal', title: 'Your Starting Point', config: { prompt: 'How are you feeling right now? What brings you to this course?', minWords: 50, saveEnabled: true } },
      ],
    },
    {
      weekNumber: 2,
      title: 'Building Resilience',
      theme: 'Strength',
      components: [
        { componentType: 'rich_text', title: 'Resilience', config: { content: '# Building Resilience\n\nLearn strategies to bounce back from challenges.' } },
        { componentType: 'reflection_journal', title: 'Reflection', config: { prompt: 'Think of a recent challenge. How did you handle it?', minWords: 75, saveEnabled: true } },
        { componentType: 'rating_scale', title: 'How are you?', config: { min: 1, max: 5, step: 1, minLabel: 'Struggling', maxLabel: 'Thriving' } },
      ],
    },
    {
      weekNumber: 3,
      title: 'Healthy Habits',
      theme: 'Practice',
      components: [
        { componentType: 'rich_text', title: 'Daily Practices', config: { content: '# Healthy Habits\n\nSmall daily practices that support mental wellness.' } },
        { componentType: 'text_input', title: 'Your Practice', config: { placeholder: 'What habit would you like to build?', maxLength: 500, inputType: 'text' } },
        { componentType: 'reflection_journal', title: 'Weekly Check-in', config: { prompt: 'What habits supported you this week?', minWords: 50, saveEnabled: true } },
      ],
    },
    {
      weekNumber: 4,
      title: 'Moving Forward',
      theme: 'Growth',
      components: [
        { componentType: 'rich_text', title: 'Your Path Forward', config: { content: '# Moving Forward\n\nCarry what you have learned into your daily life.' } },
        { componentType: 'reflection_journal', title: 'Final Reflection', config: { prompt: 'What has changed for you? What will you carry forward?', minWords: 100, saveEnabled: true } },
        { componentType: 'multiple_choice', title: 'What helped most?', config: { question: 'Which practice helped you most?', options: [{ id: 'a', text: 'Reflection', isCorrect: false }, { id: 'b', text: 'Daily habits', isCorrect: false }, { id: 'c', text: 'Awareness', isCorrect: false }, { id: 'd', text: 'All of the above', isCorrect: true }], selectMultiple: false, revealAnswers: false } },
      ],
    },
  ],
};

const HEALTH: CourseTemplate = {
  id: 'health',
  title: 'Health & Wellness',
  focus: 'Health',
  weeks: [
    {
      weekNumber: 1,
      title: 'Your Health Foundation',
      theme: 'Basics',
      components: [
        { componentType: 'rich_text', title: 'Introduction to Health', config: { content: '# Health & Wellness\n\nBuilding a foundation for lifelong health.' } },
        { componentType: 'reflection_journal', title: 'Your Health Story', config: { prompt: 'What does health mean to you?', minWords: 50, saveEnabled: true } },
      ],
    },
    {
      weekNumber: 2,
      title: 'Nutrition & Energy',
      theme: 'Fuel',
      components: [
        { componentType: 'rich_text', title: 'Nutrition Basics', config: { content: '# Nutrition & Energy\n\nHow food fuels your body and mind.' } },
        { componentType: 'text_input', title: 'Your Diet Snapshot', config: { placeholder: 'Describe a typical day of eating...', maxLength: 500, inputType: 'text' } },
        { componentType: 'multiple_choice', title: 'Nutrition Check', config: { question: 'Which is most important for sustained energy?', options: [{ id: 'a', text: 'Balanced meals', isCorrect: true }, { id: 'b', text: 'Only protein', isCorrect: false }, { id: 'c', text: 'Skipping meals', isCorrect: false }, { id: 'd', text: 'Sugar for quick energy', isCorrect: false }], selectMultiple: false, revealAnswers: true } },
      ],
    },
    {
      weekNumber: 3,
      title: 'Sleep & Recovery',
      theme: 'Rest',
      components: [
        { componentType: 'rich_text', title: 'The Power of Rest', config: { content: '# Sleep & Recovery\n\nWhy rest is essential for health.' } },
        { componentType: 'reflection_journal', title: 'Your Sleep Habits', config: { prompt: 'Describe your current sleep routine. What could improve?', minWords: 75, saveEnabled: true } },
        { componentType: 'rating_scale', title: 'Sleep Quality', config: { min: 1, max: 5, step: 1, minLabel: 'Poor', maxLabel: 'Excellent' } },
      ],
    },
    {
      weekNumber: 4,
      title: 'Sustainable Health',
      theme: 'Lifestyle',
      components: [
        { componentType: 'rich_text', title: 'Long-Term Health', config: { content: '# Sustainable Health\n\nBuilding habits that last.' } },
        { componentType: 'reflection_journal', title: 'Your Health Plan', config: { prompt: 'What three habits will you carry forward?', minWords: 75, saveEnabled: true } },
        { componentType: 'quiz_block', title: 'Health Quiz', config: { timeLimitMinutes: 5, passingScore: 80 } },
      ],
    },
  ],
};

const FITNESS: CourseTemplate = {
  id: 'fitness',
  title: 'Fitness & Movement',
  focus: 'Fitness',
  weeks: [
    {
      weekNumber: 1,
      title: 'Getting Started',
      theme: 'Beginnings',
      components: [
        { componentType: 'rich_text', title: 'Welcome to Fitness', config: { content: '# Fitness & Movement\n\nStart your fitness journey with intention.' } },
        { componentType: 'reflection_journal', title: 'Your Fitness Goals', config: { prompt: 'What does fitness mean to you? What do you want to achieve?', minWords: 50, saveEnabled: true } },
      ],
    },
    {
      weekNumber: 2,
      title: 'Building Consistency',
      theme: 'Routine',
      components: [
        { componentType: 'rich_text', title: 'Consistency Over Intensity', config: { content: '# Building Consistency\n\nShowing up matters more than going hard.' } },
        { componentType: 'text_input', title: 'Your Weekly Plan', config: { placeholder: 'Plan your movement for the week...', maxLength: 500, inputType: 'text' } },
        { componentType: 'rating_scale', title: 'Energy Level', config: { min: 1, max: 5, step: 1, minLabel: 'Low', maxLabel: 'High' } },
      ],
    },
    {
      weekNumber: 3,
      title: 'Progress & Adaptation',
      theme: 'Growth',
      components: [
        { componentType: 'rich_text', title: 'Listening to Your Body', config: { content: '# Progress & Adaptation\n\nHow to challenge yourself safely.' } },
        { componentType: 'reflection_journal', title: 'Tracking Progress', config: { prompt: 'What progress have you noticed? How does your body feel?', minWords: 75, saveEnabled: true } },
        { componentType: 'multiple_choice', title: 'Workout Check', config: { question: 'How often should you increase intensity?', options: [{ id: 'a', text: 'Every workout', isCorrect: false }, { id: 'b', text: 'Gradually over weeks', isCorrect: true }, { id: 'c', text: 'Only when bored', isCorrect: false }, { id: 'd', text: 'Never', isCorrect: false }], selectMultiple: false, revealAnswers: true } },
      ],
    },
    {
      weekNumber: 4,
      title: 'Lifelong Movement',
      theme: 'Sustainability',
      components: [
        { componentType: 'rich_text', title: 'Moving Forward', config: { content: '# Lifelong Movement\n\nFitness is a journey, not a destination.' } },
        { componentType: 'reflection_journal', title: 'Your Fitness Journey', config: { prompt: 'How has your relationship with movement changed?', minWords: 75, saveEnabled: true } },
        { componentType: 'quiz_block', title: 'Fitness Knowledge', config: { timeLimitMinutes: 5, passingScore: 80 } },
      ],
    },
  ],
};

const BLANK: CourseTemplate = {
  id: 'blank',
  title: 'New Course',
  focus: 'Custom',
  weeks: [
    {
      weekNumber: 1,
      title: 'Week 1',
      theme: 'Getting Started',
      components: [
        { componentType: 'rich_text', title: 'Lesson', config: { content: '# Week 1\n\nStart writing your lesson here.' } },
        { componentType: 'reflection_journal', title: 'Reflection', config: { prompt: 'What did you learn?', minWords: 50, saveEnabled: true } },
      ],
    },
    {
      weekNumber: 2,
      title: 'Week 2',
      theme: 'Building',
      components: [
        { componentType: 'rich_text', title: 'Lesson', config: { content: '# Week 2\n\nContinue building on what you have learned.' } },
        { componentType: 'reflection_journal', title: 'Reflection', config: { prompt: 'How are you applying these concepts?', minWords: 50, saveEnabled: true } },
      ],
    },
    {
      weekNumber: 3,
      title: 'Week 3',
      theme: 'Deepening',
      components: [
        { componentType: 'rich_text', title: 'Lesson', config: { content: '# Week 3\n\nGo deeper into the material.' } },
        { componentType: 'reflection_journal', title: 'Reflection', config: { prompt: 'What is resonating with you?', minWords: 75, saveEnabled: true } },
      ],
    },
    {
      weekNumber: 4,
      title: 'Week 4',
      theme: 'Wrapping Up',
      components: [
        { componentType: 'rich_text', title: 'Lesson', config: { content: '# Week 4\n\nWrap up and reflect on the journey.' } },
        { componentType: 'reflection_journal', title: 'Final Reflection', config: { prompt: 'What will you take away from this?', minWords: 75, saveEnabled: true } },
      ],
    },
  ],
};

const KEYWORD_MAP: Array<{ keywords: string[]; template: CourseTemplate }> = [
  {
    keywords: ['mental', 'wellness', 'well-being', 'wellbeing', 'mind', 'anxiety', 'stress', 'meditation', 'mindfulness', 'emotional', 'therapy', 'coping', 'depression', 'calm', 'peace'],
    template: MENTAL_WELLNESS,
  },
  {
    keywords: ['health', 'nutrition', 'diet', 'sleep', 'energy', 'healthy', 'eating', 'food', 'meal', 'rest', 'recovery', 'wellness', 'lifestyle'],
    template: HEALTH,
  },
  {
    keywords: ['fitness', 'exercise', 'workout', 'gym', 'strength', 'cardio', 'movement', 'running', 'yoga', 'pilates', 'training', 'muscle', 'flexibility', 'stamina', 'endurance', 'sport', 'athletic'],
    template: FITNESS,
  },
];

export function matchTemplate(prompt: string): CourseTemplate {
  const lower = prompt.toLowerCase();
  let bestScore = 0;
  let best: CourseTemplate = BLANK;

  for (const entry of KEYWORD_MAP) {
    const score = entry.keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry.template;
    }
  }

  return best;
}
