'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const BlueChat = dynamic(() => import('../blue-chat/BlueChat'), { ssr: false });
const SidebarProfileCard = dynamic(() => import('../sidebar-profile-card/SidebarProfileCard'), { ssr: false });
const SidebarInventoryCard = dynamic(() => import('../sidebar-inventory-card/SidebarInventoryCard'), { ssr: false });
const AvatarSelectorModal = dynamic(() => import('../avatar-selector/AvatarSelectorModal'), { ssr: false });
const UsernameChangeModal = dynamic(() => import('../username-change/UsernameChangeModal'), { ssr: false });
const ProMembershipModal = dynamic(() => import('../pro-membership-modal/ProMembershipModal'), { ssr: false });
const InventoryModal = dynamic(() => import('../inventory-modal/InventoryModal'), { ssr: false });
const YourAccountsModal = dynamic(() => import('../nav-buttons/YourAccountsModal'), { ssr: false });
const OnboardingModal = dynamic(() => import('../onboarding/OnboardingModal'), { ssr: false });
const LootBoxModal = dynamic(() => import('../loot-box/LootBoxModal'), { ssr: false });
const ProfilePopup = dynamic(() => import('../profile-popup/ProfilePopup'), { ssr: false });
const SoulModal = dynamic(() => import('../soul-modal/SoulModal'), { ssr: false });

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
    label: 'Community Resources',
    items: [
      { id: 'research', label: 'R-Tool', href: '/research', iconSrc: '/icons/nav-laboratory.svg', badge: 'Pro', badgeType: 'pro', requiresPro: true },
      { id: 'simulations', label: 'Simulations', href: 'https://azure-world.vercel.app/', iconSrc: '/icons/nav-community.svg', badge: 'Pro', badgeType: 'pro', requiresPro: true },
    ],
  },
];

const mobileNavSections: NavSection[] = [
  {
    id: 'extras',
    label: 'Community Resources',
    items: [
      { id: 'research', label: 'R-Tool', href: '/research', iconSrc: '/icons/nav-laboratory.svg', badge: 'Pro', badgeType: 'pro', requiresPro: true },
      { id: 'simulations', label: 'Simulations', href: 'https://azure-world.vercel.app/', iconSrc: '/icons/nav-community.svg', badge: 'Pro', badgeType: 'pro', requiresPro: true },
    ],
  },
];

const primaryNavItems: NavItem[] = [
  {
    id: 'morning-pages',
    label: 'Journal',
    href: '/course',
    iconSrc: '/icons/nav-spiral.svg',
  },
  {
    id: 'feedback',
    label: 'Surveys',
    href: '/surveys',
    iconSrc: '/icons/nav-feedback.svg',
  },
  {
    id: 'markets',
    label: 'Markets',
    href: '/markets',
    iconSrc: '/icons/nav-markets.svg',
  },
  {
    id: 'events',
    label: 'Quests',
    href: '/quests',
    iconSrc: '/icons/nav-community.svg',
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
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isYourAccountsModalOpen, setIsYourAccountsModalOpen] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLootBoxOpen, setIsLootBoxOpen] = useState(false);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const [isSoulModalOpen, setIsSoulModalOpen] = useState(false);
  const [userLoadComplete, setUserLoadComplete] = useState(false);
  const [hasVipMembershipCard, setHasVipMembershipCard] = useState<boolean | null>(null);
  const { play } = useSound();
  const sessionCreatedForRef = useRef<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const [accountMenuStyle, setAccountMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const collapsed = document.documentElement.getAttribute('data-sidebar-collapsed') === 'true';
    setIsCollapsed(collapsed);
    syncSidebarPreference(collapsed);
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

    setHasVipMembershipCard(null);
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
        const data = await response.json();
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
  const shouldShowProfileSkeleton = !ready || (authenticated && !userLoadComplete);
  const shouldShowProfileCards = !shouldShowProfileSkeleton && (hasConnectedWallet || hasDisplayProfile);

  const renderSection = (section: NavSection) => {
    const isExtras = section.id === 'extras';
    const isExpanded = isExtras ? adminExpanded : true;

    return (
      <div className={styles.section}>
        {section.label && (
          <button
            className={`${styles.sectionHeader} ${isExtras ? styles.sectionHeaderToggle : ''}`}
            onClick={isExtras ? () => setAdminExpanded(!adminExpanded) : undefined}
            type="button"
          >
            <span className={styles.sectionLabel}>{section.label}</span>
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
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} />
                <span className={styles.navItemLabel}>{item.label}</span>
                <span className={`${styles.badge} ${styles.badgeChecking}`}>
                  Checking
                </span>
              </div>
            ) : proState === 'locked' ? (
              <button
                key={item.id}
                onClick={() => {
                  play('click');
                  setIsProModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                onMouseEnter={() => play('hover')}
                className={`${styles.navItem} ${styles.navItemButton}`}
                title={isCollapsed ? item.label : undefined}
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} />
                <span className={styles.navItemLabel}>{item.label}</span>
                <span className={`${styles.badge} ${styles.badgeLocked}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3, verticalAlign: '-1px' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Locked
                </span>
              </button>
            ) : item.disabled ? (
              <div
                key={item.id}
                className={`${styles.navItem} ${styles.navItemDisabled}`}
                title={isCollapsed ? item.label : undefined}
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} />
                <span className={styles.navItemLabel}>{item.label}</span>
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
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                {...(item.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => {
                  play('navigation');
                  setIsMobileMenuOpen(false);
                }}
                onMouseEnter={() => play('hover')}
                title={isCollapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <NavIconMark icon={item.icon} iconSrc={item.iconSrc} isActive={active} />
                <span className={styles.navItemLabel}>{item.label}</span>
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

  const renderProfileSpace = () => {
    if (shouldShowProfileSkeleton) {
      return (
        <>
          <div className={styles.profileSkeletonCard} aria-label="Loading profile">
            <div className={styles.profileSkeletonAvatar} />
            {!isCollapsed && (
              <div className={styles.profileSkeletonLines}>
                <span className={styles.profileSkeletonLineWide} />
                <span className={styles.profileSkeletonLineShort} />
              </div>
            )}
          </div>
          {isCollapsed ? (
            <div className={styles.inventorySkeletonCardCollapsed}>
              <span className={styles.inventorySkeletonCircleSm} style={{ width: 18, height: 18 }} />
              <span className={styles.inventorySkeletonLine} style={{ width: 22, height: 8 }} />
            </div>
          ) : (
            <div className={styles.inventorySkeletonCard}>
              <div className={styles.inventorySkeletonHero}>
                <span className={styles.inventorySkeletonCircle} />
                <span className={styles.inventorySkeletonLine} style={{ width: 80 }} />
              </div>
              <div className={styles.inventorySkeletonDivider} />
              {[0, 1, 2].map(i => (
                <div key={i} className={styles.inventorySkeletonRow}>
                  <span className={styles.inventorySkeletonCircleSm} />
                  <span className={styles.inventorySkeletonLine} style={{ width: 36 }} />
                  <span className={styles.inventorySkeletonLine} style={{ width: 28, marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    if (shouldShowProfileCards) {
      return (
        <>
          <SidebarProfileCard
            username={username}
            avatarUrl={avatarUrl}
            address={address}
            isCollapsed={isCollapsed}
            onChangeAvatar={handleAvatarClick}
            onChangeUsername={handleUsernameClick}
            onConnections={() => setIsYourAccountsModalOpen(true)}
            onSoul={() => setIsSoulModalOpen(true)}
            onSignOut={handleSignOut}
            onViewProfile={() => setIsProfilePopupOpen(true)}
          />
          <SidebarInventoryCard
            shardCount={shardCount}
            address={address}
            isCollapsed={isCollapsed}
          />
        </>
      );
    }

    return null;
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

        {/* Profile + Inventory cards — always visible at top */}
        {renderProfileSpace()}

        {/* Navigation Sections */}
        <div className={styles.navSections}>
          <div className={styles.navPrimaryGroup}>
            {primaryNavItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                  data-tour={item.id === 'morning-pages' ? 'journal' : item.id === 'markets' ? 'markets' : item.id === 'events' ? 'quests' : undefined}
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
                <span className={styles.navItemLabel}>{item.label}</span>
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

      </nav>

      {/* Modals */}
      {isChatOpen && <BlueChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
      {isInventoryOpen && (
        <InventoryModal
          isOpen={isInventoryOpen}
          onClose={() => setIsInventoryOpen(false)}
          shardCount={shardCount}
          username={username}
          avatarUrl={avatarUrl}
        />
      )}
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

      {isProfilePopupOpen && (
        <ProfilePopup
          username={username}
          avatarUrl={avatarUrl}
          address={address}
          onClose={() => setIsProfilePopupOpen(false)}
        />
      )}

      {isSoulModalOpen && (
        <SoulModal onClose={() => setIsSoulModalOpen(false)} />
      )}

    </>
  );
};

export default SideNavigation;
