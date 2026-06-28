'use client';

import { useEffect, useRef, useState } from 'react';
import { sampleVideoFrame, matchPrompt, type AnalysisResult } from '@/lib/safari-analyze';
import styles from './AnalysisOverlay.module.css';

export default function AnalysisOverlay({
  stream,
  prompt,
}: {
  stream: MediaStream;
  prompt: string;
}) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [match, setMatch] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!stream) return;
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    video.muted = true;
    video.playsInline = true;

    let lastSample = 0;

    function sample(time: number) {
      if (time - lastSample > 400 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        lastSample = time;
        const result = sampleVideoFrame(video);
        if (result) {
          setAnalysis(result);
          setMatch(matchPrompt(prompt, result));
        }
      }
      rafRef.current = requestAnimationFrame(sample);
    }
    rafRef.current = requestAnimationFrame(sample);

    return () => {
      cancelAnimationFrame(rafRef.current);
      video.pause();
      video.srcObject = null;
    };
  }, [stream, prompt]);

  const pct = Math.round(match * 100);
  const color = analysis
    ? `rgb(${Math.round(analysis.avgR)}, ${Math.round(analysis.avgG)}, ${Math.round(analysis.avgB)})`
    : 'transparent';

  return (
    <div className={styles.bar}>
      <span className={styles.swatch} style={{ backgroundColor: color }} />
      <span className={styles.colorName}>{analysis?.dominantColor ?? '—'}</span>
      <span className={styles.match}>{pct}%</span>
    </div>
  );
}
