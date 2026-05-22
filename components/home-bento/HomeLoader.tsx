'use client';

import { useEffect, useState } from 'react';
import { DotmSquare15 } from '@/components/dot-matrix/DotmSquare15';
import styles from './HomeLoader.module.css';

const MESSAGES = [
  'Opening your home space',
  'Checking for your saved plan',
  'Gathering your intake answers',
  'Almost ready',
];

export default function HomeLoader() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setI((n) => (n + 1) % MESSAGES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.wrap} aria-live="polite">
      <DotmSquare15 speed={0.9} dotSize={6} gap={4} />
      <p className={styles.text} key={i}>
        {MESSAGES[i]}
      </p>
    </div>
  );
}
