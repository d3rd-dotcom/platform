'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, FloppyDisk, Eye, Lock, ArrowLeft, ArrowRight, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

interface RoleGatePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoleGatePopup({ isOpen, onClose }: RoleGatePopupProps) {
  const router = useRouter();
  const { play } = useSound();
  const [phase, setPhase] = useState<'choose' | 'researcher' | 'case-study'>('choose');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setPhase('choose');
      setPassword('');
      setPasswordError(false);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSubject = useCallback(() => {
    play('click');
    onClose();
    router.push('/home');
  }, [onClose, router, play]);

  const handleResearcher = useCallback(() => {
    play('click');
    setPhase('researcher');
  }, [play]);

  const handlePasswordSubmit = useCallback(() => {
    if (password.toLowerCase() === 'ethereal') {
      play('click');
      setPasswordError(false);
      setPhase('case-study');
    } else {
      setPasswordError(true);
    }
  }, [password, play]);

  const handleBackToChoose = useCallback(() => {
    play('click');
    setPhase('choose');
    setPassword('');
    setPasswordError(false);
  }, [play]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.roleGateOverlay} onClick={onClose}>
      <div className={styles.roleGateCard} onClick={(e) => e.stopPropagation()}>
        <button className={styles.roleGateClose} onClick={onClose} aria-label="Close">
          <X size={20} weight="bold" />
        </button>

        {phase === 'choose' && (
          <div className={styles.roleGateBody}>
            <div className={styles.roleGateIconRow}>
              <span className={styles.roleGateEmblem}>✦</span>
            </div>
            <h2 className={styles.roleGateQuestion}>
              Do you wish to participate<br />as a <em>researcher</em>, or <em>subject</em>?
            </h2>
            <p className={styles.roleGateSubtext}>
              Your path determines how you move through the Academy.
            </p>
            <div className={styles.roleGateActions}>
              <button
                type="button"
                className={styles.roleGateBtnSubject}
                onClick={handleSubject}
                onMouseEnter={() => play('hover')}
              >
                <Eye size={20} weight="duotone" />
                <span className={styles.roleGateBtnLabel}>Subject</span>
                <span className={styles.roleGateBtnDesc}>Standard Track</span>
              </button>
              <button
                type="button"
                className={styles.roleGateBtnResearcher}
                onClick={handleResearcher}
                onMouseEnter={() => play('hover')}
              >
                <MagnifyingGlass size={20} weight="duotone" />
                <span className={styles.roleGateBtnLabel}>Researcher</span>
                <span className={styles.roleGateBtnDesc}>Research Access</span>
              </button>
            </div>
          </div>
        )}

        {phase === 'researcher' && (
          <div className={styles.roleGateBody}>
            <div className={styles.roleGateIconRow}>
              <Lock size={28} weight="duotone" className={styles.roleGateLockIcon} />
            </div>
            <h2 className={styles.roleGateQuestion}>
              Authentication Required
            </h2>
            <p className={styles.roleGateSubtext}>
              Enter your researcher credentials to access the case study.
            </p>
            <div className={styles.roleGatePasswordWrap}>
              <input
                type="password"
                className={`${styles.roleGatePasswordInput}${passwordError ? ` ${styles.roleGatePasswordError}` : ''}`}
                placeholder="Enter password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                autoFocus
              />
              {passwordError && (
                <p className={styles.roleGatePasswordErrorText}>Incorrect password. Access denied.</p>
              )}
            </div>
            <div className={styles.roleGatePasswordActions}>
              <button type="button" className={styles.roleGateBackBtn} onClick={handleBackToChoose}>
                <ArrowLeft size={16} weight="bold" />
                Back
              </button>
              <button type="button" className={styles.roleGateUnlockBtn} onClick={handlePasswordSubmit}>
                <Lock size={16} weight="bold" />
                Unlock
              </button>
            </div>
          </div>
        )}

        {phase === 'case-study' && (
          <div className={styles.roleGateBody}>
            <div className={styles.roleGateCaseStudy}>
              <div className={styles.caseStudyHeader}>
                <div className={styles.caseStudyBadge}>
                  <ShieldCheck size={14} weight="fill" />
                  CONFIDENTIAL — IRB #MWA-2026-001
                </div>
                <p className={styles.caseStudyStatus}>Ongoing</p>
              </div>

              <div className={styles.caseStudyTitleBlock}>
                <FloppyDisk size={18} weight="duotone" />
                <h3 className={styles.caseStudyTitle}>Ethereal Horizon: Phase IV</h3>
              </div>

              <div className={styles.caseStudyMeta}>
                <div className={styles.caseStudyMetaRow}>
                  <span className={styles.caseStudyMetaLabel}>Principal Investigator</span>
                  <span className={styles.caseStudyMetaValue}>Dr. A. Vantage</span>
                </div>
                <div className={styles.caseStudyMetaRow}>
                  <span className={styles.caseStudyMetaLabel}>Protocol</span>
                  <span className={styles.caseStudyMetaValue}>MWA-R-0042</span>
                </div>
                <div className={styles.caseStudyMetaRow}>
                  <span className={styles.caseStudyMetaLabel}>Enrolled Subjects</span>
                  <span className={styles.caseStudyMetaValue}>1,247</span>
                </div>
                <div className={styles.caseStudyMetaRow}>
                  <span className={styles.caseStudyMetaLabel}>Data Points</span>
                  <span className={styles.caseStudyMetaValue}>84,392</span>
                </div>
              </div>

              <div className={styles.caseStudyAbstract}>
                <p className={styles.caseStudyAbstractText}>
                  A longitudinal behavioral intervention study examining the effects of structured
                  reality-narrative reconditioning on psychological resilience, financial decision-making,
                  and identity formation. Subjects interact with an AI companion (codenamed "Blue") through
                  a gamified curriculum designed to measure and modify belief systems at scale.
                </p>
              </div>

              <div className={styles.caseStudyAccessNote}>
                Full data access requires verified researcher credentials and IRB approval.
              </div>

              <button
                type="button"
                className={styles.caseStudyEnterBtn}
                onClick={() => { play('click'); onClose(); router.push('/home'); }}
                onMouseEnter={() => play('hover')}
              >
                Enter as Researcher
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
