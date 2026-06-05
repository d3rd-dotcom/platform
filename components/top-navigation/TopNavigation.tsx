'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import styles from './TopNavigation.module.css';
import { useSound } from '@/hooks/useSound';
import { useTheme } from '@/components/theme/ThemeProvider';
import HoverSlideText from '@/components/shared/HoverSlideText';

const NAV_LINKS = [
  { label: 'Home',      href: '/home',      icon: '/icons/nav-home.svg' },
  { label: 'Quests',    href: '/quests',    icon: '/icons/nav-quests-v3.svg' },
  { label: 'Network',   href: '/community', icon: '/icons/nav-world-v2.svg' },
];

const TopNavigation: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { play } = useSound();
  const { theme, toggleTheme } = useTheme();
  const { login, authenticated } = usePrivy();
  const loginTriggered = useRef(false);

  // After Privy login succeeds, redirect to /home
  useEffect(() => {
    if (authenticated && loginTriggered.current) {
      loginTriggered.current = false;
      router.push('/home');
    }
  }, [authenticated, router]);

  if (pathname === '/') return null;

  const handleMenuToggle = () => {
    window.dispatchEvent(new Event('toggleSidebar'));
  };

  const handleLogin = () => {
    if (authenticated) {
      router.push('/home');
      return;
    }
    loginTriggered.current = true;
    login();
  };

  const handleJoinNow = () => {
    if (authenticated) {
      router.push('/home');
      return;
    }
    loginTriggered.current = true;
    login();
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.leftSection}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={handleMenuToggle}
            onMouseEnter={() => play('hover')}
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
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
        </div>

        <nav className={styles.centerNav} aria-label="Main navigation">
          {NAV_LINKS.map(({ label, href, icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.navLink} hover-slide-trigger ${active ? styles.navLinkActive : ''}`}
                onMouseEnter={() => play('hover')}
                onClick={() => play('navigation')}
                aria-current={active ? 'page' : undefined}
              >
                <Image
                  src={icon}
                  alt=""
                  width={16}
                  height={16}
                  className={`${styles.navLinkIcon} ${active ? styles.navLinkIconActive : ''}`}
                />
                <HoverSlideText>{label}</HoverSlideText>
              </Link>
            );
          })}
        </nav>

        <nav className={styles.nav}>
          <Link
            href="/shop"
            data-tour="shop"
            className={`${styles.shopLink} ${pathname === '/shop' || pathname?.startsWith('/shop/') ? styles.shopLinkActive : ''}`}
            onClick={() => play('navigation')}
            onMouseEnter={() => play('hover')}
            aria-label="Shop"
            aria-current={pathname === '/shop' || pathname?.startsWith('/shop/') ? 'page' : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="20" r="1" />
              <circle cx="19" cy="20" r="1" />
              <path d="M3 4h2l2.4 11.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H7" />
            </svg>
          </Link>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => {
              play('toggle-on');
              toggleTheme();
            }}
            onMouseEnter={() => play('hover')}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
          {!authenticated && (
            <>
              <button
                type="button"
                onClick={handleLogin}
                onMouseEnter={() => play('hover')}
                className={`${styles.loginButton} hover-slide-trigger`}
              >
                <HoverSlideText>Login</HoverSlideText>
              </button>
              <button
                type="button"
                onClick={handleJoinNow}
                onMouseEnter={() => play('hover')}
                className={`${styles.joinButton} hover-slide-trigger`}
              >
                <HoverSlideText>Join Now</HoverSlideText>
              </button>
            </>
          )}
          <button
            type="button"
            className={`${styles.shinyCard} hover-slide-trigger`}
            data-tour="ask-blue"
            onClick={() => {
              play('click');
              window.dispatchEvent(new Event('toggleBlueChat'));
            }}
            onMouseEnter={() => play('hover')}
            aria-label="Ask Blue"
          >
            <div className={styles.shinyCardShine} />
            <div className={styles.shinyCardContent}>
              <svg
                viewBox="0 0 511.893 511.893"
                className={styles.shinyCardIconSvg}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M458.599,261.333c32.107-47.253,41.707-94.293,21.44-129.387c-19.947-34.453-64.213-49.6-119.787-46.187C335.079,32.853,297.959,0,255.932,0s-79.147,32.96-104.427,85.867c-0.747,0-1.6-0.213-2.347-0.213c-56.64-3.093-98.347,13.44-117.333,46.187c-20.267,35.2-10.667,82.133,21.44,129.387c-32.107,47.253-41.707,94.293-21.44,129.387c18.133,31.36,56.213,46.827,104.747,46.827c6.613,0,13.44-0.32,20.373-0.853c24.96,46.72,59.84,75.307,99.093,75.307s74.133-28.587,99.093-75.307c6.933,0.533,13.76,0.853,20.267,0.853c48.427,0,86.613-15.467,104.747-46.827C500.306,355.627,490.706,308.587,458.599,261.333z M461.586,142.613c14.933,25.813,7.147,62.08-16.96,99.947c-16.427-20.053-34.773-38.293-54.827-54.613c-3.84-27.627-10.667-54.613-20.373-80.747C412.839,105.813,446.972,117.333,461.586,142.613z M393.212,219.733c13.867,12.8,26.667,26.667,38.293,41.6c-11.84,15.253-25.067,29.44-39.36,42.453c1.493-15.467,2.347-31.467,2.347-47.787C394.599,243.733,394.172,231.573,393.212,219.733z M373.266,256c0,22.933-1.813,45.867-5.333,68.587c-17.173,13.547-35.307,25.813-54.293,36.8c-18.56,10.667-37.867,20.053-57.707,28.053c-19.84-8-39.147-17.387-57.707-28.053c-18.987-10.987-37.12-23.253-54.293-36.8c-6.507-41.387-7.04-83.52-1.707-125.12c17.707-14.08,36.373-26.773,56-38.187c18.667-10.773,37.973-20.16,57.92-28.16c19.84,8,39.04,17.493,57.6,28.16c19.52,11.307,38.293,24.107,55.893,38.187C372.092,218.24,373.266,237.12,373.266,256z M364.519,168.64c-12.587-8.96-26.027-17.6-40.107-25.813c-13.013-7.467-26.027-14.08-39.147-20.16c19.947-6.507,40.533-11.093,61.333-13.76C354.386,128.213,360.359,148.267,364.519,168.64z M255.932,21.333c31.04,0,59.84,25.707,81.067,66.88c-27.733,4.267-55.04,11.52-81.173,21.867c-26.133-10.24-53.333-17.493-81.067-21.653C195.986,47.147,224.786,21.333,255.932,21.333z M165.479,108.587c20.907,2.667,41.493,7.36,61.547,13.867c-13.12,6.08-26.24,12.8-39.467,20.373c-14.187,8.213-27.52,16.853-40.107,25.813C151.506,148.16,157.586,128,165.479,108.587z M50.279,142.613c14.187-24.533,46.933-37.013,92.267-35.627c-9.813,26.133-16.64,53.333-20.48,81.067c-20.053,16.32-38.507,34.56-54.827,54.613C43.132,204.693,35.346,168.427,50.279,142.613z M119.612,303.787c-14.293-13.013-27.413-27.2-39.253-42.453c11.627-14.827,24.427-28.8,38.293-41.493c-0.853,11.84-1.387,23.893-1.387,36.16C117.266,272.427,118.119,288.32,119.612,303.787z M50.279,380.053c-14.933-25.813-7.147-62.08,16.96-99.947c16.853,20.693,35.947,39.573,56.747,56.213c5.013,29.12,12.8,55.68,22.72,79.04C101.266,417.6,65.319,406.187,50.279,380.053z M150.119,356.053c11.84,8.213,24.213,16.213,37.333,23.787c13.12,7.573,26.133,14.08,39.147,20.16c-18.56,5.973-37.653,10.453-56.96,13.227C161.319,394.773,154.812,375.68,150.119,356.053z M255.932,490.667c-28.48,0-55.04-21.653-75.627-56.853c24-3.947,49.493-11.093,75.627-21.227c26.133,10.133,51.627,17.28,75.627,21.227C310.972,469.013,284.412,490.667,255.932,490.667z M342.119,413.227c-19.307-2.773-38.4-7.253-56.96-13.227c13.013-6.08,26.027-12.693,39.147-20.16c13.12-7.467,25.493-15.573,37.333-23.787C356.946,375.68,350.439,394.88,342.119,413.227z M461.586,380.053c-15.04,26.133-50.987,37.44-96.427,35.307c9.92-23.253,17.6-49.92,22.72-79.04c20.8-16.747,39.893-35.52,56.747-56.213C468.732,317.973,476.519,354.24,461.586,380.053z"/>
                <path d="M255.932,224c-23.573,0-42.667,19.093-42.667,42.667s19.093,42.667,42.667,42.667c23.573,0,42.667-19.093,42.667-42.667S279.506,224,255.932,224z"/>
              </svg>
              <span className={styles.shinyCardTitle}>
                <HoverSlideText>Ask Blue</HoverSlideText>
              </span>
            </div>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default TopNavigation;
