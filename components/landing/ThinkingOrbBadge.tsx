'use client';

import { useId } from 'react';
import { ThinkingOrb, type OrbSize, type OrbState } from 'thinking-orbs';

import styles from './ThinkingOrbBadge.module.css';

interface ThinkingOrbBadgeProps {
  label: string;
  /** Which orb animation to run. */
  state?: OrbState;
  /**
   * Which tuned preset to render. The library ships exactly two — 64 and 20 —
   * as separate designs, and any other value throws inside `resolvePreset`.
   */
  size?: OrbSize;
  /**
   * Painted width in CSS px, if it should differ from the preset. Downscaling
   * the 64 preset supersamples it, so it stays crisp at in-between sizes;
   * upscaling the 20 preset would not.
   */
  displaySize?: number;
  /** Stretch to the container's width instead of hugging the label. */
  block?: boolean;
  className?: string;
}

/**
 * A pill pairing a ThinkingOrb with a label, in the landing's white-on-dark
 * treatment. The orb shades its dots by both grey level and per-dot alpha and
 * exposes no prop for either, so the depth shading is flattened by an SVG
 * filter: the colour matrix forces every dot to pure white, and the alpha ramp
 * drives anything above a faint edge to full opacity. The filter id is scoped
 * per instance so several badges can coexist on one page.
 */
export function ThinkingOrbBadge({
  label,
  state = 'solving',
  size = 20,
  displaySize,
  block = false,
  className,
}: ThinkingOrbBadgeProps) {
  const filterId = `thinking-orb-solid-${useId().replace(/:/g, '')}`;

  return (
    <span
      className={[styles.badge, block ? styles.block : '', className].filter(Boolean).join(' ')}
    >
      <span
        className={styles.orb}
        style={{ ['--orb-filter' as string]: `url('#${filterId}')` }}
      >
        <svg className={styles.filterHost} aria-hidden="true" focusable="false">
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 1 0"
            />
            <feComponentTransfer>
              <feFuncA type="linear" slope="4" intercept="0" />
            </feComponentTransfer>
          </filter>
        </svg>
        {/* The component writes width/height inline from `size`, so a stylesheet
            rule cannot resize it — but it spreads `style` last, which can. */}
        <ThinkingOrb
          state={state}
          size={size}
          theme="dark"
          style={{ width: displaySize ?? size, height: displaySize ?? size }}
        />
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}

export default ThinkingOrbBadge;
