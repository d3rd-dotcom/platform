'use client';

import dynamic from 'next/dynamic';
import styles from './LandingPage.module.css';

const CubesCanvas = dynamic(() => import('./CohortCubes'), { ssr: false });

export const LandingScene: React.FC = () => {
  return (
    <div className={styles.canvas}>
      <CubesCanvas bgColor="#FBF8FF" />
    </div>
  );
};

export default LandingScene;
