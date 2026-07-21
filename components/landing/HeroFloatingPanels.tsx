'use client';

import React, { useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import styles from './HeroFloatingPanels.module.css';

type PanelMedia =
  | { kind: 'video'; src: string }
  | { kind: 'image'; src: string; alt: string };

interface PanelSpec {
  id: string;
  title: string;
  caption: string;
  media: PanelMedia;
  posClass: string;
}

const PANELS: PanelSpec[] = [
  {
    id: 'researcher',
    title: 'The researcher',
    caption: 'Somewhere, someone is still reading.',
    media: { kind: 'video', src: '/images/hero-desk/futaba-screens.mp4' },
    posClass: 'posResearcher',
  },
  {
    id: 'notebook',
    title: 'Open notebook',
    caption: 'The desk of someone becoming someone.',
    media: {
      kind: 'image',
      src: '/images/hero-desk/study-desk.jpg',
      alt: 'Illustrated study desk covered in handwritten notes and headphones',
    },
    posClass: 'posNotebook',
  },
  {
    id: 'nightclass',
    title: 'Night class',
    caption: 'Notes taken after midnight count double.',
    media: { kind: 'video', src: '/images/hero-desk/keyboard-typing.mp4' },
    posClass: 'posNightclass',
  },
];

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  lastX: number;
  lastY: number;
  raf: number;
}

/* How far a panel may travel past the hero edge before it stops. */
const EDGE_SLACK = 32;

export default function HeroFloatingPanels() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const offsets = useRef<Record<string, { x: number; y: number }>>({});
  const drags = useRef<Record<string, DragState | null>>({});
  const zCounter = useRef(10);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const bringToFront = (id: string) => {
    const el = panelRefs.current[id];
    if (el) el.style.zIndex = String(++zCounter.current);
  };

  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = panelRefs.current[id];
    const container = containerRef.current;
    if (!el || !container) return;

    bringToFront(id);
    el.setPointerCapture(e.pointerId);
    el.dataset.dragging = 'true';

    const base = offsets.current[id] ?? { x: 0, y: 0 };
    const cRect = container.getBoundingClientRect();
    const pRect = el.getBoundingClientRect();
    drags.current[id] = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: base.x,
      baseY: base.y,
      minX: base.x + (cRect.left - pRect.left) - EDGE_SLACK,
      maxX: base.x + (cRect.right - pRect.right) + EDGE_SLACK,
      minY: base.y + (cRect.top - pRect.top) - EDGE_SLACK,
      maxY: base.y + (cRect.bottom - pRect.bottom) + EDGE_SLACK,
      lastX: e.clientX,
      lastY: e.clientY,
      raf: 0,
    };
  };

  const onPointerMove = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = drags.current[id];
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    if (drag.raf) return;
    drag.raf = requestAnimationFrame(() => {
      drag.raf = 0;
      const el = panelRefs.current[id];
      if (!el) return;
      const x = Math.min(drag.maxX, Math.max(drag.minX, drag.baseX + (drag.lastX - drag.startX)));
      const y = Math.min(drag.maxY, Math.max(drag.minY, drag.baseY + (drag.lastY - drag.startY)));
      offsets.current[id] = { x, y };
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  };

  const endDrag = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = drags.current[id];
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.raf) cancelAnimationFrame(drag.raf);
    drags.current[id] = null;
    const el = panelRefs.current[id];
    if (!el) return;
    delete el.dataset.dragging;
    // Flush the final pointer position so fast flicks are not lost.
    const x = Math.min(drag.maxX, Math.max(drag.minX, drag.baseX + (drag.lastX - drag.startX)));
    const y = Math.min(drag.maxY, Math.max(drag.minY, drag.baseY + (drag.lastY - drag.startY)));
    offsets.current[id] = { x, y };
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  return (
    <div ref={containerRef} className={styles.field} aria-hidden="false">
      {PANELS.map((panel, i) =>
        closed[panel.id] ? null : (
          <div
            key={panel.id}
            ref={(el) => {
              panelRefs.current[panel.id] = el;
            }}
            className={`${styles.panel} ${styles[panel.posClass]}`}
            data-cursor="grab"
            style={{ animationDelay: `${0.9 + i * 0.18}s` }}
            onPointerDown={onPointerDown(panel.id)}
            onPointerMove={onPointerMove(panel.id)}
            onPointerUp={endDrag(panel.id)}
            onPointerCancel={endDrag(panel.id)}
          >
            <div className={styles.panelInner}>
              <div className={styles.stackSheet} aria-hidden="true" />
              <div className={`${styles.stackSheet} ${styles.stackSheetTwo}`} aria-hidden="true" />
              <div className={styles.sheet}>
                <div className={styles.titleBar}>
                  <span className={styles.grip} aria-hidden="true" />
                  <span className={styles.title}>{panel.title}</span>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={() => setClosed((prev) => ({ ...prev, [panel.id]: true }))}
                    aria-label={`Close ${panel.title}`}
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
                <div className={styles.media}>
                  {panel.media.kind === 'video' ? (
                    <video
                      src={panel.media.src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={panel.media.src} alt={panel.media.alt} draggable={false} />
                  )}
                </div>
                <div className={styles.caption}>{panel.caption}</div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
