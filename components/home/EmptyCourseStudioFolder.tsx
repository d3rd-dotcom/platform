'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FolderDashed } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './EmptyCourseStudioFolder.module.css';

export default function EmptyCourseStudioFolder() {
  const router = useRouter();
  const { play } = useSound();

  const handleAction = () => {
    play('click');
    router.push('/course-builder');
  };

  return (
    <section
      className={styles.container}
      aria-labelledby="course-studio-empty-title"
      onMouseEnter={() => play('soft-hover')}
    >
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
    </section>
  );
}
