'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { MagnifyingGlass } from '@phosphor-icons/react';
import styles from './TopNavigation.module.css';
import { useSound } from '@/hooks/useSound';
import ColorThemePicker from '@/components/theme/ColorThemePicker';
import HoverSlideText from '@/components/shared/HoverSlideText';
const NAV_LINKS = [
  { label: 'Pocket World', href: '/simulation', icon: '/icons/nav-simulations-v2.svg' },
  { label: 'R-Tool', href: '/research', icon: '/icons/nav-laboratory-v3.svg' },
];

const TopNavigation: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { play } = useSound();
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

        <div className={styles.searchWrapper}>
          <div className={styles.searchBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search Academy"
              onKeyDown={() => play('click')}
            />
            <MagnifyingGlass size={20} weight="bold" className={styles.searchIcon} />
          </div>
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
                <span className={styles.navLinkIconWrap}>
                  <Image
                    src={icon}
                    alt=""
                    width={16}
                    height={16}
                    className={styles.navLinkIcon}
                  />
                </span>
                <span className={styles.navDivider} />
                <span className={styles.navLinkLabel}>
                  <HoverSlideText>{label}</HoverSlideText>
                </span>
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
          <ColorThemePicker />

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
          {/* Profile card slot — SideNavigation portals the profile card here */}
          <div id="topnav-profile-slot" className={styles.profileSlot} />
        </nav>
      </div>
    </header>
  );
};

export default TopNavigation;
