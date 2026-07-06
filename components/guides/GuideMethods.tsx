'use client';

import { useState } from 'react';
import { CaretDown, Path } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import GuideBody from './GuideBody';
import type { GuideMethodRecord } from '@/lib/guides-db';
import styles from './GuideMethods.module.css';

export default function GuideMethods({ methods }: { methods: GuideMethodRecord[] }) {
  const { play } = useSound();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!methods || methods.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        <Path size={18} weight="fill" className={styles.headingIcon} aria-hidden />
        Methods
      </h2>
      <div className={styles.list}>
        {methods.map((m) => {
          const open = openId === m.id;
          return (
            <div key={m.id} className={`${styles.item} ${open ? styles.itemOpen : ''}`}>
              <button
                type="button"
                className={styles.trigger}
                onMouseEnter={() => play('soft-hover')}
                onClick={() => {
                  play(open ? 'toggle-off' : 'toggle-on');
                  setOpenId(open ? null : m.id);
                }}
                aria-expanded={open}
              >
                <span className={styles.triggerTitle}>{m.title}</span>
                <CaretDown
                  size={16}
                  weight="bold"
                  className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
                />
              </button>
              {open && (
                <div className={styles.panel}>
                  <GuideBody body={m.body} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
