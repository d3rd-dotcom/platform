'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { RunStatus } from '@/lib/simulation-api';
import Button from '@/components/button/Button';
import { useSound } from '@/hooks/useSound';
import { usePolling } from '../usePolling';
import type { WorkflowState } from '../SimulationWorkspace';
import AgentAvatar from '../AgentAvatar';
import styles from '../simulation.module.css';

interface Action {
  id?: string | number;
  agent_id: string | number;
  agent_name?: string;
  action_type?: string;
  action_args?: Record<string, unknown> | string;
  platform?: 'twitter' | 'reddit' | string;
  round_num?: number;
  timestamp?: string | number;
}

type RunDetail = RunStatus & { all_actions?: Action[] };

const ACTION_LABELS: Record<string, string> = {
  CREATE_POST: 'posted',
  CREATE_COMMENT: 'commented',
  QUOTE_POST: 'quoted',
  REPOST: 'reposted',
  LIKE_POST: 'liked a post',
  DISLIKE_POST: 'disliked a post',
  LIKE_COMMENT: 'liked a comment',
  DISLIKE_COMMENT: 'disliked a comment',
  FOLLOW: 'followed someone',
  MUTE: 'muted someone',
  SEARCH_POSTS: 'searched posts',
  SEARCH_USER: 'searched users',
  TREND: 'checked trends',
  REFRESH: 'refreshed the feed',
  DO_NOTHING: 'stayed idle',
};

function actionText(a: Action): string {
  const args = a.action_args;
  if (!args) return '';
  if (typeof args === 'string') return args;
  for (const key of ['content', 'text', 'post_content', 'comment_content', 'message']) {
    const v = args[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

export default function Step3Simulation({
  wf,
  onDone,
}: {
  wf: WorkflowState;
  onDone: () => void;
}) {
  const { play } = useSound();
  const simId = wf.simulationId as string;
  const [maxRounds, setMaxRounds] = useState(10);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [status, setStatus] = useState<RunDetail>({});
  const [loadingRun, setLoadingRun] = useState(true);
  const previousRunnerStatus = useRef<string | undefined>();

  const applyRunStatus = useCallback((detail: RunDetail | undefined) => {
    const next = detail ?? {};
    const runnerStatus = next.runner_status ?? 'idle';
    const previous = previousRunnerStatus.current;
    previousRunnerStatus.current = runnerStatus;
    setStatus(next);
    setStarted(runnerStatus !== 'idle' && runnerStatus !== 'failed');
    setRunning(['starting', 'running', 'stopping'].includes(runnerStatus));
    if (Array.isArray(next.all_actions)) {
      setActions(next.all_actions);
    }
    if (runnerStatus === 'failed') {
      if (previous && previous !== 'failed') play('error');
      setError(next.error?.trim() || 'Simulation failed');
    } else {
      if (runnerStatus === 'completed' && previous && previous !== 'completed') play('success');
      setError(null);
    }
    // Stale error field from a prior run can coexist with completed status.
    // Always clear it for terminal states.
    if (['completed', 'stopped', 'idle'].includes(runnerStatus)) {
      setError(null);
    }
  }, [play]);

  useEffect(() => {
    let active = true;
    setLoadingRun(true);
    api
      .getRunStatusDetail(simId)
      .then((res) => {
        if (active) applyRunStatus(res.data as RunDetail | undefined);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load simulation state');
      })
      .finally(() => {
        if (active) setLoadingRun(false);
      });
    return () => {
      active = false;
    };
  }, [simId, applyRunStatus]);

  const start = async () => {
    play('click');
    setError(null);
    setStarted(true);
    setRunning(true);
    setStatus({ runner_status: 'starting' });
    try {
      await api.startSimulation({
        simulation_id: simId,
        max_rounds: maxRounds,
        enable_graph_memory_update: true,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start simulation';
      try {
        const current = await api.getRunStatusDetail(simId);
        const detail = current.data as RunDetail | undefined;
        if ((detail?.runner_status ?? 'idle') !== 'idle') {
          applyRunStatus(detail);
          return;
        }
      } catch {
        // Fall through and restore the start controls when state cannot be resumed.
      }
      setError(message);
      play('error');
      setStarted(false);
      setRunning(false);
      setStatus({});
    }
  };

  const stop = async () => {
    play('click');
    try {
      await api.stopSimulation({ simulation_id: simId });
      const current = await api.getRunStatusDetail(simId);
      applyRunStatus(current.data as RunDetail | undefined);
    } catch {
      play('error');
      setRunning(false);
    }
  };

  usePolling(() => api.getRunStatusDetail(simId), {
    enabled: started && running,
    intervalMs: 2000,
    stop: (res) => {
      // Backend field is `runner_status` (not `status`).
      const s = res.data?.runner_status || '';
      return s === 'completed' || s === 'failed' || s === 'stopped';
    },
    onData: (res) => {
      applyRunStatus(res.data as RunDetail | undefined);
    },
  });

  const { plaza, community } = useMemo(() => {
    const sorted = [...actions].sort((a, b) => (a.round_num ?? 0) - (b.round_num ?? 0));
    return {
      plaza: sorted.filter((a) => a.platform === 'twitter'),
      community: sorted.filter((a) => a.platform !== 'twitter'),
    };
  }, [actions]);

  const completed = ['completed', 'stopped'].includes(status.runner_status || '');
  const [mirrorTab, setMirrorTab] = useState<'1' | '2'>('1');

  return (
    <div className={styles.panel}>
      <div className={styles.simHeader}>
        <div>
          <h2 className={styles.panelTitle}>Simulation</h2>
          <p className={styles.panelLead}>
            The same agents participate in both channels: public broadcasts in Info Plaza and
            threaded discussion in Topic Community.
          </p>
        </div>
        <div className={styles.simControls}>
          {loadingRun && <span className={styles.muted}>Loading run...</span>}
          {!loadingRun && !started && (
            <>
              <label className={styles.inlineField}>
                <span>Rounds</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className={styles.inputSmall}
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                />
              </label>
              <Button size="compact" onClick={start} onMouseEnter={() => play('hover')}>
                Start
              </Button>
            </>
          )}
          {running && (
            <button className={styles.secondaryBtn} onClick={stop} onMouseEnter={() => play('hover')}>
              Stop
            </button>
          )}
          {completed && (
            <Button
              onClick={() => {
                play('navigation');
                onDone();
              }}
              onMouseEnter={() => play('hover')}
            >
              Generate report →
            </Button>
          )}
        </div>
      </div>

      {started && (
        <div className={styles.runStats}>
          <Stat label="Status" value={status.runner_status || 'starting'} />
          <Stat
            label="Round"
            value={`${status.current_round ?? status.reddit_current_round ?? 0}/${status.total_rounds ?? maxRounds}`}
          />
          <Stat label="Events" value={String(actions.length)} />
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.modeToggle} role="tablist" aria-label="Feed mirror">
        <button
          type="button"
          role="tab"
          aria-selected={mirrorTab === '1'}
          className={`${styles.modeBtn} ${mirrorTab === '1' ? styles.modeBtnActive : ''}`}
          onClick={() => { play('click'); setMirrorTab('1'); }}
          onMouseEnter={() => play('hover')}
        >
          Mirror 1
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mirrorTab === '2'}
          className={`${styles.modeBtn} ${mirrorTab === '2' ? styles.modeBtnActive : ''}`}
          onClick={() => { play('click'); setMirrorTab('2'); }}
          onMouseEnter={() => play('hover')}
        >
          Mirror 2
        </button>
      </div>
      {mirrorTab === '1' && (
        <Feed title="Mirror 1" subtitle="same agents, public broadcast" actions={plaza} empty={started} />
      )}
      {mirrorTab === '2' && (
        <Feed title="Mirror 2" subtitle="same agents, threaded discussion" actions={community} empty={started} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

function Feed({
  title,
  subtitle,
  actions,
  empty,
}: {
  title: string;
  subtitle: string;
  actions: Action[];
  empty: boolean;
}) {
  return (
    <div className={styles.feed}>
      <div className={styles.feedHead}>
        <h4 className={styles.feedTitle}>{title}</h4>
        <span className={styles.feedSub}>{subtitle}</span>
      </div>
      <div className={styles.feedBody}>
        {actions.length === 0 && (
          <p className={styles.muted}>{empty ? 'Waiting for activity…' : 'Start the simulation to populate this space.'}</p>
        )}
        {actions.map((a, i) => {
          const text = actionText(a);
          const label = ACTION_LABELS[a.action_type || ''] || (a.action_type || 'acted').toLowerCase();
          return (
            <div key={a.id ?? `${a.agent_id}-${i}`} className={styles.actionCard}>
              <AgentAvatar id={a.agent_id} size={34} />
              <div className={styles.actionMain}>
                <div className={styles.actionMeta}>
                  <span className={styles.actionAgent}>{a.agent_name || `Agent ${a.agent_id}`}</span>
                  <span className={styles.actionVerb}>{label}</span>
                  {a.round_num != null && <span className={styles.actionRound}>round {a.round_num}</span>}
                </div>
                {text && <p className={styles.actionContent}>{text}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
