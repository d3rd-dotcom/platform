'use client';

import React, { useState, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import styles from './DNAMusicBox.module.css';

const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 1046.5, 1174.66];

const MELODY = [0, 0, 2, 4, 6, 4, 2, 0, 1, 2, 3, 4];

const NOTE_DURATION = 0.22;

const NUM_PARTICLES = 14;

let particleSeq = 0;

interface Particle {
  id: number;
  left: number;
  size: number;
  delay: number;
}

export default function DNAMusicBox() {
  const [cooldown, setCooldown] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playMelody = useCallback(() => {
    if (cooldown) return;
    setCooldown(true);
    setGlowing(true);

    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const vol = 0.18;

    MELODY.forEach((noteIdx, i) => {
      const freq = NOTES[noteIdx];
      const t = now + i * NOTE_DURATION;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + NOTE_DURATION * 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + NOTE_DURATION + 0.02);
    });

    const totalMs = MELODY.length * NOTE_DURATION * 1000 + 200;

    timerRef.current = setTimeout(() => {
      ctx.close();
      setGlowing(false);
    }, totalMs);

    const newParticles: Particle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      newParticles.push({
        id: particleSeq++,
        left: 12 + Math.random() * 76,
        size: 4 + Math.random() * 5,
        delay: Math.random() * 1.0,
      });
    }
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 3200);

    confetti({
      particleCount: 70,
      spread: 80,
      origin: { x: 0.5, y: 0.15 },
      colors: ['#d4af37', '#ffd700', '#ffec8b', '#daa520'],
      startVelocity: 25,
      gravity: 0.7,
    });

    setTimeout(() => {
      setCooldown(false);
    }, 3000);
  }, [cooldown]);

  return (
    <section className={styles.container} aria-label="DNA Music Box">
      <div className={styles.noise} aria-hidden="true" />

      <svg
        className={`${styles.helix} ${glowing ? styles.helixGlow : ''}`}
        viewBox="0 0 200 600"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="helixGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(212,175,55,0.08)" />
            <stop offset="25%" stopColor="rgba(212,175,55,0.22)" />
            <stop offset="50%" stopColor="rgba(212,175,55,0.28)" />
            <stop offset="75%" stopColor="rgba(212,175,55,0.22)" />
            <stop offset="100%" stopColor="rgba(212,175,55,0.08)" />
          </linearGradient>
          <linearGradient id="rungGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(212,175,55,0.08)" />
            <stop offset="50%" stopColor="rgba(212,175,55,0.25)" />
            <stop offset="100%" stopColor="rgba(212,175,55,0.08)" />
          </linearGradient>
        </defs>

        <path
          className={styles.helixBackbone}
          d="M 55,0
             C 55,30, 145,45, 145,75
             C 145,105, 55,120, 55,150
             C 55,180, 145,195, 145,225
             C 145,255, 55,270, 55,300
             C 55,330, 145,345, 145,375
             C 145,405, 55,420, 55,450
             C 55,480, 145,495, 145,525
             C 145,555, 55,570, 55,600"
        />
        <path
          className={styles.helixBackbone}
          d="M 145,0
             C 145,30, 55,45, 55,75
             C 55,105, 145,120, 145,150
             C 145,180, 55,195, 55,225
             C 55,255, 145,270, 145,300
             C 145,330, 55,345, 55,375
             C 55,405, 145,420, 145,450
             C 145,480, 55,495, 55,525
             C 55,555, 145,570, 145,600"
        />

        <g className={styles.helixRung}>
          <line x1="55" y1="0" x2="145" y2="0" />
          <line x1="55" y1="75" x2="145" y2="75" />
          <line x1="55" y1="150" x2="145" y2="150" />
          <line x1="55" y1="225" x2="145" y2="225" />
          <line x1="55" y1="300" x2="145" y2="300" />
          <line x1="55" y1="375" x2="145" y2="375" />
          <line x1="55" y1="450" x2="145" y2="450" />
          <line x1="55" y1="525" x2="145" y2="525" />
          <line x1="55" y1="600" x2="145" y2="600" />
        </g>

        <line x1="55" y1="0" x2="55" y2="600" stroke="url(#helixGrad)" strokeWidth="1" opacity="0.15" />
        <line x1="145" y1="0" x2="145" y2="600" stroke="url(#helixGrad)" strokeWidth="1" opacity="0.15" />

        <g className={styles.helixNode}>
          <circle cx="55" cy="0" r="3" />
          <circle cx="145" cy="0" r="3" />
          <circle cx="55" cy="150" r="3" />
          <circle cx="145" cy="150" r="3" />
          <circle cx="55" cy="300" r="3" />
          <circle cx="145" cy="300" r="3" />
          <circle cx="55" cy="450" r="3" />
          <circle cx="145" cy="450" r="3" />
          <circle cx="55" cy="600" r="3" />
          <circle cx="145" cy="600" r="3" />
          <circle cx="145" cy="75" r="3" />
          <circle cx="55" cy="75" r="3" />
          <circle cx="145" cy="225" r="3" />
          <circle cx="55" cy="225" r="3" />
          <circle cx="145" cy="375" r="3" />
          <circle cx="55" cy="375" r="3" />
          <circle cx="145" cy="525" r="3" />
          <circle cx="55" cy="525" r="3" />
        </g>
      </svg>

      <button
        className={`${styles.key} ${cooldown ? styles.keyCooldown : ''}`}
        onClick={playMelody}
        disabled={cooldown}
        aria-label="Wind up the music box"
      >
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="9" strokeWidth="1.6" fill="none" />
          <path d="M14 5 L14 2" strokeWidth="2" />
          <path d="M10 3 Q14 8, 18 3" strokeWidth="1.8" />
          <circle cx="14" cy="14" r="3" strokeWidth="1.2" fill="rgba(255,255,255,0.15)" />
        </svg>
      </button>

      <div className={styles.textBlock}>
        <h2 className={styles.title}>the music box</h2>
        <p className={styles.subtitle}>a melody from childhood</p>
      </div>

      {particles.length > 0 && (
        <div className={styles.particlesContainer} aria-hidden="true">
          {particles.map((p) => (
            <div
              key={p.id}
              className={styles.particle}
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
