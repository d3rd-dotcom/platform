'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderDashed } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import AngelUpsellModal from '@/components/angel-upsell-modal/AngelUpsellModal';
import styles from './EmptyCourseStudioFolder.module.css';

interface EmptyCourseStudioFolderProps {
  /** Holding an Academic Angel unlocks the course builder; without one the
      upsell gate opens instead of navigating. */
  hasAngel?: boolean;
}

export default function EmptyCourseStudioFolder({ hasAngel = false }: EmptyCourseStudioFolderProps) {
  const router = useRouter();
  const { play } = useSound();
  const [angelGateOpen, setAngelGateOpen] = useState(false);

  const handleAction = () => {
    play('click');
    if (!hasAngel) {
      setAngelGateOpen(true);
      return;
    }
    router.push('/course-builder');
  };

  return (
    <section
      className={styles.container}
      aria-labelledby="course-studio-empty-title"
      onMouseEnter={() => play('soft-hover')}
    >
      <div className={styles.card}>
        <div className={styles.illustration} aria-hidden="true">
          <FolderDashed size={32} weight="duotone" />
        </div>

        <h3 id="course-studio-empty-title" className={styles.title}>
          Course Studio
        </h3>

        <p className={styles.description}>
          Your custom syllabus workspace is currently empty.
        </p>

        <button
          type="button"
          className={styles.actionButton}
          onClick={handleAction}
        >
          Build a Course
        </button>
      </div>

      <AngelUpsellModal isOpen={angelGateOpen} onClose={() => setAngelGateOpen(false)} />
    </section>
  );
}
