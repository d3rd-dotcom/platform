'use client';

import React, { useCallback, useMemo, useState } from 'react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import SurveyController from '@/components/survey-controller/SurveyController';
import SurveySpace from '@/components/survey-space/SurveySpace';
import BlueTerminal from '@/components/blue-terminal/BlueTerminal';
import QuizModal from '@/components/survey/QuizModal';
import SurveyResultsModal from '@/components/survey/SurveyResultsModal';
import { STANDARD_SURVEYS } from '@/components/survey/Surveys';
import type { Survey, SurveyAnswers, SurveyResults } from '@/components/survey/types';
import { VIA_SURVEY } from '@/components/survey/viaQuestions';
import styles from './page.module.css';

const AVAILABLE_SURVEYS: Survey[] = [VIA_SURVEY, ...STANDARD_SURVEYS];

function getSurveyById(id: string): Survey {
  return AVAILABLE_SURVEYS.find((survey) => survey.id === id) ?? AVAILABLE_SURVEYS[0];
}

function getSurveyIntroCopy(survey: Survey): { meta: string; text: string; note: string } {
  if (survey.questionType === 'likert') {
    return {
      meta: 'Character strengths quiz',
      text: 'Meet your best-self build. The part of you that tells the truth, makes good trouble, keeps promises, and notices the magic in the room. Tap what feels uncomfortably accurate; Blue will handle the pattern read.',
      note: 'Long quiz, fast rhythm. Ten items per page.',
    };
  }

  return {
    meta: '10 question personality read',
    text: 'A short personality quiz with sharper teeth. Pick the answer with the strongest charge and let Blue turn the pattern into a clean read.',
    note: 'No wrong answers. Only suspiciously revealing ones.',
  };
}

export default function SurveysPage() {
  const [selectedSurveyId, setSelectedSurveyId] = useState(AVAILABLE_SURVEYS[0].id);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [surveyResults, setSurveyResults] = useState<SurveyResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedSurvey = useMemo(() => getSurveyById(selectedSurveyId), [selectedSurveyId]);
  const selectedSurveyIntro = useMemo(() => getSurveyIntroCopy(selectedSurvey), [selectedSurvey]);

  const handleSurveyTypeChange = useCallback((surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setErrorMessage(null);
    setShowQuizModal(false);
    setShowResultsModal(false);
    setActiveSurvey(null);
    setSurveyResults(null);
  }, []);

  const handleStartSurvey = useCallback(() => {
    setActiveSurvey(selectedSurvey);
    setShowQuizModal(true);
    setShowResultsModal(false);
    setSurveyResults(null);
    setErrorMessage(null);
  }, [selectedSurvey]);

  const handleSurveyComplete = useCallback(async (answers: SurveyAnswers) => {
    if (!activeSurvey) return;

    try {
      const processResponse = await fetch('/api/survey/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          surveyId: activeSurvey.id,
          surveyTitle: activeSurvey.title,
          answers,
        }),
      });

      const processData: { success?: boolean; results?: SurveyResults; error?: string } =
        await processResponse.json().catch(() => ({}));

      if (!processResponse.ok || !processData.success || !processData.results) {
        throw new Error(processData.error || 'Failed to process survey results.');
      }

      setSurveyResults(processData.results);
      setShowQuizModal(false);
      setShowResultsModal(true);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete survey. Please try again.';
      setErrorMessage(message);
      alert(message);
      throw error;
    }
  }, [activeSurvey]);

  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.content}>
        <SurveyController
          selectedSurveyId={selectedSurveyId}
          onSurveyTypeChange={handleSurveyTypeChange}
          onStartSurvey={handleStartSurvey}
          showDifficulty={false}
          ctaLabel="Begin survey"
        />
        <SurveySpace label="" badges={[]}>
          {showQuizModal ? (
            <QuizModal
              isOpen={showQuizModal}
              onClose={() => {
                setShowQuizModal(false);
                setActiveSurvey(null);
              }}
              survey={activeSurvey}
              variant="inline"
              onComplete={handleSurveyComplete}
            />
          ) : showResultsModal ? (
            <SurveyResultsModal
              isOpen={showResultsModal}
              onClose={() => {
                setShowResultsModal(false);
                setSurveyResults(null);
              }}
              results={surveyResults}
              variant="inline"
            />
          ) : (
            <BlueTerminal
              errorMessage={errorMessage}
              idleMeta={selectedSurveyIntro.meta}
              idleTitle={selectedSurvey.title}
              idleText={selectedSurveyIntro.text}
              idleNote={selectedSurveyIntro.note}
            />
          )}
        </SurveySpace>
      </main>
    </div>
  );
}
