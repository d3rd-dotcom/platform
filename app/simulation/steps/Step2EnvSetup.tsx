'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { AgentProfile } from '@/lib/simulation-api';
import { usePolling } from '../usePolling';
import type { WorkflowState } from '../SimulationWorkspace';
import AgentAvatar from '../AgentAvatar';
import styles from '../simulation.module.css';

export default function Step2EnvSetup({
  wf,
  onReady,
}: {
  wf: WorkflowState;
  onReady: (simulationId: string) => void;
}) {
  const [simId, setSimId] = useState<string | null>(wf.simulationId);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [count, setCount] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const ensuring = useRef(false);

  // Ensure a simulation exists for this project.
  useEffect(() => {
    if (simId || ensuring.current) return;
    ensuring.current = true;
    (async () => {
      try {
        const res = await api.createSimulation({
          project_id: wf.project.project_id,
          graph_id: wf.graphId || undefined,
          enable_reddit: true,
          enable_twitter: true,
        });
        setSimId(res.data?.simulation_id ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create simulation');
      } finally {
        ensuring.current = false;
      }
    })();
  }, [simId, wf.project.project_id, wf.graphId]);

  // Load any already-generated profiles.
  useEffect(() => {
    if (!simId) return;
    api
      .getSimulationProfiles(simId, 'reddit')
      .then((res) => {
        const list = res.data?.profiles ?? [];
        if (list.length) {
          setProfiles(list);
          setPrepared(true);
        }
      })
      .catch(() => {});
  }, [simId]);

  const prepare = async () => {
    if (!simId) return;
    setError(null);
    setPreparing(true);
    setProfiles([]);
    try {
      const res = await api.prepareSimulation({
        simulation_id: simId,
        use_llm_for_profiles: true,
        parallel_profile_count: count,
      });
      setTaskId(res.data?.task_id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare world');
      setPreparing(false);
    }
  };

  // Poll prepare status + stream profiles in as they generate.
  usePolling(() => api.getPrepareStatus({ task_id: taskId || undefined, simulation_id: simId || undefined }), {
    enabled: !!simId && preparing && !prepared,
    intervalMs: 2500,
    stop: (res) => res.data?.status === 'completed' || res.data?.status === 'failed',
    onData: async (res) => {
      const st = res.data?.status;
      if (simId) {
        try {
          const p = await api.getSimulationProfilesRealtime(simId, 'reddit');
          if (p.data?.profiles?.length) setProfiles(p.data.profiles);
        } catch {}
      }
      if (st === 'failed') {
        setError(res.data?.error || 'World preparation failed');
        setPreparing(false);
      } else if (st === 'completed') {
        setPrepared(true);
        setPreparing(false);
        if (simId) {
          const p = await api.getSimulationProfiles(simId, 'reddit');
          if (p.data?.profiles?.length) setProfiles(p.data.profiles);
        }
      }
    },
  });

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>World setup</h2>
      <p className={styles.panelLead}>
        Generate the population. Each agent gets a persona, a backstory, and long-term memory drawn
        from the knowledge graph.
      </p>

      {!prepared && (
        <div className={styles.setupControls}>
          <label className={styles.field}>
            <span>Number of agents</span>
            <input
              type="number"
              min={5}
              max={200}
              className={styles.input}
              value={count}
              onChange={(e) => setCount(Math.max(5, Math.min(200, Number(e.target.value) || 5)))}
              disabled={preparing}
            />
          </label>
          <button className={styles.primaryBtn} onClick={prepare} disabled={!simId || preparing}>
            {preparing ? 'Generating agents…' : 'Generate population'}
          </button>
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      {profiles.length > 0 && (
        <>
          <div className={styles.profileHeaderRow}>
            <h4 className={styles.subhead}>
              Population {preparing ? `(generating… ${profiles.length})` : `(${profiles.length})`}
            </h4>
          </div>
          <div className={styles.profileGrid}>
            {profiles.map((p, i) => {
              const aid = p.user_id ?? p.agent_id ?? i;
              return (
                <div key={aid} className={styles.profileCard}>
                  <AgentAvatar id={aid} size={40} />
                  <div className={styles.profileText}>
                    <span className={styles.profileName}>{p.name || p.username || `Agent ${aid}`}</span>
                    <span className={styles.profileBio}>{p.bio || p.persona || p.description || ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {prepared && (
        <div className={styles.actionRow}>
          <button className={styles.primaryBtn} onClick={() => simId && onReady(simId)}>
            Run the simulation →
          </button>
        </div>
      )}
    </div>
  );
}
