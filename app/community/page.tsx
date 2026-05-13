'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import type { TutorialStep } from '@/components/still-tutorial/StillTutorial';
import TreasuryDisplay from '@/components/treasury-display/TreasuryDisplay';
import ProposalCard from '@/components/proposal-card/ProposalCard';
import { useSound } from '@/hooks/useSound';
import styles from './page.module.css';

// ─── Seed social-feed posts ───────────────────────────────────────────────────

type FeedCategory = 'Funding' | 'Mental Health' | 'Neuroscience' | 'Research';

interface SeedPost {
  id: string;
  author: string;
  avatar: string;
  category: FeedCategory;
  title: string;
  body: string;
  ts: number;
  likes: number;
  replies: number;
}

const NOW = Date.now();

const SEED_POSTS: SeedPost[] = [
  {
    id: 'sp-1',
    author: 'OpenGrants_DAO',
    avatar: '/uploads/vesper-landing-avatar.png',
    category: 'Funding',
    title: 'Q2 Retroactive Funding Round — Nominations Open',
    body: 'The Q2 retroactive public goods round is live. Nominate projects that created measurable impact for the AI-safety and mental wellness ecosystem. 200k pool. Voting closes May 20.',
    ts: NOW - 1000 * 60 * 18,
    likes: 112,
    replies: 45,
  },
  {
    id: 'sp-2',
    author: 'MindBridge_Collective',
    avatar: '/anbel09.png',
    category: 'Mental Health',
    title: 'AI-Assisted Peer Support for Rural Communities',
    body: 'Rural access to mental health resources is critically underfunded. We\'re pairing LLM-based triage agents with licensed counselors across 3 pilot counties. Looking for 5 co-funders at $10k each.',
    ts: NOW - 1000 * 60 * 60 * 5,
    likes: 67,
    replies: 28,
  },
  {
    id: 'sp-3',
    author: 'NeuroCognitive_Lab',
    avatar: '/anbel11.png',
    category: 'Neuroscience',
    title: 'Cortical Plasticity Under Sleep Deprivation — fMRI Study',
    body: 'Proposing a 12-week fMRI study tracking prefrontal cortex activity changes in 40 subjects with restricted sleep schedules. Seeking $48k in compute grants to run analysis pipelines.',
    ts: NOW - 1000 * 60 * 60 * 22,
    likes: 34,
    replies: 12,
  },
  {
    id: 'sp-4',
    author: 'SynapticFlow_Research',
    avatar: '/prompts/CharacterBlue.png',
    category: 'Research',
    title: 'Open Dataset: Attention Metrics in LLM-Augmented Dev Workflows',
    body: "Releasing an anonymized 6-month dataset of human attention patterns when working alongside AI coding agents. Looking for collaborators to co-analyze and co-publish. DM to join.",
    ts: NOW - 1000 * 60 * 60 * 48,
    likes: 29,
    replies: 9,
  },
  {
    id: 'sp-5',
    author: 'Clarity_Initiative',
    avatar: '/uploads/vesper-landing-avatar.png',
    category: 'Mental Health',
    title: 'RFC: Open Protocol for Burnout Detection in Dev Teams',
    body: 'Working with occupational psychologists to build a privacy-first burnout signal protocol. Agents could surface these patterns to team leads without surveillance. RFC stage — feedback welcome.',
    ts: NOW - 1000 * 60 * 60 * 72,
    likes: 18,
    replies: 7,
  },
];

const CATEGORY_STYLE: Record<FeedCategory, { bg: string; color: string }> = {
  'Funding':       { bg: 'rgba(81, 104, 255, 0.12)', color: '#7b93ff' },
  'Mental Health': { bg: 'rgba(116, 196, 101, 0.14)', color: '#74C465' },
  'Neuroscience':  { bg: 'rgba(167, 139, 250, 0.14)', color: '#a78bfa' },
  'Research':      { bg: 'rgba(242, 160, 181, 0.14)', color: '#f2a0b5' },
};

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function SeedPostCard({ post }: { post: SeedPost }) {
  const [liked, setLiked] = useState(false);
  const cat = CATEGORY_STYLE[post.category];
  return (
    <div className={styles.seedPostCard}>
      <div className={styles.seedPostHeader}>
        <div className={styles.seedPostAvatar}>
          <Image src={post.avatar} alt={post.author} width={36} height={36} unoptimized className={styles.seedPostAvatarImg} />
        </div>
        <div className={styles.seedPostMeta}>
          <span className={styles.seedPostAuthor}>{post.author}</span>
          <span className={styles.seedPostTime}>{relTime(post.ts)}</span>
        </div>
        <span className={styles.seedPostCategoryPill} style={{ background: cat.bg, color: cat.color }}>
          {post.category}
        </span>
      </div>
      <div className={styles.seedPostTitle}>{post.title}</div>
      <div className={styles.seedPostBody}>{post.body}</div>
      <div className={styles.seedPostActions}>
        <button
          className={`${styles.seedPostAction} ${liked ? styles.seedPostActionLiked : ''}`}
          onClick={() => setLiked(v => !v)}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {post.likes + (liked ? 1 : 0)}
        </button>
        <button className={styles.seedPostAction} type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {post.replies}
        </button>
        <button className={styles.seedPostDiscussBtn} type="button">Discuss →</button>
      </div>
    </div>
  );
}


const StillTutorial = dynamic(() => import('@/components/still-tutorial/StillTutorial'), {
  ssr: false,
});
const ProposalDetailsModal = dynamic(() => import('@/components/proposal-card/ProposalDetailsModal'), {
  ssr: false,
});
const SubmitProposalModal = dynamic(() => import('@/components/voting/SubmitProposalModal'), {
  ssr: false,
});

interface ProposalReview {
  decision: 'approved' | 'rejected';
  reasoning: string;
  tokenAllocation: number | null;
  scores: {
    clarity: number;
    impact: number;
    feasibility: number;
    budget: number;
    ingenuity: number;
    chaos: number;
  } | null;
  reviewedAt: string;
  onChainProposalId: string | null;
}

interface DatabaseProposal {
  id: string;
  title: string;
  proposalMarkdown: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'active' | 'completed';
  walletAddress: string;
  createdAt: string;
  onChainProposalId: string | null;
  onChainTxHash: string | null;
  user: {
    username: string | null;
    avatarUrl: string | null;
  };
  review: ProposalReview | null;
}

interface MergedProposal extends DatabaseProposal {
  onChainData?: {
    forVotes: string;
    againstVotes: string;
    votingDeadline: number;
    blueLevel: number;
    executed: boolean;
  };
}


const getTutorialSteps = (): TutorialStep[] => [
  {
    message: 'Welcome to the Decision Room. I\'m Blue. This is where proposals, treasury activity, and community signals are reviewed in one place.',
    emotion: 'happy',
  },
  {
    message: 'Got an idea? Submit it and I\'ll review it for clarity, impact, and feasibility. Better proposals lead to better decisions.',
    emotion: 'happy',
    targetElement: '[data-tutorial-target="voting-stages"]',
  },
  {
    message: 'Once a proposal clears review, it moves to community voting. Every vote changes what gets funded and what gets built next.',
    emotion: 'happy',
    targetElement: '[data-tutorial-target="admin-room"]',
  },
  {
    message: 'Each proposal puts a concrete request in front of the group. Approval is not guaranteed, so specifics matter.',
    emotion: 'confused',
    targetElement: '[data-tutorial-target="submission"]',
  },
  {
    message: 'Bring a proposal, review the room, or cast a vote. This space is for shared decisions and transparent follow-through.',
    emotion: 'happy',
  },
];


const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BLUE_KILLSTREAK_ADDRESS || '0x2cbb90a761ba64014b811be342b8ef01b471992d';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet USDC
const TREASURY_BALANCE = 5200;
const FUNDING_PODS = [
  {
    title: 'Brand Awareness',
    amount: 2100,
    total: TREASURY_BALANCE,
    desc: 'Outreach, partnerships, and marketing that drives community growth',
    accent: 'var(--color-primary)',
  },
  {
    title: 'Internal Research',
    amount: 1820,
    total: TREASURY_BALANCE,
    desc: 'R&D, tooling, and knowledge infrastructure for the academy',
    accent: '#2FB7A0',
  },
  {
    title: 'Emergency Funds',
    amount: 1280,
    total: TREASURY_BALANCE,
    desc: 'Safety net for members facing unexpected hardship',
    accent: '#E85D3A',
  },
] as const;

const DASHBOARD_PARTICIPANTS: ReadonlyArray<{
  label: string;
  accent: string;
  image?: string;
}> = [
  { label: 'Blue', image: '/prompts/CharacterBlue.png', accent: styles.dashboardAvatarImageWrap },
  { label: 'Vesper', image: '/uploads/vesper-landing-avatar.png', accent: styles.dashboardAvatarImageWrap },
  { label: 'Orbit', image: '/anbel09.png', accent: styles.dashboardAvatarImageWrap },
  { label: 'Prism', image: '/anbel11.png', accent: styles.dashboardAvatarImageWrap },
];

function SkeletonLine({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeletonLine} ${className}`} aria-hidden="true" />;
}


function ProposalSkeletonCard() {
  return (
    <div className={styles.proposalSkeletonCard} aria-hidden="true">
      <div className={styles.proposalSkeletonHeader}>
        <SkeletonLine className={styles.proposalSkeletonTitle} />
        <SkeletonLine className={styles.proposalSkeletonBadge} />
      </div>
      <SkeletonLine className={styles.proposalSkeletonTextWide} />
      <SkeletonLine className={styles.proposalSkeletonText} />
      <div className={styles.proposalSkeletonFooter}>
        <SkeletonLine className={styles.proposalSkeletonMeta} />
        <SkeletonLine className={styles.proposalSkeletonAction} />
      </div>
    </div>
  );
}

function ProposalSkeletonList() {
  return (
    <div className={styles.overviewProposalsList} aria-label="Loading proposals">
      {[0, 1, 2].map((i) => (
        <ProposalSkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function VotingPage() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [proposals, setProposals] = useState<MergedProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const { play } = useSound();
  const selectedProposal = selectedProposalId
    ? proposals.find((proposal) => proposal.id === selectedProposalId) ?? null
    : null;
  const isPageLoading = loading && proposals.length === 0;

  const enrichProposals = useCallback(async (dbProposals: DatabaseProposal[]) => {
    const proposalsNeedingChainData = dbProposals.filter((proposal) =>
      proposal.review?.onChainProposalId &&
      (proposal.status === 'approved' || proposal.status === 'active' || proposal.status === 'completed')
    );

    if (proposalsNeedingChainData.length === 0) return;

    try {
      const [{ providers }, { fetchProposal }] = await Promise.all([
        import('ethers'),
        import('@/lib/blue-contract'),
      ]);

      const provider = typeof window.ethereum !== 'undefined'
        ? new providers.Web3Provider(window.ethereum)
        : new providers.JsonRpcProvider('https://mainnet.base.org');

      const updates = await Promise.all(
        proposalsNeedingChainData.map(async (proposal) => {
          try {
            const onChainProposal = await fetchProposal(
              CONTRACT_ADDRESS,
              parseInt(proposal.review!.onChainProposalId!, 10),
              provider as any,
            );

            return {
              id: proposal.id,
              onChainData: {
                forVotes: onChainProposal.forVotes,
                againstVotes: onChainProposal.againstVotes,
                votingDeadline: onChainProposal.votingDeadline,
                blueLevel: onChainProposal.blueLevel,
                executed: onChainProposal.executed,
              },
            };
          } catch (chainError) {
            console.error(`Error fetching on-chain data for proposal ${proposal.id}:`, chainError);
            return null;
          }
        }),
      );

      const updatesById = new Map(
        updates
          .filter((update): update is NonNullable<typeof update> => update !== null)
          .map((update) => [update.id, update.onChainData]),
      );

      if (updatesById.size === 0) return;

      setProposals((current) =>
        current.map((proposal) =>
          updatesById.has(proposal.id)
            ? { ...proposal, onChainData: updatesById.get(proposal.id) }
            : proposal,
        ),
      );
    } catch (chainError) {
      console.error('Error enriching proposals with on-chain data:', chainError);
    }
  }, []);

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch reviewed proposals from database
      const dbResponse = await fetch('/api/voting/proposals');
      if (!dbResponse.ok) {
        throw new Error('Failed to fetch proposals from database');
      }

      const dbData = await dbResponse.json();
      const dbProposals: DatabaseProposal[] = dbData.proposals || [];
      setProposals(dbProposals as MergedProposal[]);
      void enrichProposals(dbProposals);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      setError('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [enrichProposals]);

  useEffect(() => {
    void fetchProposals();
  }, [fetchProposals]);

  // Mark community as visited so the nav red dot clears
  useEffect(() => {
    try { localStorage.setItem('mwa-community-last-visit', Date.now().toString()); } catch { /* ignore */ }
    window.dispatchEvent(new Event('communityVisited'));
  }, []);

  const handleTutorialComplete = () => {
    localStorage.setItem('hasSeenAdminTutorial', 'true');
    setShowTutorial(false);
  };

  const handleViewDetails = (proposalId: string) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (proposal) {
      setSelectedProposalId(proposalId);
      setIsModalOpen(true);
    }
  };


  return (
    <>
      {showTutorial && (
        <StillTutorial
          steps={getTutorialSteps()}
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
          onComplete={handleTutorialComplete}
          title="Voting Guide"
          showProgress={true}
        />
      )}
      <div className={styles.pageLayout}>
        <SideNavigation />
        <main className={styles.page}>
        <div className={styles.content}>
          <>
          <div className={styles.communityMainWrapper}>
            <div className={styles.dashboardChrome}>
              <header className={styles.dashboardMasthead}>
                <div className={styles.dashboardBrand}>
                  <div className={styles.dashboardBrandMark} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.dashboardBrandText}>
                    <span className={styles.dashboardBrandName}>Mental Wealth Academy</span>
                    <span className={styles.dashboardBrandMeta}>Decision Room</span>
                  </div>
                </div>
                <div className={styles.dashboardSearch} aria-label="Dashboard search">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M11 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12Zm8 14l-3.4-3.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Search proposals, treasury activity, and member signals</span>
                </div>
                <div className={styles.dashboardPresence} aria-label="Active members">
                  {DASHBOARD_PARTICIPANTS.map((participant) => (
                    <span
                      key={participant.label}
                      className={`${styles.dashboardAvatar} ${participant.accent}`}
                      title={participant.label}
                    >
                      {participant.image ? (
                        <Image
                          src={participant.image}
                          alt={participant.label}
                          width={34}
                          height={34}
                          className={styles.dashboardAvatarImage}
                          unoptimized
                        />
                      ) : (
                        participant.label
                      )}
                    </span>
                  ))}
                </div>
              </header>

              <div className={styles.dashboardTitleRow}>
                <div className={styles.dashboardTitleBlock}>
                  <div className={styles.communityHubHeading}>
                    <h1 className={styles.dashboardTitle}>
                      MWA <span className={styles.dashboardTitleAccent}>Community Hub</span>
                    </h1>
                    <div className={styles.podInfoWrap}>
                      <button
                        className={styles.podInfoButton}
                        type="button"
                        aria-label="Explain decentralized treasury cluster pods"
                      >
                        i
                      </button>
                      <div className={styles.podInfoTooltip} role="tooltip">
                        <span className={styles.podInfoTitle}>Decentralized treasury cluster</span>
                        <span className={styles.podInfoText}>
                          Blue separates the treasury into purpose-built pods so capital can be reviewed by use case instead of sitting in one undifferentiated pool.
                        </span>
                        <div className={styles.podInfoList}>
                          {FUNDING_PODS.map((pod) => (
                            <div key={pod.title} className={styles.podInfoItem}>
                              <span className={styles.podInfoDot} style={{ background: pod.accent }} />
                              <span className={styles.podInfoItemText}>
                                <strong>{pod.title}</strong>
                                <span>${pod.amount.toLocaleString()} · {pod.desc}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className={styles.dashboardSubtitle}>
                    Shared treasury. Shared decisions.
                  </p>
                  <p className={styles.dashboardTreasuryBalance}>$5,343</p>
                </div>
                <div className={styles.dashboardTitleRightGroup}>
                  <TreasuryDisplay
                    contractAddress={CONTRACT_ADDRESS}
                    usdcAddress={USDC_ADDRESS}
                    compact
                    className={styles.dashboardWalletCard}
                  />
                </div>
              </div>

            <div className={styles.communityViewViewport}>
              <section className={styles.communityViewPanel}>
                  <div className={styles.overviewColumns}>

                      <div className={styles.overviewProposalsColumn}>
                        {/* Social feed — seed discussion posts */}
                        <div className={styles.feedSectionLabel}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          Recent Discussions
                        </div>
                        <div className={styles.seedFeed}>
                          {SEED_POSTS.map((post) => <SeedPostCard key={post.id} post={post} />)}
                        </div>

                        <div className={styles.feedSectionLabel} style={{ marginTop: 32 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" />
                          </svg>
                          Active Proposals
                        </div>
                      {isPageLoading || (loading && proposals.length > 0) ? (
                        <ProposalSkeletonList />
                      ) : error ? (
                        <div className={styles.errorState}>
                          <h3>Error Loading Proposals</h3>
                          <p>{error}</p>
                          <button onClick={() => { play('click'); void fetchProposals(); }} onMouseEnter={() => play('hover')} className={styles.retryButton} type="button">Retry</button>
                        </div>
                      ) : proposals.length === 0 ? (
                        <div className={styles.emptyState}>
                          <h3>No proposals yet</h3>
                          <p>Be the first to submit a proposal to the community!</p>
                        </div>
                      ) : (
                        <div className={styles.overviewProposalsList} data-tutorial-target="submission">
                          {proposals.map((proposal) => (
                            <div key={proposal.id} className={styles.proposalCardContainer} onMouseEnter={() => play('hover')}>
                              <ProposalCard
                                id={proposal.id}
                                title={proposal.title}
                                proposalMarkdown={proposal.proposalMarkdown}
                                status={proposal.status}
                                walletAddress={proposal.walletAddress}
                                createdAt={proposal.createdAt}
                                user={proposal.user}
                                review={proposal.review}
                                onViewDetails={handleViewDetails}
                                showAvatar={false}
                                onChainProposalId={proposal.review?.onChainProposalId ? parseInt(proposal.review.onChainProposalId) : null}
                                onChainData={proposal.onChainData || null}
                              />
                              {proposal.onChainTxHash && (
                                <div className={styles.onChainInfo}>
                                  <div className={styles.onChainBadge}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="currentColor"/>
                                      <path d="M3 17L12 22L21 17" fill="currentColor" fillOpacity="0.6"/>
                                      <path d="M3 12L12 17L21 12" fill="currentColor" fillOpacity="0.8"/>
                                    </svg>
                                    <span>Recorded Transparently</span>
                                  </div>
                                  <a href={`https://basescan.org/tx/${proposal.onChainTxHash}`} target="_blank" rel="noopener noreferrer" className={styles.txLink} onClick={() => play('navigation')} onMouseEnter={() => play('hover')}>
                                    View Transaction →
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </section>

            </div>
            </div>
          </div>
          </>
        </div>
      </main>
      </div>

      {selectedProposal && (
        <ProposalDetailsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProposalId(null);
          }}
          proposal={selectedProposal}
          onChainProposalId={selectedProposal.review?.onChainProposalId ? parseInt(selectedProposal.review.onChainProposalId) : null}
          contractAddress={CONTRACT_ADDRESS}
          onVoted={fetchProposals}
        />
      )}

      {isSubmitModalOpen && (
        <SubmitProposalModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onSuccess={fetchProposals}
        />
      )}

    </>
  );
}
