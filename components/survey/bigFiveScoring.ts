import type { SurveyAnswers, SurveyResults, SurveyDimension } from './types'

export const BIG_FIVE_LIKERT_OPTIONS = [
  'Strongly disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly agree',
]

type BigFiveScoreSuccess = {
  ok: true
  results: SurveyResults
}

type BigFiveScoreFailure = {
  ok: false
  error: string
}

export type BigFiveScoreResult = BigFiveScoreSuccess | BigFiveScoreFailure

interface TraitConfig {
  id: string
  label: string
  description: string
  questions: Array<{ id: number; reverse: boolean }>
}

const TRAITS: TraitConfig[] = [
  {
    id: 'openness',
    label: 'Openness',
    description: 'curiosity, creativity, and openness to new experiences',
    questions: [
      { id: 1, reverse: false },
      { id: 2, reverse: false },
      { id: 3, reverse: true },
      { id: 4, reverse: false },
    ],
  },
  {
    id: 'conscientiousness',
    label: 'Conscientiousness',
    description: 'organization, dependability, and self-discipline',
    questions: [
      { id: 5, reverse: false },
      { id: 6, reverse: true },
      { id: 7, reverse: false },
      { id: 8, reverse: false },
    ],
  },
  {
    id: 'extraversion',
    label: 'Extraversion',
    description: 'sociability, assertiveness, and positive emotionality',
    questions: [
      { id: 9, reverse: false },
      { id: 10, reverse: true },
      { id: 11, reverse: false },
      { id: 12, reverse: false },
    ],
  },
  {
    id: 'agreeableness',
    label: 'Agreeableness',
    description: 'cooperation, trust, and empathy toward others',
    questions: [
      { id: 13, reverse: true },
      { id: 14, reverse: false },
      { id: 15, reverse: false },
      { id: 16, reverse: true },
    ],
  },
  {
    id: 'neuroticism',
    label: 'Neuroticism',
    description: 'emotional reactivity and tendency toward negative emotions',
    questions: [
      { id: 17, reverse: false },
      { id: 18, reverse: true },
      { id: 19, reverse: false },
      { id: 20, reverse: true },
    ],
  },
]

function parseAnswer(answer: string): number | null {
  const index = BIG_FIVE_LIKERT_OPTIONS.indexOf(answer)
  if (index === -1) return null
  return index + 1
}

function scoredValue(raw: number, reverse: boolean): number {
  return reverse ? 6 - raw : raw
}

function dimensionDescription(label: string, score: number, traitDesc: string): string {
  const level = score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low'
  return `${level} ${label.toLowerCase()}: ${traitDesc}`
}

export function scoreBigFiveSurvey(answers: SurveyAnswers): BigFiveScoreResult {
  const invalidIds: number[] = []
  const dimensions: SurveyDimension[] = []

  for (const trait of TRAITS) {
    let sum = 0
    for (const q of trait.questions) {
      const answer = answers[q.id]
      if (typeof answer !== 'string') {
        invalidIds.push(q.id)
        continue
      }
      const raw = parseAnswer(answer)
      if (raw === null) {
        invalidIds.push(q.id)
        continue
      }
      sum += scoredValue(raw, q.reverse)
    }

    const score = ((sum - 4) / 16) * 100

    dimensions.push({
      id: trait.id,
      label: trait.label,
      score,
      description: dimensionDescription(trait.label, score, trait.description),
    })
  }

  if (invalidIds.length > 0) {
    return {
      ok: false,
      error: `Big Five scoring requires valid answers for all 20 items. Missing or invalid: ${invalidIds.slice(0, 8).join(', ')}${invalidIds.length > 8 ? ', ...' : ''}.`,
    }
  }

  const highTraits = dimensions.filter((d) => d.score >= 65).map((d) => d.label)
  const profileType = highTraits.length > 0 ? highTraits.join(', ') : 'Balanced Profile'

  return {
    ok: true,
    results: {
      surveyId: 'big-five',
      surveyTitle: 'Big Five Personality',
      personalizedTitle: profileType,
      answers,
      analysis: '',
      insights: [],
      timestamp: new Date().toISOString(),
      resultType: 'bigfive',
      dimensions,
      profileType,
    },
  }
}
