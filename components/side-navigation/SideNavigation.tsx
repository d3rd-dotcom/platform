'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import type { IconProps } from '@phosphor-icons/react';
import styles from './SideNavigation.module.css';
import { useSound } from '@/hooks/useSound';
import { useInitialSidebarCollapsed } from './SidebarStateProvider';
import HoverSlideText from '@/components/shared/HoverSlideText';

const BlueChat = dynamic(() => import('../blue-chat/BlueChat'), { ssr: false });
const SidebarProfileCard = dynamic(() => import('../sidebar-profile-card/SidebarProfileCard'), { ssr: false });
const AvatarSelectorModal = dynamic(() => import('../avatar-selector/AvatarSelectorModal'), { ssr: false });
const UsernameChangeModal = dynamic(() => import('../username-change/UsernameChangeModal'), { ssr: false });
const ProMembershipModal = dynamic(() => import('../pro-membership-modal/ProMembershipModal'), { ssr: false });
const YourAccountsModal = dynamic(() => import('../nav-buttons/YourAccountsModal'), { ssr: false });
const OnboardingModal = dynamic(() => import('../onboarding/OnboardingModal'), { ssr: false });
const LootBoxModal = dynamic(() => import('../loot-box/LootBoxModal'), { ssr: false });
const SubmitProposalModal = dynamic(() => import('../voting/SubmitProposalModal'), { ssr: false });

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;
  iconSrc?: string;
  badge?: string;
  badgeType?: 'default' | 'highlight' | 'muted' | 'green' | 'pro';
  disabled?: boolean;
  requiresPro?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  badge?: string;
  badgeType?: 'default' | 'highlight' | 'muted' | 'pro';
}

const desktopNavSections: NavSection[] = [
  {
    id: 'extras',
    label: 'Pro Features',
    badge: 'Pro',
    badgeType: 'pro',
    items: [
      { id: 'genetics', label: 'Genetics', href: '/genetics', iconSrc: '/icons/genetics.svg', requiresPro: true },
      { id: 'markets', label: 'Endowment', href: '/trades', iconSrc: '/icons/nav-trades-v1.svg', requiresPro: true },
    ],
  },
];

const mobileNavSections: NavSection[] = [
  {
    id: 'extras',
    label: 'Pro Features',
    badge: 'Pro',
    badgeType: 'pro',
    items: [
      { id: 'markets', label: 'Trades', href: '/trades', iconSrc: '/icons/nav-trades-v1.svg', requiresPro: true },
      { id: 'simulations', label: 'Simulations', href: '/simulation', iconSrc: '/icons/nav-simulations-v2.svg', requiresPro: true },
      { id: 'genetics', label: 'Genetics', href: '/genetics', iconSrc: '/icons/genetics.svg', requiresPro: true },
    ],
  },
];

const primaryNavItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/home',
    iconSrc: '/icons/nav-home.svg',
  },
  { 
    id: 'surveys',
    label: 'Surveys',
    href: '/surveys',
    iconSrc: '/icons/nav-surveys-v5.svg',
  },
  {
    id: 'course',
    label: 'Course',
    href: '/course',
    iconSrc: '/icons/nav-course-v2.svg',
  },
];

interface SideNavigationProps {
  externalMobileOpen?: boolean;
  onExternalMobileClose?: () => void;
}

const SIDEBAR_EXPANDED_WIDTH = '265px';
const SIDEBAR_COLLAPSED_WIDTH = '72px';

function syncSidebarPreference(collapsed: boolean) {
  if (typeof document === 'undefined') return;

  const value = collapsed ? 'true' : 'false';
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  document.documentElement.setAttribute('data-sidebar-collapsed', value);
  document.documentElement.style.setProperty('--sidebar-width', width);

  try {
    localStorage.setItem('sideNavCollapsed', value);
  } catch {
    // Ignore unavailable storage and still keep the in-memory layout stable.
  }

  document.cookie = `sideNavCollapsed=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

const NavIconMark: React.FC<{
  icon?: NavItem['icon'];
  iconSrc?: string;
  isActive?: boolean;
  preserveColor?: boolean;
}> = ({ icon: Icon, iconSrc, isActive = false, preserveColor = false }) => {
  if (iconSrc) {
    return (
      <span className={`${styles.navItemIconWrap} ${isActive ? styles.navItemIconWrapActive : ''}`} aria-hidden="true">
        <Image
          src={iconSrc}
          alt=""
          width={20}
          height={20}
          className={`${styles.navItemImageIcon} ${preserveColor ? styles.navItemImageIconOriginal : ''} ${isActive ? styles.navItemImageIconActive : ''}`}
        />
      </span>
    );
  }

  if (!Icon) return null;

  return (
    <span className={`${styles.navItemIconWrap} ${isActive ? styles.navItemIconWrapActive : ''}`} aria-hidden="true">
      <Icon
        size={20}
        weight={isActive ? 'fill' : 'regular'}
        className={`${styles.navItemIcon} ${isActive ? styles.navItemIconActive : ''}`}
      />
    </span>
  );
};

const SideNavigation: React.FC<SideNavigationProps> = ({ externalMobileOpen, onExternalMobileClose }) => {
  const initialCollapsed = useInitialSidebarCollapsed();
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { login, logout: privyLogout, authenticated, ready, getAccessToken } = usePrivy();
  const [shardCount, setShardCount] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);
  const [isUsernameChangeModalOpen, setIsUsernameChangeModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpenInternal] = useState(false);

  const setIsMobileMenuOpen = useCallback((open: boolean) => {
    setIsMobileMenuOpenInternal(open);
    if (!open && onExternalMobileClose) onExternalMobileClose();
  }, [onExternalMobileClose]);

  useEffect(() => {
    if (externalMobileOpen) setIsMobileMenuOpenInternal(true);
  }, [externalMobileOpen]);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(true);
  const [isYourAccountsModalOpen, setIsYourAccountsModalOpen] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLootBoxOpen, setIsLootBoxOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [userLoadComplete, setUserLoadComplete] = useState(false);
  const [hasVipMembershipCard, setHasVipMembershipCard] = useState<boolean | null>(null);
  const { play } = useSound();
  const sessionCreatedForRef = useRef<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const [accountMenuStyle, setAccountMenuStyle] = useState<React.CSSProperties>({});
  const [profileSlot, setProfileSlot] = useState<HTMLElement | null>(null);

  // Locate the top-nav slot the profile card portals into.
  useEffect(() => {
    const timer = setTimeout(() => {
      setProfileSlot(document.getElementById('topnav-profile-slot'));
    }, 0);
    return () => clearTimeout(timer);
  }, []);


  const toggleCollapsed = useCallback(() => {
    const next = !isCollapsed;
    play(next ? 'toggle-off' : 'toggle-on');
    setIsCollapsed(next);
    syncSidebarPreference(next);
  }, [isCollapsed, play]);

  // Listen for toggle from TopNavigation / MobileBottomNav menu button
  useEffect(() => {
    const handler = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        setIsMobileMenuOpenInternal(prev => {
          const next = !prev;
          if (!next && onExternalMobileClose) onExternalMobileClose();
          return next;
        });
      } else {
        toggleCollapsed();
      }
    };
    window.addEventListener('toggleSidebar', handler);

    const blueChatHandler = () => setIsChatOpen(true);
    window.addEventListener('toggleBlueChat', blueChatHandler);

    return () => {
      window.removeEventListener('toggleSidebar', handler);
      window.removeEventListener('toggleBlueChat', blueChatHandler);
    };
  }, [onExternalMobileClose, toggleCollapsed]);

  const refreshVipMembershipStatus = useCallback(async () => {
    if (!ready || !authenticated) {
      setHasVipMembershipCard(false);
      return;
    }

    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const urls = address
        ? [`/api/account/status?walletAddress=${encodeURIComponent(address)}`, '/api/account/status']
        : ['/api/account/status'];
      const statuses = await Promise.all(
        urls.map((url) => window.fetch(url, {
          cache: 'no-store',
          credentials: 'include',
          headers,
        })
          .then((response) => (response.ok ? response.json().catch(() => null) : null))
          .catch(() => null)),
      );
      setHasVipMembershipCard(statuses.some((status) => Boolean(status?.hasVipMembershipCard)));
    } catch {
      setHasVipMembershipCard(false);
    }
  }, [address, authenticated, getAccessToken, ready]);

  useEffect(() => {
    if (!ready || !authenticated) {
      setHasVipMembershipCard(false);
      return;
    }

    void refreshVipMembershipStatus();
  }, [authenticated, ready, refreshVipMembershipStatus]);

  useEffect(() => {
    const handler = () => {
      void refreshVipMembershipStatus();
    };

    window.addEventListener('vipMembershipUpdated', handler);
    return () => window.removeEventListener('vipMembershipUpdated', handler);
  }, [refreshVipMembershipStatus]);

  // Create server session after wallet connects via ConnectKit
  const createSessionForWallet = async (walletAddress: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return;
    setIsCreatingSession(true);
    try {
      const token = await getAccessToken();
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      // Check if we already have a session
      const meResponse = await fetch('/api/me', { credentials: 'include', cache: 'no-store', headers: authHeaders });
      const meData = await meResponse.json().catch(() => ({ user: null }));

      if (meData.user) {
        setUsername(meData.user.username || null);
        setAvatarUrl(meData.user.avatarUrl || null);
        if (meData.user.shardCount !== undefined) setShardCount(meData.user.shardCount);
        setUserLoadComplete(true);
        window.dispatchEvent(new Event('userLoaded'));
        sessionCreatedForRef.current = walletAddress;
        // If user still has temp username, they need to complete onboarding
        if (!meData.user.username || meData.user.username.startsWith('user_')) {
          setIsOnboardingOpen(true);
        }
        return;
      }

      // No session yet — pass fresh Privy token for wallet auth
      const signupResponse = await fetch('/api/auth/wallet-signup', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders,
      });

      if (signupResponse.ok) {
        const signupData = await signupResponse.json().catch(() => ({}));
        const refreshResponse = await fetch('/api/me', { credentials: 'include', cache: 'no-store', headers: authHeaders });
        const refreshData = await refreshResponse.json().catch(() => ({ user: null }));
        if (refreshData.user) {
          setUsername(refreshData.user.username || null);
          setAvatarUrl(refreshData.user.avatarUrl || null);
          if (refreshData.user.shardCount !== undefined) setShardCount(refreshData.user.shardCount);
          setUserLoadComplete(true);
          window.dispatchEvent(new Event('userLoaded'));
          window.dispatchEvent(new Event('userLoggedIn'));
        }
        sessionCreatedForRef.current = walletAddress;
        // Open onboarding for new users or users who haven't completed setup
        if (!signupData.existing || !refreshData.user?.username || refreshData.user?.username?.startsWith('user_')) {
          setIsOnboardingOpen(true);
        }
      }
    } catch (error) {
      console.error('Failed to create session after wallet connect:', error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Auto-create session when wallet connects (only if Privy says ready + authenticated)
  useEffect(() => {
    if (!ready || !authenticated || !isConnected || !address) return;
    if (username && !username.startsWith('user_')) return; // Already fully logged in
    if (sessionCreatedForRef.current === address) return;

    const timer = setTimeout(() => createSessionForWallet(address), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, isConnected, address, username]);

  // Reset session tracking when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      sessionCreatedForRef.current = null;
    }
  }, [isConnected]);

  // Fetch user data (wait for Privy ready + authenticated, retry on failure)
  useEffect(() => {
    if (!ready || !authenticated) {
      setShardCount(null);
      setUsername(null);
      setAvatarUrl(null);
      setUserLoadComplete(false);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const fetchUserData = async (attempt = 1) => {
      if (cancelled) return;
      try {
        const token = await getAccessToken();
        if (!token && attempt <= 5) {
          // Privy token not ready yet — poll responsively (it usually
          // arrives within a few hundred ms once Privy is authenticated).
          console.warn('[SideNav] getAccessToken returned null, retry', attempt);
          retryTimer = setTimeout(() => fetchUserData(attempt + 1), attempt * 400);
          return;
        }
        const response = await fetch('/api/me', {
          cache: 'no-store',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || `/api/me request failed (${response.status})`);
        }
        if (!data) {
          throw new Error('/api/me returned a non-JSON response.');
        }
        if (cancelled) return;
        if (data?.user) {
          if (data.user.shardCount !== undefined) setShardCount(data.user.shardCount);
          setUsername(data.user.username || null);
          setAvatarUrl(data.user.avatarUrl || null);
          setUserLoadComplete(true);
          window.dispatchEvent(new Event('userLoaded'));
        } else {
          // Auth debug info from server
          if (data?.authDebug) {
            console.warn('[SideNav] /api/me returned no user.', data.authDebug);
            // Wallet extracted but no DB row — try creating the account
            if (data.authDebug.walletExtracted && data.authDebug.userNotFound && attempt <= 2) {
              console.warn('[SideNav] Wallet found but no user row — calling wallet-signup');
              await fetch('/api/auth/wallet-signup', {
                method: 'POST',
                credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              retryTimer = setTimeout(() => fetchUserData(attempt + 1), 1000);
              return;
            }
          }
          setShardCount(null);
          setUsername(null);
          setAvatarUrl(null);
        }
      } catch (error) {
        console.error('[SideNav] Failed to fetch user data:', error);
        if (!cancelled && attempt <= 3) {
          retryTimer = setTimeout(() => fetchUserData(attempt + 1), attempt * 1500);
        }
      }
    };

    fetchUserData();

    const handleShardsUpdate = () => fetchUserData();
    const handleProfileUpdate = () => fetchUserData();
    window.addEventListener('shardsUpdated', handleShardsUpdate);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      window.removeEventListener('shardsUpdated', handleShardsUpdate);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [ready, authenticated, getAccessToken]);

  // Position account menu above the button on mobile (fixed positioning to escape overflow)
  useEffect(() => {
    if (isAccountMenuOpen && accountButtonRef.current && window.innerWidth <= 900) {
      const rect = accountButtonRef.current.getBoundingClientRect();
      setAccountMenuStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setAccountMenuStyle({});
    }
  }, [isAccountMenuOpen]);

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAccountMenuOpen]);

  // Close mobile menu when clicking outside (but not on the hamburger button)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) &&
        hamburgerRef.current && !hamburgerRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.body.style.overflow = '';
      };
    }
  }, [isMobileMenuOpen, setIsMobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname, setIsMobileMenuOpen]);

  const handleAvatarClick = () => {
    setIsAccountMenuOpen(false);
    setIsAvatarSelectorOpen(true);
  };

  const handleAvatarSelected = (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
  };

  const handleUsernameClick = () => {
    setIsAccountMenuOpen(false);
    setIsUsernameChangeModalOpen(true);
  };

  const handleUsernameChanged = (newUsername: string) => {
    setUsername(newUsername);
  };

  const handleOnboardingComplete = (newUsername: string, newAvatarUrl: string | null) => {
    setUsername(newUsername);
    setAvatarUrl(newAvatarUrl);
    setIsOnboardingOpen(false);
    window.dispatchEvent(new Event('userLoggedIn'));
  };

  const handleSignOut = async () => {
    setIsAccountMenuOpen(false);

    // Clear server session + Privy cookies first (always runs)
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (err) { console.error('Server logout failed:', err); }
    // Then disconnect Privy client state
    try { await privyLogout(); } catch (err) { console.error('Privy logout failed:', err); }

    sessionCreatedForRef.current = null;
    setShardCount(null);
    setUsername(null);
    setAvatarUrl(null);

    router.push('/');
  };

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/home' || pathname === '/';
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const navSections = isMobileMenuOpen ? mobileNavSections : desktopNavSections;
  const extrasSection = navSections.find((section) => section.id === 'extras');
  const hasDisplayProfile = !!(username && !username.startsWith('user_'));
  const hasConnectedWallet = !!(isConnected && address);
  const shouldShowProfileCards = hasConnectedWallet || hasDisplayProfile;

  const renderSection = (section: NavSection) => {
    const isExtras = section.id === 'extras';
    const isExpanded = isExtras ? adminExpanded : true;

    return (
      <div className={styles.section}>
        {section.label && (
          <button
            className={`${styles.sectionHeader} hover-slide-trigger ${isExtras ? styles.sectionHeaderToggle : ''}`}
            onClick={isExtras ? () => setAdminExpanded(!adminExpanded) : undefined}
            type="button"
          >
            <span className={styles.sectionLabel}><HoverSlideText>{section.label}</HoverSlideText></span>
            {section.badge && (
              <span className={`${styles.sectionBadge} ${section.badgeType === 'pro' ? styles.sectionBadgePro : ''}`}>
                {section.badge}
              </span>
            )}
            {isExtras && (
              <svg
                className={`${styles.sectionChevron} ${adminExpanded ? styles.sectionChevronOpen : ''}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            )}
          </button>
        )}
        <div className={`${styles.sectionItems} ${!isExpanded ? styles.sectionItemsCollapsed : ''}`}>
          {section.items.map((item) => {
            const active = isActive(item.href);
            const proState = !item.requiresPro
              ? 'public'
              : hasVipMembershipCard === true
                ? 'unlocked'
                : hasVipMembershipCard === false
                  ? 'locked'
                  : 'checking';

            return proState === 'checking' ? (
              <div
                key={item.id}
                className={`${styles.navItem} ${styles.navItemDisabled}`}
                title={isCollapsed ? item.label : undefined}
                aria-busy="true"
                data-tour={item.id === 'markets' ? 'markets' : undefined}
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} />
                <span className={styles.navItemLabel}><HoverSlideText>{item.label}</HoverSlideText></span>
              </div>
            ) : proState === 'locked' ? (
              <button
                key={item.id}
                onClick={() => {
                  play('error');
                  setIsProModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                onMouseEnter={() => play('hover')}
                className={`${styles.navItem} ${styles.navItemButton} hover-slide-trigger`}
                title={isCollapsed ? item.label : undefined}
                aria-label={`${item.label}, locked; VIP membership required`}
                data-tour={item.id === 'markets' ? 'markets' : undefined}
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} />
                <span className={styles.navItemLabel}><HoverSlideText>{item.label}</HoverSlideText></span>
              </button>
            ) : item.disabled ? (
              <div
                key={item.id}
                className={`${styles.navItem} ${styles.navItemDisabled}`}
                title={isCollapsed ? item.label : undefined}
                data-tour={item.id === 'markets' ? 'markets' : undefined}
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} />
                <span className={styles.navItemLabel}><HoverSlideText>{item.label}</HoverSlideText></span>
                {item.badge && (
                  <span className={`${styles.badge} ${item.badgeType === 'muted' ? styles.badgeMuted : item.badgeType === 'highlight' ? styles.badgeHighlight : ''}`}>
                    {item.badge}
                  </span>
                )}
              </div>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                className={`${styles.navItem} hover-slide-trigger ${active ? styles.navItemActive : ''}`}
                {...(item.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => {
                  play('navigation');
                  setIsMobileMenuOpen(false);
                }}
                onMouseEnter={() => play('hover')}
                title={isCollapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                data-tour={item.id === 'markets' ? 'markets' : undefined}
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} isActive={active} />
                <span className={styles.navItemLabel}><HoverSlideText>{item.label}</HoverSlideText></span>
                {item.badge && (
                  <span className={`${styles.badge} ${item.requiresPro ? styles.badgeUnlocked : item.badgeType === 'highlight' ? styles.badgeHighlight : item.badgeType === 'green' ? styles.badgeGreen : item.badgeType === 'pro' ? styles.badgePro : ''}`}>
                    {item.requiresPro ? 'VIP' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const renderProfileCard = (collapsed: boolean) => {
    if (!shouldShowProfileCards) return null;
    return (
      <SidebarProfileCard
        username={username}
        avatarUrl={avatarUrl}
        address={address}
        isCollapsed={collapsed}
        onChangeAvatar={handleAvatarClick}
        onChangeUsername={handleUsernameClick}
        onConnections={() => setIsYourAccountsModalOpen(true)}
        onSignOut={handleSignOut}
      />
    );
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className={styles.mobileTopBar}>
        <Link href="/home" className={styles.mobileLogoLink}>
          <span className={styles.mobileLogo}>Mental Wealth Academy</span>
        </Link>
        <button
          ref={hamburgerRef}
          className={`${styles.hamburgerButton} ${isMobileMenuOpen ? styles.hamburgerOpen : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
        >
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className={styles.mobileOverlay} onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Side Navigation / Mobile Drawer */}
      <nav
        className={`${styles.sideNav} ${isMobileMenuOpen ? styles.sideNavOpen : ''} ${isCollapsed ? styles.sideNavCollapsed : ''}`}
        ref={mobileMenuRef}
      >

        {/* Profile card — mobile drawer only; desktop renders it in the top nav */}
        <div className={styles.mobileProfileSlot}>
          {renderProfileCard(false)}
        </div>

        {/* Create Experiment Button */}
        <div className={styles.actionButtonContainer}>
          {isCollapsed ? (
            <button
              onClick={() => {
                play('click');
                setIsSubmitModalOpen(true);
              }}
              onMouseEnter={() => play('hover')}
              className={styles.actionButtonCollapsed}
              title="Submit Experiment"
              aria-label="Submit Experiment"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => {
                play('click');
                setIsSubmitModalOpen(true);
              }}
              onMouseEnter={() => play('hover')}
              className={styles.actionButton}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.actionButtonIcon}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Experiment</span>
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <div className={styles.navSections}>
          <div className={styles.navPrimaryGroup}>
            {primaryNavItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`${styles.navItem} hover-slide-trigger ${active ? styles.navItemActive : ''}`}
                  data-tour={item.id === 'quests' || item.id === 'events' ? 'quests' : undefined}
                  onClick={() => {
                    play('navigation');
                    setIsMobileMenuOpen(false);
                  }}
                  onMouseEnter={() => play('hover')}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                <NavIconMark
                  icon={item.icon}
                  iconSrc={item.iconSrc}
                  isActive={active}
                  preserveColor={item.id === 'shop'}
                />
                <span className={styles.navItemLabel}><HoverSlideText>{item.label}</HoverSlideText></span>
              </Link>
              );
            })}
          </div>

          {extrasSection && (
            <div className={styles.navExtrasGroup}>
              {renderSection(extrasSection)}
            </div>
          )}
        </div>

        {/* Navigation Footer / Social Links */}
        {!isCollapsed && (
          <div className={styles.sidebarFooter}>
            {/* Social Icons row */}
            <div className={styles.socialIconsRow}>
              <a href="https://x.com/MentalWealthDAO" target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="X (Twitter)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                  <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
                </svg>
              </a>
              <a href="https://discord.gg/ZTRVCYwncs" target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="Discord">
                <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="currentColor">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.9-.65,1.76-1.34,2.58-2a75.58,75.58,0,0,0,73,0c.83.71,1.68,1.4,2.58,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,32.61-18.83C129.87,50.75,124,27.93,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
                </svg>
              </a>
              <a href="https://github.com/mental-Wealth-Academy/" target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="GitHub">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </a>
              <a href="https://www.linkedin.com/company/mentalwealthacademy" target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="LinkedIn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect width="4" height="12" x="2" y="9" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>

            {/* Text Links rows */}
            <div className={styles.footerLinksRow}>
              <a href="/about" className={styles.footerLink}>About</a>
              <a href="https://docs.mentalwealthacademy.world" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Docs</a>
              <span className={styles.footerDot}>•</span>
              <a href="/changelog" className={`${styles.footerLink} ${styles.changelogLink}`}>Changelog</a>
            </div>
            <div className={styles.footerLinksRow}>
              <a href="/terms" className={styles.footerLink}>Terms</a>
              <a href="/privacy" className={styles.footerLink}>Privacy</a>
              <a href="/support" className={styles.footerLink}>Support</a>
            </div>
          </div>
        )}

      </nav>

      {/* Profile card portaled into the top nav far-right slot (desktop) */}
      {profileSlot && createPortal(renderProfileCard(false), profileSlot)}

      {/* Floating Ask Blue button — bottom right (desktop).
          The /trades desk ships its own "Trade Using Blue" launcher in the same
          spot, so suppress this one there to avoid two stacked FABs. */}
      {!isChatOpen && pathname !== '/trades' && (
        <button
          type="button"
          className={`${styles.askBlueFab} hover-slide-trigger`}
          data-tour="ask-blue"
          onClick={() => {
            play('click');
            setIsChatOpen(true);
          }}
          onMouseEnter={() => play('hover')}
          aria-label="Ask Blue"
          title="Ask Blue"
        >
          <span className={styles.askBlueFabRing} />
          <span className={styles.askBlueFabInner}>
            <svg
              viewBox="0 0 511.893 511.893"
              className={styles.askBlueFabIcon}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M458.599,261.333c32.107-47.253,41.707-94.293,21.44-129.387c-19.947-34.453-64.213-49.6-119.787-46.187C335.079,32.853,297.959,0,255.932,0s-79.147,32.96-104.427,85.867c-0.747,0-1.6-0.213-2.347-0.213c-56.64-3.093-98.347,13.44-117.333,46.187c-20.267,35.2-10.667,82.133,21.44,129.387c-32.107,47.253-41.707,94.293-21.44,129.387c18.133,31.36,56.213,46.827,104.747,46.827c6.613,0,13.44-0.32,20.373-0.853c24.96,46.72,59.84,75.307,99.093,75.307s74.133-28.587,99.093-75.307c6.933,0.533,13.76,0.853,20.267,0.853c48.427,0,86.613-15.467,104.747-46.827C500.306,355.627,490.706,308.587,458.599,261.333z M461.586,142.613c14.933,25.813,7.147,62.08-16.96,99.947c-16.427-20.053-34.773-38.293-54.827-54.613c-3.84-27.627-10.667-54.613-20.373-80.747C412.839,105.813,446.972,117.333,461.586,142.613z M393.212,219.733c13.867,12.8,26.667,26.667,38.293,41.6c-11.84,15.253-25.067,29.44-39.36,42.453c1.493-15.467,2.347-31.467,2.347-47.787C394.599,243.733,394.172,231.573,393.212,219.733z M373.266,256c0,22.933-1.813,45.867-5.333,68.587c-17.173,13.547-35.307,25.813-54.293,36.8c-18.56,10.667-37.867,20.053-57.707,28.053c-19.84-8-39.147-17.387-57.707-28.053c-18.987-10.987-37.12-23.253-54.293-36.8c-6.507-41.387-7.04-83.52-1.707-125.12c17.707-14.08,36.373-26.773,56-38.187c18.667-10.773,37.973-20.16,57.92-28.16c19.84,8,39.04,17.493,57.6,28.16c19.52,11.307,38.293,24.107,55.893,38.187C372.092,218.24,373.266,237.12,373.266,256z M364.519,168.64c-12.587-8.96-26.027-17.6-40.107-25.813c-13.013-7.467-26.027-14.08-39.147-20.16c19.947-6.507,40.533-11.093,61.333-13.76C354.386,128.213,360.359,148.267,364.519,168.64z M255.932,21.333c31.04,0,59.84,25.707,81.067,66.88c-27.733,4.267-55.04,11.52-81.173,21.867c-26.133-10.24-53.333-17.493-81.067-21.653C195.986,47.147,224.786,21.333,255.932,21.333z M165.479,108.587c20.907,2.667,41.493,7.36,61.547,13.867c-13.12,6.08-26.24,12.8-39.467,20.373c-14.187,8.213-27.52,16.853-40.107,25.813C151.506,148.16,157.586,128,165.479,108.587z M50.279,142.613c14.187-24.533,46.933-37.013,92.267-35.627c-9.813,26.133-16.64,53.333-20.48,81.067c-20.053,16.32-38.507,34.56-54.827,54.613C43.132,204.693,35.346,168.427,50.279,142.613z M119.612,303.787c-14.293-13.013-27.413-27.2-39.253-42.453c11.627-14.827,24.427-28.8,38.293-41.493c-0.853,11.84-1.387,23.893-1.387,36.16C117.266,272.427,118.119,288.32,119.612,303.787z M50.279,380.053c-14.933-25.813-7.147-62.08,16.96-99.947c16.853,20.693,35.947,39.573,56.747,56.213c5.013,29.12,12.8,55.68,22.72,79.04C101.266,417.6,65.319,406.187,50.279,380.053z M150.119,356.053c11.84,8.213,24.213,16.213,37.333,23.787c13.12,7.573,26.133,14.08,39.147,20.16c-18.56,5.973-37.653,10.453-56.96,13.227C161.319,394.773,154.812,375.68,150.119,356.053z M255.932,490.667c-28.48,0-55.04-21.653-75.627-56.853c24-3.947,49.493-11.093,75.627-21.227c26.133,10.133,51.627,17.28,75.627,21.227C310.972,469.013,284.412,490.667,255.932,490.667z M342.119,413.227c-19.307-2.773-38.4-7.253-56.96-13.227c13.013-6.08,26.027-12.693,39.147-20.16c13.12-7.467,25.493-15.573,37.333-23.787C356.946,375.68,350.439,394.88,342.119,413.227z M461.586,380.053c-15.04,26.133-50.987,37.44-96.427,35.307c9.92-23.253,17.6-49.92,22.72-79.04c20.8-16.747,39.893-35.52,56.747-56.213C468.732,317.973,476.519,354.24,461.586,380.053z"/>
              <path d="M255.932,224c-23.573,0-42.667,19.093-42.667,42.667s19.093,42.667,42.667,42.667c23.573,0,42.667-19.093,42.667-42.667S279.506,224,255.932,224z"/>
            </svg>
            <span className={styles.askBlueFabLabel}>Ask Blue</span>
          </span>
        </button>
      )}

      {/* Modals */}
      {isChatOpen && <BlueChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
      {isLootBoxOpen && (
        <LootBoxModal
          isOpen={isLootBoxOpen}
          onClose={() => setIsLootBoxOpen(false)}
          shardCount={shardCount}
          onShardsSpent={(newCount: number) => setShardCount(newCount)}
        />
      )}
      {isProModalOpen && (
        <ProMembershipModal isOpen={isProModalOpen} onClose={() => setIsProModalOpen(false)} />
      )}
      {isYourAccountsModalOpen && (
        <YourAccountsModal onClose={() => setIsYourAccountsModalOpen(false)} />
      )}
      {isAvatarSelectorOpen && (
        <AvatarSelectorModal
          onClose={() => setIsAvatarSelectorOpen(false)}
          onAvatarSelected={handleAvatarSelected}
        />
      )}
      {isUsernameChangeModalOpen && (
        <UsernameChangeModal
          onClose={() => setIsUsernameChangeModalOpen(false)}
          currentUsername={username || ''}
          onUsernameChanged={handleUsernameChanged}
        />
      )}
      {isOnboardingOpen && (
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onComplete={handleOnboardingComplete}
        />
      )}
      {isSubmitModalOpen && (
        <SubmitProposalModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          mode="experiment"
        />
      )}

    </>
  );
};

export default SideNavigation;
