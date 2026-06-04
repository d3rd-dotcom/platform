'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

const LOGOS = [
  { src: '/companylogos/ethereum-logo-dark.svg', alt: 'Ethereum logo', width: 50 },
  { src: '/companylogos/American_Psychological_Association_logo.svg.png', alt: 'American Psychological Association logo', width: 240, className: styles.apaLogo },
  { src: '/companylogos/artizen.png', alt: 'Artizen logo', width: 192 },
  { src: '/companylogos/foundation-dark.webp', alt: 'Foundation logo', width: 120 },
  { src: '/companylogos/full-aragon-logo.webp', alt: 'Aragon logo', width: 120 },
  { src: '/companylogos/gitcoin.webp', alt: 'Gitcoin logo', width: 120 },
  { src: '/companylogos/irb.png', alt: 'Institutional Review Board logo', width: 210 },
  { src: '/companylogos/Logo_ElizaOS_Blue_RGB.webp', alt: 'ElizaOS logo', width: 120 },
  { src: '/companylogos/anthropic.png', alt: 'Anthropic logo', width: 165 },
  { src: '/companylogos/Base-Logo-New-1.png', alt: 'Base logo', width: 120 },
  { src: '/companylogos/supabase.svg', alt: 'Supabase logo', width: 120 },
  { src: '/companylogos/chainlink-new.png', alt: 'Chainlink logo', width: 195 },
];

const STICKY_LOGOS = [
  { src: '/companylogos/American_Psychological_Association_logo.svg.png', alt: 'American Psychological Association logo', width: 240, className: styles.apaLogo },
  { src: '/companylogos/full-aragon-logo.webp', alt: 'Aragon logo', width: 120 },
  { src: '/companylogos/gitcoin.webp', alt: 'Gitcoin logo', width: 120 },
  { src: '/companylogos/irb.png', alt: 'Institutional Review Board logo', width: 210 },
  { src: '/companylogos/Logo_ElizaOS_Blue_RGB.webp', alt: 'ElizaOS logo', width: 120 },
  { src: '/companylogos/anthropic.png', alt: 'Anthropic logo', width: 165 },
  { src: '/companylogos/chainlink-new.png', alt: 'Chainlink logo', width: 195 },
  { src: '/companylogos/artizen.png', alt: 'Artizen logo', width: 192 },
];

type Phase = 'sticky' | 'merging' | 'settled';

export default function CompanyLogos() {
  const { play } = useSound();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('sticky');

  useEffect(() => {
    if (!window.matchMedia('(min-width: 769px)').matches) {
      setPhase('settled');
      return;
    }

    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('merging');
          observer.disconnect();
          setTimeout(() => setPhase('settled'), 550);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {phase !== 'settled' && (
        <div
          aria-hidden="true"
          className={`${styles.stickyLogosBar} ${phase === 'merging' ? styles.stickyLogosBarMerging : ''}`}
        >
          <div className={styles.stickyLogosGrid}>
            {STICKY_LOGOS.map((logo, i) => (
              <div key={`${logo.src}-${i}`} className={styles.stickyLogoItem}>
                <Image
                  src={logo.src}
                  alt=""
                  width={logo.width}
                  height={28}
                  className={`${styles.stickyLogoImage} ${logo.className ? styles.stickyLogoImageSm : ''}`}
                  loading="eager"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={sectionRef}
        className={`${styles.companyLogosSection} ${phase === 'sticky' ? styles.companyLogosSectionPending : ''}`}
      >
        <div className={styles.logosGrid}>
          {LOGOS.map((logo) => (
            <div
              key={logo.src}
              className={styles.logoItem}
              onMouseEnter={() => play('hover')}
            >
              <Image
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={80}
                className={`${styles.logoImage} ${logo.className || ''}`}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
