'use client';

import { useEffect, useRef, useState } from 'react';
import { sampleVideoFrame, matchPrompt } from '@/lib/safari-analyze';
import styles from './AnalysisOverlay.module.css';

export default function AnalysisOverlay({
  stream,
  prompt,
}: {
  stream: MediaStream;
  prompt: string;
}) {
  const [match, setMatch] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!stream) return;
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;

    let lastSample = 0;

    function sample(time: number) {
      if (time - lastSample > 400 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        lastSample = time;
        const result = sampleVideoFrame(video);
        if (result) {
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

  return (
    <span className={styles.match}>{pct}%</span>
  );
}
