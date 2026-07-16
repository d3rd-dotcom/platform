'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { CheckCircle, Lock, CircleNotch } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import GuideSkillTree from '@/components/guides/GuideSkillTree';
import BlueDialogue from '@/components/blue-dialogue/BlueDialogue';
import type { Walkthrough, WalkthroughNode } from '@/lib/guides-db';
import styles from './GuideWalkthrough.module.css';

interface Props {
  slug: string;
}

interface RewardInfo {
  diamonds: number;
  levelCleared: boolean;
  walkthroughComplete: boolean;
  spinGranted: boolean;
}

/**
 * Compose Blue's completion-reward dialogue in her voice: upbeat, academic,
 * short, sweet, and no em dashes anywhere. Each element becomes one line
 * advanced with the arrow.
 */
function buildRewardLines(reward: RewardInfo): string[] {
  const lines: string[] = [];

  // Base line for every guide completion, naming the diamond payout.
  lines.push(
    `Nice work. That guide is logged and I just sent +${reward.diamonds} diamonds straight to your wallet. Small consistent wins, that is the whole game.`,
  );

  // Level-clear flavor (Figma sample copy, kept verbatim).
  if (reward.levelCleared && !reward.walkthroughComplete) {
    lines.push(
      "Hey, just because you got it right, doesn't make you a genius or anything. If you're ready to level-up and try something a bit harder we have the next level of knowledge on this topic unlocked and available for you.",
    );
  }

  // The big finish: the full walkthrough is done.
  if (reward.walkthroughComplete) {
    lines.push(
      `You cleared the entire walkthrough. That is a 500+ diamond payout landing in your wallet, and the whole topic tree is yours now. Go pick the next hard thing.`,
    );
  }

  if (reward.spinGranted) {
    lines.push(
      `One more thing. I tucked a little bonus on top of the payout. Ten extra diamonds, because finishing deserves a flourish.`,
    );
  }

  return lines;
}

export default function GuideWalkthrough({ slug }: Props) {
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const { play } = useSound();
  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'list' | 'tree'>('list');
  const [reward, setReward] = useState<RewardInfo | null>(null);

  // Tree is the default on wide screens; measured once on mount.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 900) {
      setView('tree');
    }
  }, []);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/guides/${slug}/walkthrough`, { cache: 'no-store', headers });
      if (!res.ok) {
        setError('Could not load the walkthrough.');
        return;
      }
      const data = await res.json();
      const wt: Walkthrough | null = data.walkthrough ?? null;
      setWalkthrough(wt);
      setCompleted(new Set((wt?.nodes ?? []).filter((n) => n.completed).map((n) => n.id)));
    } catch {
      setError('Could not load the walkthrough.');
    } finally {
      setLoading(false);
    }
  }, [slug, authHeaders]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  // Group nodes by computed level.
  const levels = useMemo(() => {
    const map = new Map<number, WalkthroughNode[]>();
    for (const n of walkthrough?.nodes ?? []) {
      const list = map.get(n.level);
      if (list) list.push(n);
      else map.set(n.level, [n]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [walkthrough]);

  const totalLevels = walkthrough?.levels ?? 0;

  // A level is unlocked when every guide in every lower level is completed.
  const isLevelUnlocked = useCallback(
    (level: number): boolean => {
      if (level === 0) return true;
      for (const [lvl, nodes] of levels) {
        if (lvl >= level) continue;
        if (!nodes.every((n) => completed.has(n.id))) return false;
      }
      return true;
    },
    [levels, completed],
  );

  // Current level = the lowest level not fully completed (1-indexed for display).
  const currentLevelIndex = useMemo(() => {
    for (const [lvl, nodes] of levels) {
      if (!nodes.every((n) => completed.has(n.id))) return lvl;
    }
    return totalLevels > 0 ? totalLevels - 1 : 0;
  }, [levels, completed, totalLevels]);

  const handleComplete = useCallback(
    async (node: WalkthroughNode) => {
      if (!authenticated) {
        login();
        return;
      }
      setCompleting(node.id);
      try {
        const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
        const res = await fetch('/api/guides/progress', {
          method: 'POST',
          headers,
          body: JSON.stringify({ guideId: node.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 409 = prerequisite gate rejection.
          play('error');
          setError(data.error ?? 'Could not complete this guide.');
          return;
        }
        setError(null);
        setCompleted((prev) => {
          const next = new Set(prev).add(node.id);
          // Celebration when this completion finishes every guide in the level;
          // otherwise a plain success chime.
          const siblings = (walkthrough?.nodes ?? []).filter((n) => n.level === node.level);
          const levelDone = siblings.length > 0 && siblings.every((n) => next.has(n.id));
          play(levelDone ? 'celebration' : 'success');
          return next;
        });
        // Diamond payout toast (additive fields from the progress API).
        if (typeof data.diamonds === 'number' && data.diamonds > 0) {
          setReward({
            diamonds: data.diamonds,
            levelCleared: Boolean(data.levelCleared),
            walkthroughComplete: Boolean(data.walkthroughComplete),
            spinGranted: Boolean(data.spinGranted),
          });
        }
      } finally {
        setCompleting(null);
      }
    },
    [authenticated, login, authHeaders, play, walkthrough],
  );

  if (loading) {
    return (
      <div className={styles.loading}>
        <CircleNotch size={20} className={styles.spinner} />
        <span>Loading walkthrough…</span>
      </div>
    );
  }

  if (!walkthrough || walkthrough.nodes.length === 0) {
    return <div className={styles.empty}>This guide has no prerequisites — start it directly.</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.progressHeader}>
        <span className={styles.progressLabel}>
          Level {Math.min(currentLevelIndex + 1, totalLevels)} of {totalLevels}
        </span>
        <div className={styles.viewToggle} role="tablist" aria-label="Walkthrough view">
          {(['tree', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`${styles.viewBtn} ${view === v ? styles.viewBtnActive : ''}`}
              onMouseEnter={() => play('soft-hover')}
              onClick={() => {
                if (view === v) return;
                play(v === 'tree' ? 'toggle-on' : 'toggle-off');
                setView(v);
              }}
            >
              {v === 'tree' ? 'Tree' : 'List'}
            </button>
          ))}
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${totalLevels ? (completed.size / walkthrough.nodes.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <BlueDialogue
        open={reward !== null}
        lines={reward ? buildRewardLines(reward) : []}
        onClose={() => setReward(null)}
      />

      {/* ── Reward preview summary ────────────────────────────────────── */}
      {authenticated && (
        <div className={styles.rewardSummary}>
          <span className={styles.rewardSummaryLabel}>Diamond rewards</span>
          <div className={styles.rewardSummaryTiers}>
            <span className={styles.rewardTier}>
              <Image src="/icons/ui-diamond.svg" alt="" width={12} height={12} className={styles.rewardIcon} />
              +{walkthrough.rewardPreview.guideComplete} per guide
            </span>
            <span className={styles.rewardDivider} />
            <span className={styles.rewardTier}>
              <Image src="/icons/ui-diamond.svg" alt="" width={12} height={12} className={styles.rewardIcon} />
              +{walkthrough.rewardPreview.levelClear} per level clear
            </span>
            <span className={styles.rewardDivider} />
            <span className={styles.rewardTier}>
              <Image src="/icons/ui-diamond.svg" alt="" width={12} height={12} className={styles.rewardIcon} />
              +{walkthrough.rewardPreview.walkthroughComplete} full clear
            </span>
            {walkthrough.rewardPreview.spinGranted && (
              <>
                <span className={styles.rewardDivider} />
                <span className={styles.rewardTier}>+free spin</span>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'tree' && (
        <GuideSkillTree
          nodes={walkthrough.nodes}
          levels={walkthrough.levels}
          targetId={walkthrough.targetId}
          completed={completed}
          currentSlug={slug}
        />
      )}

      <div className={styles.levels} style={view === 'tree' ? { display: 'none' } : undefined}>
        {levels.map(([level, nodes]) => {
          const unlocked = isLevelUnlocked(level);
          return (
            <section
              key={level}
              className={`${styles.level} ${unlocked ? '' : styles.levelLocked}`}
            >
              <header className={styles.levelHead}>
                <span className={styles.levelBadge}>Level {level + 1}</span>
                {authenticated && unlocked && (
                  <span className={styles.levelRewardBadge}>
                    <Image src="/icons/ui-diamond.svg" alt="" width={10} height={10} className={styles.levelRewardIcon} />
                    +{walkthrough.rewardPreview.levelClear}
                  </span>
                )}
                {!unlocked && (
                  <span className={styles.lockedTag}>
                    <Lock size={12} weight="bold" /> Locked
                  </span>
                )}
              </header>
              <div className={styles.nodeList}>
                {nodes.map((node) => {
                  const isDone = completed.has(node.id);
                  return (
                    <div
                      key={node.id}
                      className={`${styles.node} ${isDone ? styles.nodeDone : ''}`}
                      onMouseEnter={() => unlocked && play('soft-hover')}
                    >
                      <div className={styles.nodeMain}>
                        {isDone ? (
                          <CheckCircle size={18} weight="fill" className={styles.doneIcon} />
                        ) : (
                          <span className={styles.dot} />
                        )}
                        <Link
                          href={`/home/guides/${node.slug}`}
                          className={styles.nodeTitle}
                          onClick={() => play('click')}
                        >
                          {node.topicTitle}
                        </Link>
                      </div>
                      {unlocked ? (
                        <div className={styles.nodeActions}>
                          {authenticated && !isDone && (
                            <span className={styles.nodeRewardBadge}>
                              <Image src="/icons/ui-diamond.svg" alt="" width={10} height={10} className={styles.nodeRewardIcon} />
                              +{walkthrough.rewardPreview.guideComplete}
                            </span>
                          )}
                          <button
                            type="button"
                            className={`${styles.completeBtn} ${isDone ? styles.completeBtnDone : ''}`}
                            disabled={isDone || completing === node.id}
                            onMouseEnter={() => !isDone && play('soft-hover')}
                            onClick={() => handleComplete(node)}
                          >
                            {isDone
                              ? 'Completed'
                              : completing === node.id
                                ? 'Saving…'
                                : 'Mark complete'}
                          </button>
                        </div>
                      ) : (
                        <span className={styles.lockedHint}>
                          <Lock size={13} weight="bold" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
