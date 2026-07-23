'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/hooks/useScrollLock';
import styles from './HolographicFolder.module.css';

interface HolographicFolderProps {
  className?: string;
  fileAlt: string;
  fileHeight: number;
  fileSrc: string;
  fileWidth: number;
  label: string;
}

export default function HolographicFolder({
  className,
  fileAlt,
  fileHeight,
  fileSrc,
  fileWidth,
  label,
}: HolographicFolderProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const draggedRef = useRef(false);

  useScrollLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const image = new window.Image();
    image.src = fileSrc;
  }, [fileSrc]);

  useEffect(() => {
    const updatePreviewWidth = () => {
      const compact = window.innerWidth <= 768;
      const maxWidth = window.innerWidth * (compact ? 0.92 : 0.9) - 4;
      const maxHeight = window.innerHeight * (compact ? 0.76 : 0.78);
      setPreviewWidth(Math.floor(Math.min(maxWidth, maxHeight * (fileWidth / fileHeight))));
    };

    updatePreviewWidth();
    window.addEventListener('resize', updatePreviewWidth);
    return () => window.removeEventListener('resize', updatePreviewWidth);
  }, [fileHeight, fileWidth]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) draggedRef.current = true;
    setOffset({ x: drag.originX + deltaX, y: drag.originY + deltaY });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!draggedRef.current) {
      setOpen(true);
    } else {
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    }
  };

  return (
    <>
      <div
        className={`${styles.folderDragShell}${className ? ` ${className}` : ''}`}
        style={{
          '--folder-drag-x': `${offset.x}px`,
          '--folder-drag-y': `${offset.y}px`,
        } as CSSProperties}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(event) => event.preventDefault()}
      >
        <button
          type="button"
          className={styles.folderButton}
          aria-label={`Open ${label}`}
          onClick={() => {
            if (draggedRef.current) {
              return;
            }
            setOpen(true);
          }}
        >
          <Image
            src="/images/interactive-folders/holographic-folder.webp"
            alt=""
            width={120}
            height={120}
            draggable={false}
            className={styles.folderImage}
          />
        </button>
      </div>

      {mounted && open && createPortal(
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            className={styles.preview}
            style={previewWidth ? { width: `${previewWidth}px` } : undefined}
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <header className={styles.titleBar}>
              <span className={styles.title}>{label}</span>
              <div className={styles.windowControls}>
                <button
                  type="button"
                  className={`${styles.windowControl} ${styles.windowControlReturn}`}
                  aria-label={`Send back ${label}`}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.visuallyHidden}>Send back</span>
                </button>
                <button
                  type="button"
                  className={`${styles.windowControl} ${styles.windowControlClose}`}
                  aria-label={`Close ${label}`}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.visuallyHidden}>Close</span>
                </button>
              </div>
            </header>
            <div className={styles.fileFrame}>
              <Image
                src={fileSrc}
                alt={fileAlt}
                width={fileWidth}
                height={fileHeight}
                sizes="(max-width: 768px) 88vw, 760px"
                className={styles.fileImage}
                unoptimized
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
