import type { Survey, SurveyQuestion } from './types'

export const VIA_SURVEY_ID = 'via-character-strengths'

export const VIA_LIKERT_OPTIONS = [
  'Very much like me',
  'Like me',
  'Neutral',
  'Unlike me',
  'Very much unlike me',
] as const

export type ViaLikertOption = (typeof VIA_LIKERT_OPTIONS)[number]

export type CharacterStrengthId =
  | 'creativity'
  | 'curiosity'
  | 'judgment'
  | 'love-of-learning'
  | 'perspective'
  | 'bravery'
  | 'perseverance'
  | 'honesty'
  | 'zest'
  | 'love'
  | 'kindness'
  | 'social-intelligence'
  | 'teamwork'
  | 'fairness'
  | 'leadership'
  | 'forgiveness'
  | 'humility'
  | 'prudence'
  | 'self-regulation'
  | 'appreciation-of-beauty'
  | 'gratitude'
  | 'hope'
  | 'humor'
  | 'spirituality'

export interface CharacterStrength {
  id: CharacterStrengthId
  label: string
  virtue: 'Wisdom' | 'Courage' | 'Humanity' | 'Justice' | 'Temperance' | 'Transcendence'
  description: string
  practice: string
  socialSignal: string
  pressureSignal: string
  growthSignal: string
  benefitSignal: string
  absenceSignal: string
}

export const VIA_STRENGTHS: CharacterStrength[] = [
  {
    id: 'creativity',
    label: 'Creativity',
    virtue: 'Wisdom',
    description: 'Original thinking, making, and problem solving.',
    practice: 'generate fresh possibilities instead of repeating the first answer',
    socialSignal: 'bringing original ideas into ordinary problems',
    pressureSignal: 'look for an unconventional path that still works',
    growthSignal: 'make something in a new way',
    benefitSignal: 'turn constraints into workable options',
    absenceSignal: 'creative problem solving',
  },
  {
    id: 'curiosity',
    label: 'Curiosity',
    virtue: 'Wisdom',
    description: 'Interest in experience, questions, and exploration.',
    practice: 'ask questions until the situation becomes clearer',
    socialSignal: 'wanting to understand what is really going on',
    pressureSignal: 'stay interested instead of shutting down',
    growthSignal: 'explore a topic beyond the minimum requirement',
    benefitSignal: 'notice details other people miss',
    absenceSignal: 'active inquiry',
  },
  {
    id: 'judgment',
    label: 'Judgment',
    virtue: 'Wisdom',
    description: 'Critical thinking, evidence seeking, and balanced reasoning.',
    practice: 'weigh evidence before deciding what I believe',
    socialSignal: 'checking assumptions before accepting a claim',
    pressureSignal: 'separate signal from noise',
    growthSignal: 'revise my view when better evidence arrives',
    benefitSignal: 'slow a group down enough to think clearly',
    absenceSignal: 'careful evaluation',
  },
  {
    id: 'love-of-learning',
    label: 'Love of Learning',
    virtue: 'Wisdom',
    description: 'Mastery, study, and the pleasure of understanding.',
    practice: 'keep learning after the required part is finished',
    socialSignal: 'building skill because understanding feels rewarding',
    pressureSignal: 'treat difficulty as a lesson to study',
    growthSignal: 'practice a skill until it becomes more precise',
    benefitSignal: 'share what I learn in a useful way',
    absenceSignal: 'deliberate learning',
  },
  {
    id: 'perspective',
    label: 'Perspective',
    virtue: 'Wisdom',
    description: 'Wise counsel, context, and seeing the larger pattern.',
    practice: 'step back and place events in a wider context',
    socialSignal: 'helping people see the bigger picture',
    pressureSignal: 'look beyond the immediate reaction',
    growthSignal: "connect today's problem to a longer arc",
    benefitSignal: 'offer advice that respects complexity',
    absenceSignal: 'wise perspective',
  },
  {
    id: 'bravery',
    label: 'Bravery',
    virtue: 'Courage',
    description: 'Courage in action, speech, and endurance.',
    practice: 'do the necessary thing even when it is uncomfortable',
    socialSignal: 'speaking up when silence would be easier',
    pressureSignal: 'act from principle despite fear',
    growthSignal: 'face a challenge I would rather avoid',
    benefitSignal: 'make room for truth under pressure',
    absenceSignal: 'courageous action',
  },
  {
    id: 'perseverance',
    label: 'Perseverance',
    virtue: 'Courage',
    description: 'Finishing, persistence, and steady effort.',
    practice: 'finish what matters after the first burst fades',
    socialSignal: 'staying with a task through friction',
    pressureSignal: 'continue with the next useful step',
    growthSignal: 'return to a goal after a setback',
    benefitSignal: 'make progress reliable for others',
    absenceSignal: 'sustained effort',
  },
  {
    id: 'honesty',
    label: 'Honesty',
    virtue: 'Courage',
    description: 'Truthfulness, integrity, and authentic conduct.',
    practice: 'tell the truth plainly, including inconvenient parts',
    socialSignal: 'matching words, actions, and motives',
    pressureSignal: 'name what is real without distortion',
    growthSignal: 'admit a mistake before being forced to',
    benefitSignal: 'make trust easier to maintain',
    absenceSignal: 'truthful naming',
  },
  {
    id: 'zest',
    label: 'Zest',
    virtue: 'Courage',
    description: 'Energy, vitality, and wholehearted engagement.',
    practice: 'bring real energy to what I choose to do',
    socialSignal: 'making effort feel more alive for the room',
    pressureSignal: 'stay engaged instead of going flat',
    growthSignal: 'enter a task with full attention',
    benefitSignal: 'raise the level of participation around me',
    absenceSignal: 'vital engagement',
  },
  {
    id: 'love',
    label: 'Love',
    virtue: 'Humanity',
    description: 'Close bonds, warmth, and mutual care.',
    practice: 'invest attention in the people I care about',
    socialSignal: 'showing people they matter to me',
    pressureSignal: 'stay connected rather than withdraw coldly',
    growthSignal: 'make a relationship more honest and alive',
    benefitSignal: 'help people feel securely known',
    absenceSignal: 'close connection',
  },
  {
    id: 'kindness',
    label: 'Kindness',
    virtue: 'Humanity',
    description: 'Generosity, care, and helpful action.',
    practice: 'notice a practical need and respond to it',
    socialSignal: 'being generous without needing a performance',
    pressureSignal: 'remain considerate when I am strained',
    growthSignal: "make someone else's load lighter",
    benefitSignal: 'turn care into concrete help',
    absenceSignal: 'generous help',
  },
  {
    id: 'social-intelligence',
    label: 'Social Intelligence',
    virtue: 'Humanity',
    description: 'Awareness of motives, feelings, and social context.',
    practice: 'read the emotional currents in a room',
    socialSignal: 'understanding what people are feeling beneath their words',
    pressureSignal: 'adjust my approach to the person in front of me',
    growthSignal: 'notice my own motives before reacting',
    benefitSignal: 'help interactions land with more accuracy',
    absenceSignal: 'emotional attunement',
  },
  {
    id: 'teamwork',
    label: 'Teamwork',
    virtue: 'Justice',
    description: 'Loyalty, contribution, and shared effort.',
    practice: 'contribute reliably to a shared goal',
    socialSignal: 'making the group stronger, not just myself',
    pressureSignal: 'stay accountable to the team',
    growthSignal: "coordinate my work with other people's needs",
    benefitSignal: 'help a group move as one system',
    absenceSignal: 'collaborative contribution',
  },
  {
    id: 'fairness',
    label: 'Fairness',
    virtue: 'Justice',
    description: 'Equity, impartiality, and principled treatment.',
    practice: 'apply the same standard even when I have preferences',
    socialSignal: 'looking for the fair outcome, not the convenient one',
    pressureSignal: 'protect equal consideration under strain',
    growthSignal: 'check whether my bias is shaping the decision',
    benefitSignal: 'make rules feel legitimate',
    absenceSignal: 'fair treatment',
  },
  {
    id: 'leadership',
    label: 'Leadership',
    virtue: 'Justice',
    description: 'Organizing people toward constructive action.',
    practice: 'help people organize around the next clear move',
    socialSignal: 'creating direction when a group is scattered',
    pressureSignal: 'take responsibility without dominating',
    growthSignal: 'bring structure to shared action',
    benefitSignal: 'turn confusion into coordinated effort',
    absenceSignal: 'constructive direction',
  },
  {
    id: 'forgiveness',
    label: 'Forgiveness',
    virtue: 'Temperance',
    description: 'Mercy, release, and measured response to harm.',
    practice: 'release resentment when repair is possible',
    socialSignal: 'leaving room for people to grow after mistakes',
    pressureSignal: 'respond without making punishment my identity',
    growthSignal: 'separate accountability from revenge',
    benefitSignal: 'make repair possible after harm',
    absenceSignal: 'merciful restraint',
  },
  {
    id: 'humility',
    label: 'Humility',
    virtue: 'Temperance',
    description: 'Modesty, accurate self-view, and teachability.',
    practice: 'keep an accurate view of my limits',
    socialSignal: 'letting the work matter more than my image',
    pressureSignal: 'accept correction without collapsing or posing',
    growthSignal: 'learn from someone who knows more than I do',
    benefitSignal: 'make collaboration less ego-driven',
    absenceSignal: 'accurate self-assessment',
  },
  {
    id: 'prudence',
    label: 'Prudence',
    virtue: 'Temperance',
    description: 'Careful choice, foresight, and wise caution.',
    practice: 'think through consequences before acting',
    socialSignal: 'choosing timing and method carefully',
    pressureSignal: 'avoid creating a bigger problem through haste',
    growthSignal: 'plan before committing resources',
    benefitSignal: 'prevent avoidable damage',
    absenceSignal: 'careful foresight',
  },
  {
    id: 'self-regulation',
    label: 'Self-Regulation',
    virtue: 'Temperance',
    description: 'Discipline, emotional control, and healthy limits.',
    practice: 'manage my impulses instead of being run by them',
    socialSignal: 'staying steady when feelings are loud',
    pressureSignal: 'choose my response before acting',
    growthSignal: 'keep a useful habit when motivation drops',
    benefitSignal: 'make my behavior dependable',
    absenceSignal: 'disciplined self-management',
  },
  {
    id: 'appreciation-of-beauty',
    label: 'Appreciation of Beauty and Excellence',
    virtue: 'Transcendence',
    description: 'Noticing beauty, skill, and excellence in the world.',
    practice: 'notice beauty and excellence in ordinary places',
    socialSignal: 'being moved by craft, nature, or human skill',
    pressureSignal: 'stay open to what is admirable',
    growthSignal: 'pause long enough to recognize excellence',
    benefitSignal: 'help people value what is worth admiring',
    absenceSignal: 'attention to beauty and excellence',
  },
  {
    id: 'gratitude',
    label: 'Gratitude',
    virtue: 'Transcendence',
    description: 'Recognizing gifts, help, and sources of good.',
    practice: 'notice what I have received instead of only what is missing',
    socialSignal: 'naming the help and goodness around me',
    pressureSignal: 'remember what remains worthy of thanks',
    growthSignal: 'express appreciation before it becomes assumed',
    benefitSignal: 'make generosity visible',
    absenceSignal: 'grateful recognition',
  },
  {
    id: 'hope',
    label: 'Hope',
    virtue: 'Transcendence',
    description: 'Future-minded agency, optimism, and possibility.',
    practice: 'look for a workable future path',
    socialSignal: 'helping people believe effort can still matter',
    pressureSignal: 'keep possibility alive without denying reality',
    growthSignal: 'act as if improvement is still available',
    benefitSignal: 'give people a reason to continue',
    absenceSignal: 'future-oriented possibility',
  },
  {
    id: 'humor',
    label: 'Humor',
    virtue: 'Transcendence',
    description: 'Playfulness, levity, and perspective through wit.',
    practice: 'use playfulness to lighten the room',
    socialSignal: 'helping people breathe through well-timed humor',
    pressureSignal: 'find levity without dismissing what matters',
    growthSignal: 'bring warmth and play into serious work',
    benefitSignal: 'make hard moments more bearable',
    absenceSignal: 'constructive levity',
  },
  {
    id: 'spirituality',
    label: 'Spirituality',
    virtue: 'Transcendence',
    description: 'Meaning, purpose, faith, and connection to what is sacred.',
    practice: 'connect daily choices to a deeper sense of meaning',
    socialSignal: 'acting from purpose beyond immediate reward',
    pressureSignal: 'return to what I believe is sacred or ultimate',
    growthSignal: 'make space for reflection on purpose',
    benefitSignal: 'help people orient toward meaning',
    absenceSignal: 'deep purpose',
  },
]

type ItemTemplate = {
  reverse: boolean
  text: (strength: CharacterStrength) => string
}

// Original item bank modeled on the 24 VIA character strengths. This does not
// reproduce proprietary VIA-IS statement wording.
const VIA_ITEM_TEMPLATES: ItemTemplate[] = [
  {
    reverse: false,
    text: (strength) => `I naturally ${strength.practice}.`,
  },
  {
    reverse: false,
    text: (strength) => `People who know me see me ${strength.socialSignal}.`,
  },
  {
    reverse: true,
    text: (strength) => `I rarely make room to ${strength.practice}.`,
  },
  {
    reverse: false,
    text: (strength) => `When a situation is tense, I still ${strength.pressureSignal}.`,
  },
  {
    reverse: false,
    text: (strength) => `I look for small daily chances to ${strength.growthSignal}.`,
  },
  {
    reverse: true,
    text: (strength) => `I tend to leave ${strength.absenceSignal} for someone else to handle.`,
  },
  {
    reverse: false,
    text: (strength) => `A good day feels incomplete if I have not tried to ${strength.practice}.`,
  },
  {
    reverse: false,
    text: (strength) => `My choices help other people when I ${strength.benefitSignal}.`,
  },
  {
    reverse: true,
    text: (strength) => `Under pressure, I lose contact with ${strength.label.toLowerCase()}.`,
  },
  {
    reverse: true,
    text: (strength) => `I feel little pull to ${strength.growthSignal}.`,
  },
]

export const VIA_QUESTIONS: SurveyQuestion[] = VIA_STRENGTHS.flatMap((strength, strengthIndex) =>
  VIA_ITEM_TEMPLATES.map((template, templateIndex) => ({
    id: strengthIndex * VIA_ITEM_TEMPLATES.length + templateIndex + 1,
    text: template.text(strength),
    options: [...VIA_LIKERT_OPTIONS],
    type: 'likert',
    strengthId: strength.id,
    reverseScore: template.reverse,
  })),
)

export const VIA_SURVEY: Survey = {
  id: VIA_SURVEY_ID,
  title: 'Who are you at your best?',
  description: 'A 240-item strengths quiz for finding the traits you lead with when you are most yourself.',
  questions: VIA_QUESTIONS,
  questionType: 'likert',
  pageSize: 10,
}
