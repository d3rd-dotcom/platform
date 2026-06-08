'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './SignFormModal.module.css';

interface SignFormModalProps {
  difficulty: number;
  shardReward: number;
  onLaunch: () => void;
  onClose: () => void;
}

export default function SignFormModal({ difficulty, shardReward, onLaunch, onClose }: SignFormModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agreed, setAgreed] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const canLaunch = agreed && hasSigned;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.strokeStyle = '#5168ff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  }, [isDrawing]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    setHasSigned(false);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Launch Authorization">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerLabel}>Participatory Research Study</span>
            <span className={styles.headerTitle}>Quick Consent</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close" type="button">
            &times;
          </button>
        </div>

        {/* Scrollable body */}
        <div className={styles.body}>

          <div className={styles.legalBlock}>
            <div className={styles.legalSection}>
              <span className={styles.legalHeading}>Your Answers Count</span>
              <p className={styles.legalText}>
                Your responses are saved to your account so Blue can grade them and award your diamonds. They also help build better models for the community.
              </p>
            </div>

            <div className={styles.legalSection}>
              <span className={styles.legalHeading}>This Is a Graded Test</span>
              <p className={styles.legalText}>
                There are right and wrong answers, and Blue grades every one. Higher difficulty means harder questions and a bigger credit payout. It&apos;s for the Academy, not medical or clinical advice.
              </p>
            </div>
          </div>

          {/* Agree checkbox */}
          <label className={styles.agreeRow}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            />
            <span className={styles.agreeLabel}>
              I am 18 or older and happy to participate.
            </span>
          </label>

          {/* Signature pad */}
          <div className={styles.signatureSection}>
            <div className={styles.signatureLabel}>
              <span className={styles.signatureLabelText}>Your signature</span>
              <button className={styles.clearBtn} onClick={clearSignature} type="button">
                Clear
              </button>
            </div>
            <div className={styles.canvasWrapper}>
              <canvas
                ref={canvasRef}
                className={styles.signatureCanvas}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              {!hasSigned && (
                <div className={styles.signatureHint} aria-hidden="true">
                  <span className={styles.signatureHintText}>sign here</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer CTA */}
        <div className={styles.footer}>
          <button
            className={styles.launchBtn}
            onClick={onLaunch}
            disabled={!canLaunch}
            type="button"
          >
            {canLaunch ? `Start Survey · +${shardReward} diamonds` : 'Agree & sign to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
