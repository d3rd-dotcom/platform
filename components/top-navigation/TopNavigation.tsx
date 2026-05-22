'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import styles from './TopNavigation.module.css';
import { useSound } from '@/hooks/useSound';
import { useTheme } from '@/components/theme/ThemeProvider';
import SoundToggle from '@/components/sound/SoundToggle';

const NAV_LINKS = [
  { label: 'Home',      href: '/home',      icon: '/icons/nav-home.svg' },
  { label: 'Network',   href: '/community', icon: '/icons/nav-world.svg' },
  { label: 'Quests',    href: '/quests',    icon: '/icons/nav-teleport.svg' },
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
                className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
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
                {label}
              </Link>
            );
          })}
        </nav>

        <nav className={styles.nav}>
          <SoundToggle />
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
                className={styles.loginButton}
              >
                Login
              </button>
              <button
                type="button"
                onClick={handleJoinNow}
                onMouseEnter={() => play('hover')}
                className={styles.joinButton}
              >
                Join Now
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.shinyCard}
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
              <div className={styles.shinyCardIcon} aria-hidden="true">
                <svg className={styles.shinyCardIconSvg} width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5.5 16.5H5a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-5.5 4v-4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7.5 9.5h9M7.5 12.5h5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className={styles.shinyCardTitle}>Ask Blue</span>
            </div>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default TopNavigation;
