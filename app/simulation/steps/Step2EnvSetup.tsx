'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DotmSquare3 } from '@/components/dot-matrix/DotmSquare3';
import Button from '@/components/button/Button';
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

  const completePreparation = useCallback(async (targetSimId: string | null = simId) => {
    setPrepared(true);
    setPreparing(false);
    setTaskId(null);
    if (requestedPreparation.current) {
      requestedPreparation.current = false;
      play('success');
    }
    if (!targetSimId) return;
    try {
      const response = await api.getSimulationProfiles(targetSimId, 'reddit');
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

  const generatePopulation = async (targetSimId: string) => {
    setError(null);
    setPreparing(true);
    setProfiles([]);
    try {
      const res = await api.prepareSimulation({
        simulation_id: targetSimId,
        use_llm_for_profiles: true,
        agent_count: count,
      });
      if (
        res.data?.already_prepared ||
        res.data?.status === 'ready' ||
        res.data?.status === 'completed'
      ) {
        await completePreparation(targetSimId);
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

  const prepare = () => {
    if (!simId) return;
    play('click');
    requestedPreparation.current = true;
    void generatePopulation(simId);
  };

  const regenerate = async () => {
    if (!wf.graphId) return;
    const confirmed = window.confirm(
      'Generate a replacement population from the current graph? Existing simulation results and reports will remain unchanged.',
    );
    if (!confirmed) return;

    play('click');
    const existingProfiles = profiles;
    requestedPreparation.current = true;
    setPrepared(false);
    setError(null);
    setProfiles([]);
    try {
      const res = await api.createSimulation({
        project_id: wf.project.project_id,
        graph_id: wf.graphId,
        enable_reddit: true,
        enable_twitter: true,
      });
      const id = res.data?.simulation_id;
      if (!id) throw new Error('No replacement simulation id returned');
      setSimId(id);
      onSimulationId(id);
      await generatePopulation(id);
    } catch (e) {
      requestedPreparation.current = false;
      play('error');
      setPrepared(true);
      setProfiles(existingProfiles);
      setError(e instanceof Error ? e.message : 'Failed to regenerate population');
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
        Generate one agent for each eligible entity found in the knowledge graph, up to your
        selected maximum. Each agent receives a persona and graph-based memory.
      </p>

      {!prepared && (
        <div className={styles.setupControls}>
          <label className={styles.field}>
            <span>Maximum agents</span>
            <input
              type="number"
              min={5}
              max={200}
              className={styles.input}
              value={count}
              onChange={(e) => setCount(Math.max(5, Math.min(200, Number(e.target.value) || 5)))}
              disabled={preparing}
            />
            <small className={styles.fieldHint}>
              Your graph may contain fewer eligible entities than this maximum.
            </small>
          </label>
          <Button
            onClick={prepare}
            onMouseEnter={() => play('hover')}
            disabled={!simId || preparing || checkingPreparation}
          >
            {checkingPreparation
              ? 'Checking status...'
              : preparing
                ? 'Generating agents...'
                : 'Generate population'}
          </Button>
          {preparing && (
            <span className={styles.loaderInline} aria-hidden>
              <DotmSquare3 speed={0.9} dotSize={4} gap={3} />
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
                <DotmSquare3 speed={0.9} dotSize={4} gap={3} />
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
        <>
          <section className={styles.regenerationBox} aria-label="Regenerate generated population">
            <h3 className={styles.enrichmentTitle}>Incorrect population?</h3>
            <p className={styles.enrichmentLead}>
              Generate replacement agents from the current graph. Existing runs and reports stay
              unchanged.
            </p>
            <div className={styles.setupControls}>
              <label className={styles.field}>
                <span>Maximum agents</span>
                <input
                  type="number"
                  min={5}
                  max={200}
                  className={styles.input}
                  value={count}
                  onChange={(e) => setCount(Math.max(5, Math.min(200, Number(e.target.value) || 5)))}
                  disabled={preparing}
                />
                <small className={styles.fieldHint}>
                  Your graph may contain fewer eligible entities than this maximum.
                </small>
              </label>
              <button
                className={styles.secondaryBtn}
                onClick={regenerate}
                onMouseEnter={() => play('hover')}
                disabled={preparing}
              >
                Regenerate population
              </button>
            </div>
          </section>
          <div className={styles.actionRow}>
            <Button
              onClick={() => {
                if (simId) {
                  play('navigation');
                  onReady(simId);
                }
              }}
              onMouseEnter={() => play('hover')}
            >
              Run the simulation →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
