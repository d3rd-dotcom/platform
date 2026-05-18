'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { IntakeAnswers } from '@/lib/personal-course';
import styles from './SoulModal.module.css';

interface SoulModalProps {
  onClose: () => void;
}

export default function SoulModal({ onClose }: SoulModalProps) {
  // The intake answers Blue keeps for this user. We hold the full object so a
  // save replaces only voiceContext and leaves the rest of the intake intact.
  const [intake, setIntake] = useState<IntakeAnswers>({});
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/course/personal', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const answers: IntakeAnswers = d?.course?.intakeData ?? {};
        setIntake(answers);
        setDraft(answers.voiceContext ?? '');
      })
      .catch(() => {/* guest — start from an empty context note */})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    const next = { ...intake, voiceContext: draft.trim() };
    fetch('/api/course/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ answers: next }),
    })
      .catch(() => {/* guests aren't persisted */})
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }, [intake, draft, onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Context.md</h2>
        <p className={styles.hint}>
          Context Blue keeps about you. She reads this so her help stays specific to who you are.
        </p>
        <textarea
          className={styles.textarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={11}
          disabled={loading}
          placeholder={loading ? 'Loading your context…' : "Anything you want Blue to know — what you're working through, what matters, what to avoid…"}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.save} onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
