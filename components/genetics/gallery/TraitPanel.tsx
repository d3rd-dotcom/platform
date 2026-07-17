'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './TraitPanel.module.css';

interface TraitPanelProps {
  open: boolean;
  title: string;
  /** Small facts that belong next to the title: your call, magnitude. */
  chips?: string[];
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The reading surface. It sits over the room rather than under it: the wall text
 * for a marker is something you open and close, and a short SNPedia entry left a
 * terminal-sized hole under the gallery on every piece that had little to say.
 *
 * Dark, because it is a panel in a lit room — and `data-theme` lets the shared
 * wiki/genoset/chat components pick the palette up from tokens.
 */
export function TraitPanel({ open, title, chips, subtitle, onClose, children }: TraitPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // A new marker is a new document — start it at the top.
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [open, title]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      data-theme="dark"
      aria-hidden={!open}
    >
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {!!chips?.length && (
            <div className={styles.chips}>
              {chips.map((c) => (
                <span key={c} className={styles.chip}>{c}</span>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} className={styles.close} aria-label="Close panel">
          ×
        </button>
      </header>

      <div ref={bodyRef} className={styles.body}>
        {children}
      </div>
    </aside>
  );
}
