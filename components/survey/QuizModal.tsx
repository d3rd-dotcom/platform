'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Survey, SurveyAnswers, SurveyQuestion } from './types'
import styles from './QuizModal.module.css'

interface QuizModalProps {
  isOpen: boolean
  onClose: () => void
  survey: Survey | null
  variant?: 'modal' | 'inline'
  onComplete?: (answers: SurveyAnswers) => void | Promise<void>
}

export default function QuizModal({ isOpen, onClose, survey, variant = 'modal', onComplete }: QuizModalProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (variant !== 'modal') return

    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, variant])

  const handleClose = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setCurrentPageIndex(0)
    setAnswers({})
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleClose])

  if (!isOpen || !survey || !mounted) return null

  const isLikertSurvey = survey.questionType === 'likert'
  const pageSize = isLikertSurvey ? survey.pageSize ?? 10 : 1
  const pageStart = currentPageIndex * pageSize
  const currentQuestions = survey.questions.slice(pageStart, pageStart + pageSize)
  const pageEnd = pageStart + currentQuestions.length
  const isLastPage = pageEnd >= survey.questions.length
  const answeredCount = survey.questions.reduce((count, question) => (
    answers[question.id] !== undefined ? count + 1 : count
  ), 0)
  const hasPageAnswers = currentQuestions.every((question) => answers[question.id] !== undefined)

  const handleAnswerSelect = (question: SurveyQuestion, option: string) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [question.id]: option
    }))
  }

  const handleNext = () => {
    if (isLastPage) {
      handleSubmit()
    } else {
      setCurrentPageIndex(currentPageIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (onComplete) {
        await onComplete(answers)
      }
      // Reset state
      setCurrentPageIndex(0)
      setAnswers({})
      setIsSubmitting(false)
      onClose()
    } catch (error) {
      console.error('[QuizModal] Error submitting quiz:', error)
      setIsSubmitting(false)
    }
  }

  const progress = (answeredCount / survey.questions.length) * 100

  const panelContent = (
    <div
      className={`${styles.quizModalContainer} ${variant === 'inline' ? styles.quizModalContainerInline : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={styles.quizModalHeader}>
        <div className={styles.quizModalHeaderContent}>
          <h2 className={styles.quizModalTitle}>{survey.title}</h2>
          <button
            onClick={(e) => handleClose(e)}
            className={styles.quizModalClose}
            aria-label="Close survey"
          >
            x
          </button>
        </div>

        {/* Progress Bar */}
        <div className={styles.quizModalProgressContainer}>
          <div
            className={styles.quizModalProgressBar}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={styles.quizModalProgressText}>
          {isLikertSurvey
            ? `Questions ${pageStart + 1}-${pageEnd} of ${survey.questions.length}`
            : `Question ${pageStart + 1} of ${survey.questions.length}`}
        </p>
      </div>

      {/* Question Content */}
      <div className={styles.quizModalContent}>
        {isLikertSurvey ? (
          <div className={styles.quizModalLikertList}>
            {currentQuestions[0]?.options && (
              <div className={styles.quizModalLikertLegend} aria-hidden="true">
                {currentQuestions[0].options.map((option, index) => (
                  <span key={option}>{index + 1}. {option}</span>
                ))}
              </div>
            )}
            {currentQuestions.map((question) => (
              <div key={question.id} className={styles.quizModalLikertQuestion}>
                <h3 className={styles.quizModalLikertQuestionText}>
                  {question.id}. {question.text}
                </h3>
                <div className={styles.quizModalLikertOptions} role="radiogroup" aria-label={question.text}>
                  {question.options.map((option, index) => {
                    const isSelected = answers[question.id] === option

                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(question, option)}
                        className={`${styles.quizModalLikertOption} ${isSelected ? styles.quizModalLikertOptionSelected : ''}`}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${option}: ${question.text}`}
                      >
                        {index + 1}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {currentQuestions.map((currentQuestion) => (
              <div key={currentQuestion.id}>
                <div className={styles.quizModalQuestion}>
                  <h3 className={styles.quizModalQuestionText}>
                    {currentQuestion.text}
                  </h3>
                </div>

                {/* Answer Options */}
                <div className={styles.quizModalOptions}>
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = answers[currentQuestion.id] === option

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(currentQuestion, option)}
                        className={`${styles.quizModalOption} ${isSelected ? styles.quizModalOptionSelected : ''}`}
                        type="button"
                      >
                        <div className={styles.quizModalOptionContent}>
                          <div className={`${styles.quizModalOptionIndicator} ${isSelected ? styles.quizModalOptionIndicatorSelected : ''}`}>
                            {isSelected && (
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2 6L5 9L10 3"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span className={styles.quizModalOptionText}>
                            {option}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer Navigation */}
      <div className={styles.quizModalFooter}>
        <div className={styles.quizModalFooterButtons}>
          <button
            onClick={handlePrevious}
            disabled={currentPageIndex === 0}
            className={`${styles.quizModalButton} ${styles.quizModalButtonSecondary}`}
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={!hasPageAnswers || isSubmitting}
            className={`${styles.quizModalButton} ${styles.quizModalButtonPrimary}`}
          >
            {isSubmitting ? 'Submitting...' : isLastPage ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )

  if (variant === 'inline') {
    return <div className={styles.quizModalInlineShell}>{panelContent}</div>
  }

  return createPortal((
    <div
      className={styles.quizModalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      {panelContent}
    </div>
  ), document.body)
}
