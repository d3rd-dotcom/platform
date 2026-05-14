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
        <a
          href="https://discord.gg/ZTRVCYwncs"
          className={styles.discordButton}
          aria-disabled="true"
        >
          <span className={styles.slideWrap}>
            <span className={styles.slideText}>Discord</span>
            <span className={`${styles.slideText} ${styles.slideClone}`}>Discord</span>
          </span>
        </a>
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
  const sectionLinks = [
    { href: '#about', label: 'About' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#cohort', label: 'Cohort' },
    { href: '#faqs', label: 'FAQs' },
  ];

  const smoothScrollToSection = (href: string) => {
    if (typeof window === 'undefined') return;

    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;

    const header = document.querySelector<HTMLElement>('header');
    const headerOffset = header ? header.getBoundingClientRect().height + 28 : 120;
    const targetY = window.scrollY + target.getBoundingClientRect().top - headerOffset;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 700;
    let startTime: number | null = null;

    const easeInOutCubic = (t: number) => (
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    );

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      window.scrollTo({
        top: startY + distance * easedProgress,
        behavior: 'auto',
      });

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  };

  const handleSectionLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    event.preventDefault();
    setMobileMenuOpen(false);
    smoothScrollToSection(href);
  };

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

        <nav className={styles.sectionNav} aria-label="Section shortcuts">
          {sectionLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className={styles.sectionNavLink}
              onClick={(event) => handleSectionLinkClick(event, href)}
            >
              {label}
            </a>
          ))}
        </nav>

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
          <nav className={styles.mobileSectionNav} aria-label="Mobile section shortcuts">
            {sectionLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={styles.mobileSectionNavLink}
                onClick={(event) => handleSectionLinkClick(event, href)}
              >
                {label}
              </a>
            ))}
          </nav>
          <LandingAuthButtons />
        </div>
      ) : null}
    </header>
  );
};

export default LandingHeader;
