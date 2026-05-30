import type { SurveyAnswers, SurveyResults, SurveyDimension } from './types'

export const MORAL_FOUNDATIONS_OPTIONS = [
  'Strongly disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly agree',
]

type MoralFoundationsScoreSuccess = {
  ok: true
  results: SurveyResults
}

type MoralFoundationsScoreFailure = {
  ok: false
  error: string
}

export type MoralFoundationsScoreResult = MoralFoundationsScoreSuccess | MoralFoundationsScoreFailure

interface FoundationConfig {
  id: string
  label: string
  description: string
  questionIds: number[]
}

const FOUNDATIONS: FoundationConfig[] = [
  {
    id: 'care',
    label: 'Care',
    description: 'sensitivity to harm and concern for others\' wellbeing',
    questionIds: [1, 2, 3, 4],
  },
  {
    id: 'fairness',
    label: 'Fairness',
    description: 'valuing justice, equal treatment, and reciprocity',
    questionIds: [5, 6, 7, 8],
  },
  {
    id: 'loyalty',
    label: 'Loyalty',
    description: 'prioritizing group cohesion, duty, and in-group solidarity',
    questionIds: [9, 10, 11, 12],
  },
  {
    id: 'authority',
    label: 'Authority',
    description: 'respect for hierarchy, tradition, and legitimate authority',
    questionIds: [13, 14, 15, 16],
  },
  {
    id: 'sanctity',
    label: 'Sanctity',
    description: 'concern for purity, dignity, and natural/sacred order',
    questionIds: [17, 18, 19, 20],
  },
]

function parseAnswer(answer: string): number | null {
  const index = MORAL_FOUNDATIONS_OPTIONS.indexOf(answer)
  if (index === -1) return null
  return index + 1
}

export function scoreMoralFoundationsSurvey(answers: SurveyAnswers): MoralFoundationsScoreResult {
  const invalidIds: number[] = []
  const dimensions: SurveyDimension[] = []
  const rawScores: Array<{ id: string; label: string; score: number }> = []

  for (const foundation of FOUNDATIONS) {
    let sum = 0
    for (const qId of foundation.questionIds) {
      const answer = answers[qId]
      if (typeof answer !== 'string') {
        invalidIds.push(qId)
        continue
      }
      const raw = parseAnswer(answer)
      if (raw === null) {
        invalidIds.push(qId)
        continue
      }
      sum += raw
    }

    const score = ((sum - 4) / 16) * 100

    dimensions.push({
      id: foundation.id,
      label: foundation.label,
      score,
      description: foundation.description,
    })

    rawScores.push({ id: foundation.id, label: foundation.label, score })
  }

  if (invalidIds.length > 0) {
    return {
      ok: false,
      error: `Moral Foundations scoring requires valid answers for all 20 items. Missing or invalid: ${invalidIds.slice(0, 8).join(', ')}${invalidIds.length > 8 ? ', ...' : ''}.`,
    }
  }

  const sorted = [...rawScores].sort((a, b) => b.score - a.score)
  const profileType = `${sorted[0].label} & ${sorted[1].label}`

  return {
    ok: true,
    results: {
      surveyId: 'moral-foundations',
      surveyTitle: 'Moral Foundations',
      personalizedTitle: profileType,
      answers,
      analysis: '',
      insights: [],
      timestamp: new Date().toISOString(),
      resultType: 'moral-foundations',
      dimensions,
      profileType,
    },
  }
}
