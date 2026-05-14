'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import styles from './LandingHeader.module.css';

const LandingAuthButtons = dynamic(
  () => import('./LandingAuthButtons').then((mod) => mod.LandingAuthButtons),
  {
    ssr: false,
    loading: () => (
      <>
        <button type="button" className={styles.loginButton} disabled aria-disabled="true">
          <span className={styles.slideWrap}>
            <span className={styles.slideText}>Login</span>
            <span className={`${styles.slideText} ${styles.slideClone}`}>Login</span>
          </span>
        </button>
        <button type="button" className={styles.joinButton} disabled aria-disabled="true">
          <span className={styles.slideWrap}>
            <span className={styles.slideText}>Apply to Join</span>
            <span className={`${styles.slideText} ${styles.slideClone}`}>Apply to Join</span>
          </span>
        </button>
      </>
    ),
  }
);

export const LandingHeader: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <header
      className={`${styles.header} ${scrolled ? styles.headerScrolled : ''} ${mobileMenuOpen ? styles.headerMenuOpen : ''}`}
    >
      <div className={styles.headerContent}>
        <a href="/" className={styles.logoLink}>
          <Image
            src="/icons/logo-mwa-horizontal.png"
            alt="Mental Wealth Academy"
            width={160}
            height={58}
            className={styles.logo}
            priority
          />
        </a>

        <nav className={styles.nav}>
          <div className={styles.desktopActions}>
            <LandingAuthButtons />
          </div>
          <button
            type="button"
            className={styles.mobileMenuButton}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className={styles.mobileMenuBar} />
            <span className={styles.mobileMenuBar} />
            <span className={styles.mobileMenuBar} />
          </button>
        </nav>
      </div>
      {mobileMenuOpen ? (
        <div className={styles.mobileMenuPanel}>
          <LandingAuthButtons />
        </div>
      ) : null}
    </header>
  );
};

export default LandingHeader;
