'use client';

import { useMemo, useState } from 'react';
import * as api from '@/lib/simulation-api';
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
  const simId = wf.simulationId as string;
  const [maxRounds, setMaxRounds] = useState(10);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [status, setStatus] = useState<Record<string, unknown>>({});

  const start = async () => {
    setError(null);
    setStarted(true);
    setRunning(true);
    try {
      await api.startSimulation({
        simulation_id: simId,
        max_rounds: maxRounds,
        enable_graph_memory_update: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start simulation');
      setRunning(false);
    }
  };

  const stop = async () => {
    try {
      await api.stopSimulation({ simulation_id: simId });
    } catch {}
    setRunning(false);
  };

  usePolling(() => api.getRunStatusDetail(simId), {
    enabled: started && running,
    intervalMs: 2000,
    stop: (res) => {
      // Backend field is `runner_status` (not `status`).
      const s = (res.data?.runner_status as string) || '';
      return s === 'completed' || s === 'failed' || s === 'stopped';
    },
    onData: async (res) => {
      setStatus(res.data || {});
      // The detail endpoint already includes all_actions; fall back to a fetch.
      const inline = (res.data as { all_actions?: Action[] })?.all_actions;
      if (Array.isArray(inline) && inline.length) {
        setActions(inline);
      } else {
        try {
          const act = await api.getSimulationActions(simId, { limit: 200 });
          const raw = act.data as { actions?: Action[] } | Action[] | undefined;
          setActions(Array.isArray(raw) ? raw : raw?.actions ?? []);
        } catch {}
      }
      const s = (res.data?.runner_status as string) || '';
      if (s === 'completed' || s === 'failed' || s === 'stopped') {
        setRunning(false);
        if (s === 'failed') setError('Simulation failed');
      }
    },
  });

  const { plaza, community } = useMemo(() => {
    const sorted = [...actions].sort((a, b) => (a.round_num ?? 0) - (b.round_num ?? 0));
    return {
      plaza: sorted.filter((a) => a.platform === 'twitter'),
      community: sorted.filter((a) => a.platform !== 'twitter'),
    };
  }, [actions]);

  const completed = ['completed', 'stopped'].includes((status.runner_status as string) || '');

  return (
    <div className={styles.panel}>
      <div className={styles.simHeader}>
        <div>
          <h2 className={styles.panelTitle}>Simulation</h2>
          <p className={styles.panelLead}>
            The world is live. Agents post, react, and influence each other across two spaces.
          </p>
        </div>
        <div className={styles.simControls}>
          {!started && (
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
              <button className={styles.primaryBtn} onClick={start}>
                Start
              </button>
            </>
          )}
          {running && (
            <button className={styles.secondaryBtn} onClick={stop}>
              Stop
            </button>
          )}
          {completed && (
            <button className={styles.primaryBtn} onClick={onDone}>
              Generate report →
            </button>
          )}
        </div>
      </div>

      {started && (
        <div className={styles.runStats}>
          <Stat label="Status" value={(status.runner_status as string) || 'starting'} />
          <Stat
            label="Round"
            value={`${status.current_round ?? status.reddit_current_round ?? 0}/${status.total_rounds ?? maxRounds}`}
          />
          <Stat label="Events" value={String(actions.length)} />
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.spaces}>
        <Feed title="Info Plaza" subtitle="fast, public broadcast" actions={plaza} empty={started} />
        <Feed title="Topic Community" subtitle="threaded discussion" actions={community} empty={started} />
      </div>
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
