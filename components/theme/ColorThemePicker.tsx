'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSound } from '@/hooks/useSound';
import { useTheme, COLOR_THEMES } from '@/components/theme/ThemeProvider';
import styles from './ColorThemePicker.module.css';

/**
 * Accent-colour picker. Sits beside the light/dark toggle and lets users tint
 * the whole UI with a calmer palette — an accessibility option for
 * light-sensitive and neurodivergent users. The lightness (light/dark) and
 * hue (this picker) axes are independent.
 */
const ColorThemePicker: React.FC = () => {
  const { play } = useSound();
  const { colorTheme, setColorTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const activeLabel = COLOR_THEMES.find((c) => c.id === colorTheme)?.label ?? 'Academy';

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          play('toggle-on');
          setOpen((v) => !v);
        }}
        onMouseEnter={() => play('hover')}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Colour theme: ${activeLabel}. Change colour theme`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.012 17.5 2 12 2z" />
        </svg>
      </button>

      {open && (
        <div className={styles.popover} role="menu" aria-label="Colour themes">
          <p className={styles.heading}>Colour theme</p>
          <div className={styles.grid}>
            {COLOR_THEMES.map((c) => {
              const active = c.id === colorTheme;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className={`${styles.swatchBtn} ${active ? styles.swatchActive : ''}`}
                  onClick={() => {
                    play('toggle-on');
                    setColorTheme(c.id);
                  }}
                  onMouseEnter={() => play('hover')}
                >
                  <span className={styles.swatch} style={{ background: c.swatch }} aria-hidden="true" />
                  <span className={styles.swatchLabel}>{c.label}</span>
                </button>
              );
            })}
          </div>
          <p className={styles.hint}>Softer palettes reduce visual strain.</p>
        </div>
      )}
    </div>
  );
};

export default ColorThemePicker;
