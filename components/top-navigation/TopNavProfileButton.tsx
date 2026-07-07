'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { providers, Contract } from 'ethers';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight, Robot, X } from '@phosphor-icons/react';
import { createPublicClient, http, formatEther, erc20Abi } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { getChainConfig } from '@/lib/chain-config';
import styles from './TopNavProfileButton.module.css';

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_BLUE_KILLSTREAK_ADDRESS ||
  '0x09a4FEfEe8245B644713546FDF28b4160218f7Fc';
const USDC_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];
const KILLSTREAK_ABI = [
  'function getVotingPower(address _voter) external view returns (uint256)',
];

function fmt(raw: unknown, decimals: number): string {
  const n = Number(raw) / 10 ** decimals;
  if (n === 0) return '0.00';
  if (n < 0.0001) return '<0.001';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long' });
const YEAR_FMT = new Intl.DateTimeFormat('en-US', { year: 'numeric' });

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}
function truncateAddr(addr: string) { return `${addr.slice(0, 6)}...${addr.slice(-4)}`; }

export default function TopNavProfileButton() {
  const router = useRouter();
  const { authenticated, getAccessToken, user: privyUser } = usePrivy();
  const { address } = useAccount();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Profile
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [shardCount, setShardCount] = useState<number | null>(null);

  // Inventory
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [votingPower, setVotingPower] = useState<string | null>(null);
  const [hasVip, setHasVip] = useState<boolean | null>(null);

  // Onchain wallet balances
  const [onchainEth, setOnchainEth] = useState<string | null>(null);
  const [onchainDiamonds, setOnchainDiamonds] = useState<string | null>(null);
  const [onchainBtc, setOnchainBtc] = useState<string | null>(null);

  // Derive wallet address from Privy linked wallets first, then wagmi
  const walletAddress: string | null = (() => {
    if (privyUser?.linkedAccounts && privyUser.linkedAccounts.length > 0) {
      const w = privyUser.linkedAccounts.find(
        (a: { type: string; address?: string }) => a.type === 'wallet' && a.address,
      ) as { type: string; address: string } | undefined;
      if (w?.address) return w.address;
    }
    if (address) return address;
    return null;
  })();

  // Calendar
  const [streak, setStreak] = useState(0);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  const [calLoading, setCalLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const displayName = username && !username.startsWith('user_') ? username : null;
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : address
    ? address.slice(2, 4).toUpperCase()
    : '??';

  // Fetch profile on auth
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/me', { cache: 'no-store', credentials: 'include', headers });
        const data = await res.json();
        if (cancelled) return;
        if (data?.user) {
          setUsername(data.user.username || null);
          setAvatarUrl(data.user.avatarUrl || null);
          setShardCount(data.user.shardCount ?? null);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [authenticated, getAccessToken]);

  // Refresh credits on event
  useEffect(() => {
    const handler = async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/me', { cache: 'no-store', credentials: 'include', headers });
        const data = await res.json();
        if (data?.user?.shardCount !== undefined) setShardCount(data.user.shardCount);
      } catch { /* silent */ }
    };
    window.addEventListener('shardsUpdated', handler);
    return () => window.removeEventListener('shardsUpdated', handler);
  }, [getAccessToken]);

  // Fetch on-chain inventory
  const fetchInventory = useCallback(async () => {
    try {
      const statusUrl = address
        ? `/api/account/status?walletAddress=${encodeURIComponent(address)}`
        : '/api/account/status';
      const status = await window
        .fetch(statusUrl, { cache: 'no-store', credentials: 'include' })
        .then(r => (r.ok ? r.json().catch(() => null) : null))
        .catch(() => null);
      setHasVip(Boolean(status?.hasVipMembershipCard));

      if (typeof window === 'undefined' || !window.ethereum) return;
      const provider = new providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (!accounts.length) return;
      const addr = accounts[0];
      const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
      const ks = new Contract(CONTRACT_ADDRESS, KILLSTREAK_ABI, provider);
      const [usdcRaw, usdcDec, vpRaw] = await Promise.all([
        usdc.balanceOf(addr),
        usdc.decimals(),
        ks.getVotingPower(addr).catch(() => null),
      ]);
      setUsdcBalance(fmt(usdcRaw, Number(usdcDec)));
      if (vpRaw !== null) {
        const vp = Number(vpRaw) / 1e18;
        setVotingPower(vp >= 1 ? Math.floor(vp).toLocaleString() : vp.toFixed(2));
      } else {
        setVotingPower('0');
      }
    } catch { /* silent */ }
  }, [address]);

  useEffect(() => {
    if (address) void fetchInventory();
  }, [address, fetchInventory]);

  // Fetch onchain wallet balances when drawer opens
  const fetchOnchainBalances = useCallback(async (addr: string) => {
    const cfg = getChainConfig();
    const chain = cfg.chainId === 84532 ? baseSepolia : base;
    const client = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
    try {
      const a = addr as `0x${string}`;
      const eth = await client.getBalance({ address: a });
      setOnchainEth(Number(formatEther(eth)).toFixed(4));

      const [diamondR, btcR] = await client.multicall({
        contracts: [
          { address: cfg.diamondsTokenAddress as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [a] },
          ...(cfg.cbBTcAddress ? [{ address: cfg.cbBTcAddress as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [a] }] : []),
        ],
        allowFailure: true,
      });

      if (diamondR.status === 'success') {
        const d = Number(diamondR.result) / 1e18;
        setOnchainDiamonds(d < 1 ? d.toFixed(2) : Math.floor(d).toLocaleString());
      }
      if (btcR && 'status' in btcR && btcR.status === 'success') {
        setOnchainBtc((Number(btcR.result) / 1e8).toFixed(8));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (drawerOpen && walletAddress) void fetchOnchainBalances(walletAddress);
    else if (!drawerOpen) {
      setOnchainEth(null);
      setOnchainDiamonds(null);
      setOnchainBtc(null);
    }
  }, [drawerOpen, walletAddress, fetchOnchainBalances]);

  // Fetch calendar data when drawer opens
  const fetchCalendar = useCallback(async () => {
    if (!authenticated) return;
    setCalLoading(true);
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [streakRes, notesRes] = await Promise.all([
        fetch('/api/daily-notes/streak', { credentials: 'include', cache: 'no-store', headers }),
        fetch('/api/daily-notes', { credentials: 'include', cache: 'no-store', headers }),
      ]);
      if (streakRes.ok) {
        const d = await streakRes.json();
        setStreak(d.streak ?? 0);
      }
      if (notesRes.ok) {
        const d = await notesRes.json();
        const dates = new Set<string>();
        Object.values(d.allWeekPages ?? {}).forEach((entries) => {
          (entries as Array<{ date?: string }>).forEach((entry) => {
            if (entry?.date) dates.add(entry.date);
          });
        });
        setCompletedDates(dates);
      }
    } catch { /* silent */ }
    finally { setCalLoading(false); }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (drawerOpen) void fetchCalendar();
  }, [drawerOpen, fetchCalendar]);

  // Escape to close
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const todayKey = dateKey(new Date());
    return Array.from({ length: 35 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const dk = dateKey(date);
      return {
        date, dk,
        inMonth: isSameMonth(date, currentMonth),
        completed: completedDates.has(dk),
        today: dk === todayKey,
      };
    });
  }, [currentMonth, completedDates]);

  const monthlyCount = calendarDays.filter(d => d.inMonth && d.completed).length;
  const vipCls = hasVip === null ? '' : hasVip ? styles.statPositive : styles.statNegative;

  return (
    <>
      {/* Chip button */}
      <button
        type="button"
        className={styles.chip}
        onClick={() => setDrawerOpen(true)}
        aria-label="Open profile"
      >
        <div className={styles.chipAvatar}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName || 'Profile'}
              width={28}
              height={28}
              className={styles.chipAvatarImg}
              unoptimized
            />
          ) : (
            <span className={styles.chipInitials}>{initials}</span>
          )}
        </div>
        <div className={styles.chipInfo}>
          <span className={styles.chipName}>
            {displayName ? `@${displayName}` : 'Connected'}
          </span>
          {address && (
            <span className={styles.chipWallet}>{truncateAddr(address)}</span>
          )}
        </div>
      </button>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
      >
        {/* Drawer header */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerIdentity}>
            <div className={styles.drawerAvatar}>
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName || 'Profile'}
                  width={40}
                  height={40}
                  className={styles.drawerAvatarImg}
                  unoptimized
                />
              ) : (
                <span className={styles.drawerInitials}>{initials}</span>
              )}
            </div>
            <div className={styles.drawerIdentityText}>
              <span className={styles.drawerName}>
                {displayName ? `@${displayName}` : 'Connected'}
              </span>
              {address && (
                <span className={styles.drawerWallet}>{truncateAddr(address)}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

          <div className={styles.drawerBody}>
            {/* Agent nav */}
            <button
              type="button"
              className={styles.agentNavBtn}
              onClick={() => { setDrawerOpen(false); router.push('/agents'); }}
            >
              <Robot size={16} weight="fill" />
              <span>Enter as Agent</span>
            </button>

            {/* Inventory */}
            <div className={styles.inventory}>
            <div className={styles.shardsRow}>
              <div className={styles.shardsLeft}>
                <Image src="/icons/ui-diamond.svg" alt="" width={28} height={28} className={styles.shardsIcon} />
                <span className={styles.shardsLabel}>Diamonds</span>
              </div>
              <span className={styles.shardsValue}>{shardCount !== null ? shardCount : '—'}</span>
            </div>

            <div className={styles.divider} />

            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${styles.tokenVotes}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className={styles.tokenName}>Votes</span>
              </div>
              <span className={styles.balanceVal}>{votingPower ?? '0'}</span>
            </div>

            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${hasVip ? styles.tokenVipActive : styles.tokenVip}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className={styles.tokenName}>VIP</span>
              </div>
              <span className={`${styles.balanceVal} ${vipCls}`}>
                {hasVip === null ? '--' : hasVip ? 'YES' : 'NO'}
              </span>
            </div>

            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${styles.tokenUsdc}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#2775CA" />
                    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">$</text>
                  </svg>
                </div>
                <span className={styles.tokenName}>USDC</span>
              </div>
              <span className={styles.balanceVal}>{usdcBalance ?? '0.00'}</span>
            </div>

            <div className={styles.divider} />

            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${styles.tokenEth}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#8A92B2" />
                    <path d="M2 17l10 5 10-5" fill="#62688F" />
                    <path d="M2 12l10 5 10-5" fill="#8A92B2" />
                  </svg>
                </div>
                <span className={styles.tokenName}>ETH</span>
              </div>
              <span className={styles.balanceVal}>{onchainEth ?? '—'}</span>
            </div>

            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${styles.tokenDiamond}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#6366F1" />
                    <path d="M2 17l10 5 10-5" fill="#4F46E5" />
                    <path d="M2 12l10 5 10-5" fill="#6366F1" />
                  </svg>
                </div>
                <span className={styles.tokenName}>$BLUE</span>
              </div>
              <span className={styles.balanceVal}>{onchainDiamonds ?? '—'}</span>
            </div>

            {getChainConfig().cbBTcAddress && (
              <div className={styles.balanceRow}>
                <div className={styles.tokenLeft}>
                  <div className={`${styles.tokenIcon} ${styles.tokenBtc}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#F7931A" />
                      <path d="M12 6v12" stroke="white" strokeWidth="1.5" />
                      <path d="M9.5 8.5h4.5a2.5 2.5 0 0 1 0 5h-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M9.5 13.5h5a2 2 0 0 1 0 4h-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className={styles.tokenName}>Bitcoin</span>
                </div>
                <span className={styles.balanceVal}>{onchainBtc ?? '—'}</span>
              </div>
            )}
          </div>

          {/* Calendar section */}
          <div className={styles.calSection}>
            <div className={styles.calStats}>
              <div className={styles.calStat}>
                <span className={styles.calStatValue}>{calLoading ? '—' : streak}</span>
                <span className={styles.calStatLabel}>day streak</span>
              </div>
              <div className={styles.calStatDivider} />
              <div className={styles.calStat}>
                <span className={styles.calStatValue}>{calLoading ? '—' : monthlyCount}</span>
                <span className={styles.calStatLabel}>this month</span>
              </div>
              <div className={styles.calStatDivider} />
              <div className={styles.calStat}>
                <span className={styles.calStatValue}>{calLoading ? '—' : completedDates.size}</span>
                <span className={styles.calStatLabel}>total</span>
              </div>
            </div>

            <div className={styles.calHeader}>
              <span className={styles.calMonthLabel}>
                {MONTH_FMT.format(currentMonth)} {YEAR_FMT.format(currentMonth)}
              </span>
              <div className={styles.calNavBtns}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                  aria-label="Previous month"
                >
                  <CaretLeft size={11} weight="bold" />
                </button>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                  aria-label="Next month"
                >
                  <CaretRight size={11} weight="bold" />
                </button>
              </div>
            </div>

            <div className={styles.calGrid}>
              {WEEKDAY_LABELS.map(l => (
                <div key={l} className={styles.weekLabel}>{l}</div>
              ))}
              {calendarDays.map(day => (
                <div
                  key={day.dk}
                  className={[
                    styles.dayCell,
                    !day.inMonth && styles.dayCellOut,
                    day.today && styles.dayCellToday,
                    day.completed && day.inMonth && styles.dayCellDone,
                  ].filter(Boolean).join(' ')}
                >
                  <span className={styles.dayNum}>{day.date.getDate()}</span>
                  {day.completed && day.inMonth && <span className={styles.dot} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
