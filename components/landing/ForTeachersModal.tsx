'use client';

import React, { useEffect, useState } from 'react';
import {
  ChalkboardTeacher,
  UsersThree,
  BookOpen,
  Folders,
  Sparkle,
  ChatsCircle,
  Waveform,
  X,
  UploadSimple,
} from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

type TeacherTab = 'class' | 'ai' | 'options';

const TABS: { id: TeacherTab; label: string }[] = [
  { id: 'class', label: 'Your class' },
  { id: 'ai', label: 'AI review' },
  { id: 'options', label: 'Options' },
];

/** Visual-only upload row. No file handling wired up yet. */
function UploadField({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <label className={styles.teachersUpload}>
      <span className={styles.teachersUploadIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.teachersUploadText}>
        <span className={styles.teachersUploadLabel}>{label}</span>
        <span className={styles.teachersUploadHint}>{hint}</span>
      </span>
      <span className={styles.teachersUploadAction} aria-hidden="true">
        <UploadSimple size={16} weight="bold" />
      </span>
      <input type="file" className={styles.teachersUploadInput} />
    </label>
  );
}

/** Visual-only toggle. */
function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={styles.teachersToggleRow}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className={styles.teachersToggleIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.teachersToggleText}>
        <span className={styles.teachersToggleLabel}>{label}</span>
        <span className={styles.teachersToggleDescription}>{description}</span>
      </span>
      <span
        className={`${styles.teachersToggle} ${checked ? styles.teachersToggleOn : ''}`}
        aria-hidden="true"
      >
        <span className={styles.teachersToggleKnob} />
      </span>
    </button>
  );
}

export default function ForTeachersModal() {
  const { play } = useSound();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<TeacherTab>('class');
  const [submitted, setSubmitted] = useState(false);
  const [socialPortal, setSocialPortal] = useState(true);
  const [audioGuide, setAudioGuide] = useState(true);

  const open = () => {
    play('click');
    setTab('class');
    setSubmitted(false);
    setIsOpen(true);
  };

  const close = () => {
    play('click');
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        onMouseEnter={() => play('hover')}
        className={`${styles.fancyButton} ${styles.fancyButtonTeachers}`}
      >
        <span className={styles.fancyButtonInner}>
          <span className={styles.fancyButtonIcon} aria-hidden="true">
            <ChalkboardTeacher size={20} weight="regular" />
          </span>
          <span className={styles.heroSlideWrap}>
            <span className={styles.heroSlideText}>For Teachers</span>
            <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>For Teachers</span>
          </span>
        </span>
      </button>

      {isOpen && (
        <div
          className={styles.teachersOverlay}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="For teachers"
        >
          <div className={styles.teachersModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.teachersClose}
              onClick={close}
              onMouseEnter={() => play('hover')}
              aria-label="Close"
            >
              <X size={18} weight="bold" />
            </button>

            <div className={styles.teachersHeader}>
              <span className={styles.teachersHeaderIcon} aria-hidden="true">
                <ChalkboardTeacher size={22} weight="fill" />
              </span>
              <div>
                <h2 className={styles.teachersTitle}>Bring your classroom in</h2>
                <p className={styles.teachersSubtitle}>
                  Set up your cohort, curriculum, and AI guide in one place.
                </p>
              </div>
            </div>

            {submitted ? (
              <div className={styles.teachersSuccess}>
                <span className={styles.teachersSuccessIcon} aria-hidden="true">
                  <Sparkle size={26} weight="fill" />
                </span>
                <p className={styles.teachersSuccessTitle}>You are on the list</p>
                <p className={styles.teachersSuccessText}>
                  We will reach out to finish setting up your classroom.
                </p>
                <button
                  type="button"
                  className={styles.teachersSubmit}
                  onClick={close}
                  onMouseEnter={() => play('hover')}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className={styles.teachersTabs} role="tablist">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.id}
                      className={`${styles.teachersTab} ${tab === t.id ? styles.teachersTabActive : ''}`}
                      onClick={() => {
                        play('hover');
                        setTab(t.id);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className={styles.teachersBody}>
                  {tab === 'class' && (
                    <div className={styles.teachersPanel}>
                      <UploadField
                        icon={<UsersThree size={20} weight="regular" />}
                        label="Student list"
                        hint="CSV or spreadsheet of names and emails"
                      />
                      <UploadField
                        icon={<BookOpen size={20} weight="regular" />}
                        label="Curriculum"
                        hint="Your syllabus or week-by-week outline"
                      />
                      <UploadField
                        icon={<Folders size={20} weight="regular" />}
                        label="Course materials"
                        hint="Readings, slides, worksheets, and media"
                      />
                    </div>
                  )}

                  {tab === 'ai' && (
                    <div className={styles.teachersPanel}>
                      <div className={styles.teachersAiCard}>
                        <span className={styles.teachersAiIcon} aria-hidden="true">
                          <Sparkle size={22} weight="fill" />
                        </span>
                        <div className={styles.teachersAiText}>
                          <p className={styles.teachersAiTitle}>AI review assistant</p>
                          <p className={styles.teachersAiDescription}>
                            Blue reads student submissions and drafts feedback, flags
                            work that needs your eyes, and keeps a running summary of how
                            the class is doing.
                          </p>
                        </div>
                      </div>
                      <textarea
                        className={styles.teachersTextarea}
                        placeholder="How should the assistant grade and give feedback? Describe your rubric or tone."
                        rows={4}
                      />
                    </div>
                  )}

                  {tab === 'options' && (
                    <div className={styles.teachersPanel}>
                      <ToggleRow
                        icon={<ChatsCircle size={20} weight="regular" />}
                        label="Social portal"
                        description="A private space for your students to chat and study together."
                        checked={socialPortal}
                        onChange={setSocialPortal}
                      />
                      <ToggleRow
                        icon={<Waveform size={20} weight="regular" />}
                        label="AI audio tutorials"
                        description="Let the AI guide narrate lessons as spoken audio walkthroughs."
                        checked={audioGuide}
                        onChange={setAudioGuide}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className={styles.teachersSubmit}
                  onClick={() => {
                    play('click');
                    setSubmitted(true);
                  }}
                  onMouseEnter={() => play('hover')}
                >
                  Request access
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
