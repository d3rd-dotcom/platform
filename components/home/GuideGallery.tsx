'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from '@phosphor-icons/react';
import type { GuideRecord } from '@/lib/guides-db';
import { getWellbeingDomain } from '@/lib/wellbeing-domains';
import { EDUCATION_LEVELS, GUIDE_GOALS, type EducationLevel, type GuideGoal } from '@/lib/guide-discovery-filters';
import { useSound } from '@/hooks/useSound';
import styles from './GuideGallery.module.css';

const NO_SUBJECT = 'General';
const GUIDES_PER_PAGE = 12;

export type GuideFilterState = {
  educationLevels: EducationLevel[];
  goals: GuideGoal[];
};

/** Deterministic 32-bit hash of a string — stable seed per guide. */
function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small seeded PRNG (mulberry32) so each cover renders the same every time. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COVER_W = 300;
const COVER_H = 168;

/**
 * A per-guide "futuristic data overlay": a halftone dot field, a seeded signal
 * trace, concentric sensor rings, HUD registration ticks, and a readout chip —
 * all in brand primary at low opacity over a tinted panel. Deterministic from
 * the guide id, so a topic always wears the same face.
 */
function GuideCoverArt({ seed, label }: { seed: string; label: string }) {
  const art = useMemo(() => {
    const rng = mulberry32(hashSeed(seed));
    const hex = hashSeed(seed).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);

    // Halftone dot field — density modulated by the seed.
    const cols = 11;
    const rows = 6;
    const dots: Array<{ cx: number; cy: number; r: number; o: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jitter = rng();
        dots.push({
          cx: 22 + c * ((COVER_W - 44) / (cols - 1)),
          cy: 22 + r * ((COVER_H - 44) / (rows - 1)),
          r: 0.9 + jitter * 1.9,
          o: 0.06 + jitter * 0.16,
        });
      }
    }

    // Signal trace — a jagged data line reading left to right.
    const steps = 9;
    const baseY = COVER_H * (0.52 + rng() * 0.14);
    const amp = 22 + rng() * 20;
    let signal = '';
    for (let s = 0; s <= steps; s++) {
      const x = 18 + s * ((COVER_W - 36) / steps);
      const y = baseY + (rng() * 2 - 1) * amp;
      signal += `${s === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }

    // Concentric sensor rings around a seeded focal point.
    const fx = COVER_W * (0.62 + rng() * 0.24);
    const fy = COVER_H * (0.28 + rng() * 0.2);
    const rings = [16, 30, 46].map((rr) => rr + rng() * 6);

    const scanY = COVER_H * (0.2 + rng() * 0.6);

    return { dots, signal, fx, fy, rings, scanY, hex };
  }, [seed]);

  return (
    <svg
      className={styles.coverArt}
      viewBox={`0 0 ${COVER_W} ${COVER_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${label} cover`}
    >
      <g className={styles.coverDots}>
        {art.dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} style={{ opacity: d.o }} />
        ))}
      </g>

      <g className={styles.coverRings}>
        {art.rings.map((r, i) => (
          <circle key={i} cx={art.fx} cy={art.fy} r={r} />
        ))}
        <circle className={styles.coverRingCore} cx={art.fx} cy={art.fy} r={3.2} />
      </g>

      <line
        className={styles.coverScan}
        x1={0}
        x2={COVER_W}
        y1={art.scanY}
        y2={art.scanY}
      />

      <path className={styles.coverSignal} d={art.signal} fill="none" />

      {/* HUD registration ticks in each corner. */}
      <g className={styles.coverTicks}>
        <path d="M 10 20 L 10 10 L 20 10" fill="none" />
        <path d={`M ${COVER_W - 20} 10 L ${COVER_W - 10} 10 L ${COVER_W - 10} 20`} fill="none" />
        <path d={`M 10 ${COVER_H - 20} L 10 ${COVER_H - 10} L 20 ${COVER_H - 10}`} fill="none" />
        <path
          d={`M ${COVER_W - 20} ${COVER_H - 10} L ${COVER_W - 10} ${COVER_H - 10} L ${COVER_W - 10} ${COVER_H - 20}`}
          fill="none"
        />
      </g>

      <text className={styles.coverReadout} x={14} y={COVER_H - 14}>
        0x{art.hex}
      </text>
    </svg>
  );
}

function GuideGalleryCard({ guide }: { guide: GuideRecord }) {
  const { play } = useSound();
  const primarySubject = guide.subjects[0] ?? NO_SUBJECT;
  const domain = getWellbeingDomain(primarySubject);
  const meta = domain?.label ?? primarySubject;

  return (
    <Link
      href={`/learn/guides/${guide.slug}`}
      className={styles.card}
      onMouseEnter={() => play('soft-hover')}
    >
      <div className={styles.cover}>
        <GuideCoverArt seed={guide.id} label={guide.topicTitle} />
        <span className={styles.coverTag}>{meta}</span>
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardTitle}>{guide.topicTitle}</span>
        {guide.summary && <span className={styles.cardSummary}>{guide.summary}</span>}
      </div>
    </Link>
  );
}

export default function GuideGallery({ guides, filters }: { guides: GuideRecord[]; filters: GuideFilterState }) {
  const [page, setPage] = useState(1);

  const visibleGuides = useMemo(() => {
    return guides.filter((guide) =>
      (filters.educationLevels.length === 0 || filters.educationLevels.some((level) => guide.educationLevels.includes(level)))
      && (filters.goals.length === 0 || filters.goals.some((goal) => guide.goals.includes(goal))),
    );
  }, [guides, filters]);

  const pageCount = Math.ceil(visibleGuides.length / GUIDES_PER_PAGE);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const pageStart = (currentPage - 1) * GUIDES_PER_PAGE;
  const pageGuides = visibleGuides.slice(pageStart, pageStart + GUIDES_PER_PAGE);
  const leadingPages = Array.from({ length: Math.min(3, pageCount) }, (_, index) => index + 1);

  useEffect(() => {
    setPage(1);
  }, [filters.educationLevels, filters.goals]);

  if (guides.length === 0) return null;

  return (
    <div className={styles.gallery}>
      <div className={styles.results}>
        <div className={styles.grid}>
          {pageGuides.map((guide) => (
            <GuideGalleryCard key={guide.id} guide={guide} />
          ))}
        </div>
        {visibleGuides.length === 0 && <p className={styles.empty}>No guides match these filters yet.</p>}
        {pageCount > 1 && (
          <nav className={styles.pagination} aria-label="Guide pages">
            <button type="button" className={styles.paginationButton} onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>
              Previous
            </button>
            <div className={styles.paginationPages}>
              {leadingPages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`${styles.paginationPageButton} ${pageNumber === currentPage ? styles.paginationPageButtonActive : ''}`}
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === currentPage ? 'page' : undefined}
                >
                  {pageNumber}
                </button>
              ))}
              {pageCount > 4 && <span className={styles.paginationEllipsis} aria-hidden="true">…</span>}
              {pageCount > 3 && (
                <button
                  type="button"
                  className={`${styles.paginationPageButton} ${pageCount === currentPage ? styles.paginationPageButtonActive : ''}`}
                  onClick={() => setPage(pageCount)}
                  aria-current={pageCount === currentPage ? 'page' : undefined}
                >
                  {pageCount}
                </button>
              )}
            </div>
            <button type="button" className={styles.paginationButton} onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount}>
              Next
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

export function GuideFilterSidebar({ filters, onChange }: {
  filters: GuideFilterState;
  onChange: (filters: GuideFilterState) => void;
}) {
  return (
    <div className={styles.filters} aria-label="Guide filters">
      <FilterGroup
        label="Education level"
        options={EDUCATION_LEVELS}
        selected={filters.educationLevels}
        onChange={(educationLevels) => onChange({ ...filters, educationLevels })}
      />
      <FilterGroup
        label="Goals"
        options={GUIDE_GOALS}
        selected={filters.goals}
        onChange={(goals) => onChange({ ...filters, goals })}
      />
    </div>
  );
}

function FilterGroup<T extends string>({ label, options, selected, onChange }: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const { play } = useSound();
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
    play('soft-hover');
  };
  return (
    <section className={styles.filterGroup}>
      <h2 className={styles.filterTitle}>{label}</h2>
      <button type="button" className={styles.filterOption} onClick={() => onChange([])} aria-pressed={selected.length === 0}>
        <span className={`${styles.checkmark} ${selected.length === 0 ? styles.checkmarkSelected : ''}`}>{selected.length === 0 && <Check size={13} weight="bold" />}</span>
        All
      </button>
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button key={option} type="button" className={styles.filterOption} onClick={() => toggle(option)} aria-pressed={active}>
            <span className={`${styles.checkmark} ${active ? styles.checkmarkSelected : ''}`}>{active && <Check size={13} weight="bold" />}</span>
            {option}
          </button>
        );
      })}
    </section>
  );
}
