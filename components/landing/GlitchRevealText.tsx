'use client';

import React from 'react';
import styles from './GlitchRevealText.module.css';

interface Line {
  text: string;
  accent?: boolean;
}

interface GlitchRevealTextProps {
  lines: Line[];
  className?: string;
  accentClassName?: string;
  as?: 'h1' | 'h2' | 'h3' | 'div' | 'p';
  staggerDelay?: number;
  duration?: number;
  startDelay?: number;
}

const X_OFFSETS = [3, -4, 2, -3, 5, -2, 4, -5, 3, -4, 2, -3, 5, -2, 4, -5];

export const GlitchRevealText: React.FC<GlitchRevealTextProps> = ({
  lines,
  className,
  accentClassName,
  as: Tag = 'h1',
  staggerDelay = 50,
  duration = 1000,
  startDelay = 200,
}) => {
  let charIndex = 0;

  return (
    <Tag className={className} aria-label={lines.map((l) => l.text).join(' ')}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className={styles.line}>
          {line.text.split('').map((char) => {
            const idx = charIndex++;
            const offset = X_OFFSETS[idx % X_OFFSETS.length];
            const delay = startDelay + idx * staggerDelay;
            return (
              <span
                key={idx}
                className={`${styles.char}${line.accent && accentClassName ? ` ${accentClassName}` : ''}`}
                style={{
                  '--delay': `${delay}ms`,
                  '--duration': `${duration}ms`,
                  '--x-offset': `${offset}px`,
                } as React.CSSProperties}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
};

export default GlitchRevealText;
