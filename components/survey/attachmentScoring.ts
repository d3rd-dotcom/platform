import type { SurveyAnswers, SurveyResults, SurveyDimension } from './types'

export const ATTACHMENT_OPTIONS = [
  'Strongly disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly agree',
]

type AttachmentScoreSuccess = {
  ok: true
  results: SurveyResults
}

type AttachmentScoreFailure = {
  ok: false
  error: string
}

export type AttachmentScoreResult = AttachmentScoreSuccess | AttachmentScoreFailure

const ANXIETY_IDS = [1, 2, 3, 4, 5, 6]
const AVOIDANCE_IDS = [7, 8, 9, 10, 11, 12]
const REVERSE_IDS = new Set([11, 12])

function parseAnswer(answer: string): number | null {
  const index = ATTACHMENT_OPTIONS.indexOf(answer)
  if (index === -1) return null
  return index + 1
}

function scoredValue(raw: number, reverse: boolean): number {
  return reverse ? 6 - raw : raw
}

export function scoreAttachmentSurvey(answers: SurveyAnswers): AttachmentScoreResult {
  const invalidIds: number[] = []

  const allIds = [...ANXIETY_IDS, ...AVOIDANCE_IDS]
  const scoredAnswers: Record<number, number> = {}

  for (const qId of allIds) {
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
    scoredAnswers[qId] = scoredValue(raw, REVERSE_IDS.has(qId))
  }

  if (invalidIds.length > 0) {
    return {
      ok: false,
      error: `Attachment scoring requires valid answers for all 12 items. Missing or invalid: ${invalidIds.slice(0, 8).join(', ')}${invalidIds.length > 8 ? ', ...' : ''}.`,
    }
  }

  const anxietySum = ANXIETY_IDS.reduce((acc, id) => acc + scoredAnswers[id], 0)
  const avoidanceSum = AVOIDANCE_IDS.reduce((acc, id) => acc + scoredAnswers[id], 0)

  const anxietyMean = anxietySum / ANXIETY_IDS.length
  const avoidanceMean = avoidanceSum / AVOIDANCE_IDS.length

  const anxietyScore = ((anxietyMean - 1) / 4) * 100
  const avoidanceScore = ((avoidanceMean - 1) / 4) * 100

  const THRESHOLD = 3.0
  let profileType: string
  if (anxietyMean < THRESHOLD && avoidanceMean < THRESHOLD) {
    profileType = 'Secure'
  } else if (anxietyMean >= THRESHOLD && avoidanceMean < THRESHOLD) {
    profileType = 'Anxious'
  } else if (anxietyMean < THRESHOLD && avoidanceMean >= THRESHOLD) {
    profileType = 'Avoidant'
  } else {
    profileType = 'Fearful-Avoidant'
  }

  const dimensions: SurveyDimension[] = [
    {
      id: 'anxiety',
      label: 'Attachment Anxiety',
      score: anxietyScore,
      description: 'degree of worry about abandonment and need for reassurance',
    },
    {
      id: 'avoidance',
      label: 'Attachment Avoidance',
      score: avoidanceScore,
      description: 'degree of discomfort with closeness and emotional dependency',
    },
  ]

  return {
    ok: true,
    results: {
      surveyId: 'attachment-style',
      surveyTitle: 'Attachment Style',
      personalizedTitle: profileType,
      answers,
      analysis: '',
      insights: [],
      timestamp: new Date().toISOString(),
      resultType: 'attachment',
      dimensions,
      profileType,
    },
  }
}
