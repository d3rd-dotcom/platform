'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DotmSquare15 } from '@/components/dot-matrix/DotmSquare15';
import * as api from '@/lib/simulation-api';
import type { AgentProfile } from '@/lib/simulation-api';
import { useSound } from '@/hooks/useSound';
import { usePolling } from '../usePolling';
import type { WorkflowState } from '../SimulationWorkspace';
import AgentAvatar from '../AgentAvatar';
import styles from '../simulation.module.css';

export default function Step2EnvSetup({
  wf,
  onSimulationId,
  onReady,
}: {
  wf: WorkflowState;
  onSimulationId: (simulationId: string) => void;
  onReady: (simulationId: string) => void;
}) {
  const { play } = useSound();
  const [simId, setSimId] = useState<string | null>(wf.simulationId);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [checkingPreparation, setCheckingPreparation] = useState(Boolean(wf.simulationId));
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [count, setCount] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const ensuring = useRef(false);
  const requestedPreparation = useRef(false);

  const completePreparation = useCallback(async () => {
    setPrepared(true);
    setPreparing(false);
    setTaskId(null);
    if (requestedPreparation.current) {
      requestedPreparation.current = false;
      play('success');
    }
    if (!simId) return;
    try {
      const response = await api.getSimulationProfiles(simId, 'reddit');
      setProfiles(response.data?.profiles ?? []);
    } catch {
      /* The setup is ready even if profile rendering fails temporarily. */
    }
  }, [play, simId]);

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
        const id = res.data?.simulation_id ?? null;
        setCheckingPreparation(Boolean(id));
        setSimId(id);
        if (id) onSimulationId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create simulation');
      } finally {
        ensuring.current = false;
      }
    })();
  }, [simId, wf.project.project_id, wf.graphId, onSimulationId]);

  // Restore preparation status when a world is reopened or a user visits another step.
  useEffect(() => {
    if (!simId) return;
    let active = true;
    setCheckingPreparation(true);
    (async () => {
      try {
        const [simulation, preparation] = await Promise.all([
          api.getSimulation(simId),
          api.getPrepareStatus({ simulation_id: simId }),
        ]);
        if (!active) return;
        const status = preparation.data?.status;
        if (
          preparation.data?.already_prepared ||
          status === 'ready' ||
          status === 'completed'
        ) {
          await completePreparation();
        } else if (simulation.data?.status === 'preparing') {
          setPreparing(true);
          const partial = await api.getSimulationProfilesRealtime(simId, 'reddit').catch(() => null);
          if (active && partial?.data?.profiles?.length) {
            setProfiles(partial.data.profiles);
          }
        } else if (simulation.data?.status === 'failed') {
          setError('World preparation failed');
        }
      } catch {
        /* A newly created simulation may not have preparation data yet. */
      } finally {
        if (active) setCheckingPreparation(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [simId, completePreparation]);

  const prepare = async () => {
    if (!simId) return;
    play('click');
    requestedPreparation.current = true;
    setError(null);
    setPreparing(true);
    setProfiles([]);
    try {
      const res = await api.prepareSimulation({
        simulation_id: simId,
        use_llm_for_profiles: true,
        agent_count: count,
      });
      if (
        res.data?.already_prepared ||
        res.data?.status === 'ready' ||
        res.data?.status === 'completed'
      ) {
        await completePreparation();
        return;
      }
      const nextTaskId = res.data?.task_id;
      if (!nextTaskId) throw new Error('World preparation did not return a task id.');
      setTaskId(nextTaskId);
    } catch (e) {
      requestedPreparation.current = false;
      play('error');
      setError(e instanceof Error ? e.message : 'Failed to prepare world');
      setPreparing(false);
    }
  };

  // Poll prepare status + stream profiles in as they generate.
  usePolling(() => api.getPrepareStatus({ task_id: taskId || undefined, simulation_id: simId || undefined }), {
    enabled: !!simId && preparing && !prepared,
    intervalMs: 2500,
    stop: (res) =>
      res.data?.status === 'ready' ||
      res.data?.status === 'completed' ||
      res.data?.status === 'failed' ||
      Boolean(res.data?.already_prepared),
    onData: async (res) => {
      const st = res.data?.status;
      if (st === 'ready' || st === 'completed' || res.data?.already_prepared) {
        await completePreparation();
        return;
      }
      if (simId) {
        try {
          const p = await api.getSimulationProfilesRealtime(simId, 'reddit');
          if (p.data?.profiles?.length) setProfiles(p.data.profiles);
        } catch {}
      }
      if (st === 'failed') {
        requestedPreparation.current = false;
        play('error');
        setError(res.data?.error || 'World preparation failed');
        setPreparing(false);
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
          <button
            className={styles.primaryBtn}
            onClick={prepare}
            onMouseEnter={() => play('hover')}
            disabled={!simId || preparing || checkingPreparation}
          >
            {checkingPreparation
              ? 'Checking status...'
              : preparing
                ? 'Generating agents...'
                : 'Generate population'}
          </button>
          {preparing && (
            <span className={styles.loaderInline} aria-hidden>
              <DotmSquare15 speed={0.9} dotSize={4} gap={3} />
            </span>
          )}
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      {profiles.length > 0 && (
        <>
          <div className={styles.profileHeaderRow}>
            <h4 className={styles.subhead}>
              Population {preparing ? `(generating… ${profiles.length})` : `(${profiles.length})`}
            </h4>
            {preparing && (
              <span className={styles.loaderInline} aria-hidden>
                <DotmSquare15 speed={0.9} dotSize={4} gap={3} />
              </span>
            )}
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
          <button
            className={styles.primaryBtn}
            onClick={() => {
              if (simId) {
                play('navigation');
                onReady(simId);
              }
            }}
            onMouseEnter={() => play('hover')}
          >
            Run the simulation →
          </button>
        </div>
      )}
    </div>
  );
}
