import type { SurveyAnswers, SurveyResults, ViaStrengthRanking } from './types'
import { VIA_LIKERT_OPTIONS, VIA_QUESTIONS, VIA_STRENGTHS, VIA_SURVEY, VIA_SURVEY_ID } from './viaQuestions'

type ViaScoreSuccess = {
  ok: true
  results: SurveyResults
}

type ViaScoreFailure = {
  ok: false
  error: string
}

export type ViaScoreResult = ViaScoreSuccess | ViaScoreFailure

const MAX_SCORE_PER_STRENGTH = 50

function scoreAnswer(answer: string, reverseScore: boolean): number | null {
  const index = VIA_LIKERT_OPTIONS.findIndex((option) => option === answer)
  if (index === -1) return null

  const rawScore = VIA_LIKERT_OPTIONS.length - index
  return reverseScore ? VIA_LIKERT_OPTIONS.length + 1 - rawScore : rawScore
}

export function scoreViaSurvey(answers: SurveyAnswers): ViaScoreResult {
  const scores = new Map<string, { score: number; answered: number }>()
  const invalidQuestionIds: number[] = []

  for (const strength of VIA_STRENGTHS) {
    scores.set(strength.id, { score: 0, answered: 0 })
  }

  for (const question of VIA_QUESTIONS) {
    if (!question.strengthId) continue

    const answer = answers[question.id]
    const scored = typeof answer === 'string' ? scoreAnswer(answer, Boolean(question.reverseScore)) : null

    if (scored === null) {
      invalidQuestionIds.push(question.id)
      continue
    }

    const bucket = scores.get(question.strengthId)
    if (!bucket) continue

    bucket.score += scored
    bucket.answered += 1
  }

  if (invalidQuestionIds.length > 0) {
    return {
      ok: false,
      error: `VIA scoring requires valid answers for all 240 items. Missing or invalid: ${invalidQuestionIds.slice(0, 8).join(', ')}${invalidQuestionIds.length > 8 ? ', ...' : ''}.`,
    }
  }

  const ranked = VIA_STRENGTHS
    .map<ViaStrengthRanking>((strength) => {
      const bucket = scores.get(strength.id) ?? { score: 0, answered: 0 }

      return {
        id: strength.id,
        label: strength.label,
        virtue: strength.virtue,
        score: bucket.score,
        maxScore: MAX_SCORE_PER_STRENGTH,
        average: Number((bucket.score / Math.max(bucket.answered, 1)).toFixed(2)),
        rank: 0,
        description: strength.description,
      }
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .map((strength, index) => ({ ...strength, rank: index + 1 }))

  const topStrengths = ranked.slice(0, 5)
  const topThree = topStrengths.slice(0, 3).map((strength) => strength.label).join(', ')

  return {
    ok: true,
    results: {
      surveyId: VIA_SURVEY_ID,
      surveyTitle: VIA_SURVEY.title,
      personalizedTitle: `Top strengths: ${topThree}`,
      answers,
      analysis: `Your strongest signals were ${topThree}. These rankings come from direct Likert scoring with reverse-scored items inverted, not keyword matching.`,
      insights: topStrengths.map(
        (strength) => `${strength.rank}. ${strength.label} (${strength.score}/${strength.maxScore}) - ${strength.description}`,
      ),
      timestamp: new Date().toISOString(),
      resultType: 'via',
      strengthRankings: ranked,
      topStrengths,
    },
  }
}
