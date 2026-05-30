export type SurveyQuestionType = 'multiple_choice' | 'likert'

export interface SurveyQuestion {
  id: number
  text: string
  options: string[]
  type?: SurveyQuestionType
  strengthId?: string
  reverseScore?: boolean
}

export interface Survey {
  id: string
  title: string
  description: string
  questions: SurveyQuestion[]
  questionType?: SurveyQuestionType
  pageSize?: number
}

export type SurveyAnswers = Record<number, string>

export interface ViaStrengthRanking {
  id: string
  label: string
  virtue: string
  score: number
  maxScore: number
  average: number
  rank: number
  description: string
}

export interface SurveyDimension {
  id: string
  label: string
  score: number
  description: string
}

export interface SurveyResults {
  surveyId: string
  surveyTitle: string
  personalizedTitle: string
  answers: SurveyAnswers
  analysis: string
  insights: string[]
  timestamp: string
  resultType?: 'standard' | 'via' | 'bigfive' | 'moral-foundations' | 'attachment'
  strengthRankings?: ViaStrengthRanking[]
  topStrengths?: ViaStrengthRanking[]
  dimensions?: SurveyDimension[]
  profileType?: string
}
