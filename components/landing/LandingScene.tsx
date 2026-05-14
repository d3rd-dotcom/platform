'use client';

import dynamic from 'next/dynamic';
import styles from './LandingPage.module.css';

const CubesCanvas = dynamic(() => import('./CohortCubes'), { ssr: false });

export const LandingScene: React.FC = () => {
  return (
    <div className={styles.canvas}>
      <CubesCanvas bgColor="#000000" />
    </div>
  );
};

export default LandingScene;
