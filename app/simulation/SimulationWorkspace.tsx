'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { GraphData, Project } from '@/lib/simulation-api';
import { useSound } from '@/hooks/useSound';
import styles from './simulation.module.css';
import ProjectGallery from './steps/ProjectGallery';
import Step1GraphBuild from './steps/Step1GraphBuild';
import Step2EnvSetup from './steps/Step2EnvSetup';
import Step3Simulation from './steps/Step3Simulation';
import Step4Report from './steps/Step4Report';
import Step5Interaction from './steps/Step5Interaction';
import GraphPanel from './GraphPanel';

export interface WorkflowState {
  project: Project;
  graphId: string | null;
  simulationId: string | null;
  simulationReady: boolean;
  reportId: string | null;
}

const STEPS = [
  { n: 1, label: 'Knowledge' },
  { n: 2, label: 'Setup' },
  { n: 3, label: 'Simulation' },
  { n: 4, label: 'Report' },
  { n: 5, label: 'Interaction' },
];

function hasCompletedGraph(project: Project) {
  return Boolean(project.graph_id) &&
    (project.status === 'graph_completed' || project.status === 'graph_built');
}
export default function SimulationWorkspace() {
  const { play } = useSound();
  const [wf, setWf] = useState<WorkflowState | null>(null);
  const [step, setStep] = useState(1);
  const [viewMode, setViewMode] = useState<'graph' | 'split' | 'workspace'>('split');
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    api.checkHealth().then(setOnline);
  }, []);

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1180px)');
    const keepControlsVisible = () => {
      if (compact.matches) {
        setViewMode((current) => (current === 'split' ? 'workspace' : current));
      }
    };
    keepControlsVisible();
    compact.addEventListener('change', keepControlsVisible);
    return () => compact.removeEventListener('change', keepControlsVisible);
  }, []);

  const loadGraph = useCallback(async (graphId: string) => {
    try {
      const res = await api.getGraphData(graphId);
      setGraph(res.data ?? null);
    } catch {
      setGraph(null);
    }
  }, []);

  const openProject = useCallback(
    async (project: Project) => {
      // A graph id is allocated before graph extraction finishes. Do not open
      // later steps until the project says that graph is usable.
      const graphId = hasCompletedGraph(project) ? project.graph_id || null : null;
      // find an existing simulation for this project, if any
      let simulationId: string | null = null;
      let resumeRun = false;
      try {
        const sims = await api.listSimulations(project.project_id);
        const simulation = [...(sims.data ?? [])]
          .filter(
            (candidate) =>
              (!graphId || candidate.graph_id === graphId) &&
              (!project.updated_at ||
                !candidate.created_at ||
                candidate.created_at >= project.updated_at),
          )
          .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0];
        simulationId = simulation?.simulation_id ?? null;
        if (simulationId) {
          const run = await api.getRunStatusDetail(simulationId);
          const runnerStatus = run.data?.runner_status ?? 'idle';
          resumeRun = ['starting', 'running', 'stopping'].includes(runnerStatus);
        }
      } catch {
        /* ignore */
      }
      setWf({ project, graphId, simulationId, simulationReady: !!simulationId, reportId: null });
      setGraph(null);
      if (graphId) {
        loadGraph(graphId);
        if (!simulationId) {
          setStep(2);
        } else if (resumeRun) {
          setStep(3);
        } else {
          setStep(4);
        }
      } else {
        setStep(1);
      }
    },
    [loadGraph],
  );

  const patch = useCallback((p: Partial<WorkflowState>) => {
    setWf((prev) => (prev ? { ...prev, ...p } : prev));
  }, []);

  const exit = useCallback(() => {
    play('navigation');
    setWf(null);
    setGraph(null);
    setStep(1);
  }, [play]);

  if (!wf) {
    return (
      <ProjectGallery online={online} onOpen={openProject} />
    );
  }

  const canVisit = (n: number) => {
    if (n === 1) return true;
    if (n >= 2 && !wf.graphId) return false;
    if (n >= 3 && (!wf.simulationId || !wf.simulationReady)) return false;
    return true;
  };

  return (
    <div className={styles.workflow}>
      <div className={styles.workflowHeader}>
        <button className={styles.backLink} onClick={exit} onMouseEnter={() => play('hover')}>
          ← All worlds
        </button>
        <div className={styles.viewModeToggle} role="tablist" aria-label="Simulation layout mode">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'graph'}
            className={`${styles.viewModeBtn} ${viewMode === 'graph' ? styles.viewModeBtnActive : ''}`}
            onClick={() => {
              play('click');
              setViewMode('graph');
            }}
            onMouseEnter={() => play('hover')}
          >
            Graph
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'split'}
            className={`${styles.viewModeBtn} ${viewMode === 'split' ? styles.viewModeBtnActive : ''}`}
            onClick={() => {
              play('click');
              setViewMode('split');
            }}
            onMouseEnter={() => play('hover')}
          >
            Split
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'workspace'}
            className={`${styles.viewModeBtn} ${viewMode === 'workspace' ? styles.viewModeBtnActive : ''}`}
            onClick={() => {
              play('click');
              setViewMode('workspace');
            }}
            onMouseEnter={() => play('hover')}
          >
            Workspace
          </button>
        </div>
        <div className={styles.workflowHeaderSpacer} aria-hidden />
      </div>

      <div
        className={`${styles.workflowBody} ${
          viewMode === 'graph'
            ? styles.workflowBodyGraphOnly
            : viewMode === 'workspace'
              ? styles.workflowBodyWorkspaceOnly
              : ''
        }`}
      >
        <section className={styles.graphColumn} aria-label="Knowledge graph canvas">
          <div className={styles.graphCard}>
            <GraphPanel
              graph={graph}
              worldName={wf.project.name}
              projectId={wf.project.project_id}
              onGraphData={(nextGraph) => {
                setGraph(nextGraph);
                patch({ simulationId: null, simulationReady: false, reportId: null });
                setStep(1);
              }}
            />
          </div>
        </section>

        <aside className={styles.stepColumn} aria-label="Simulation workflow controls">
          <ol className={`${styles.stepper} ${styles.stepperRail}`}>
            {STEPS.map((s) => {
              const reachable = canVisit(s.n);
              return (
                <li key={s.n}>
                  <button
                    className={`${styles.stepChip} ${step === s.n ? styles.stepChipActive : ''}`}
                    disabled={!reachable}
                    onClick={() => {
                      if (reachable) {
                        play('navigation');
                        setStep(s.n);
                      }
                    }}
                    onMouseEnter={() => reachable && play('hover')}
                  >
                    <span className={styles.stepNum}>{s.n}</span>
                    <span>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {step === 1 && (
            <Step1GraphBuild
              wf={wf}
              onRebuildStart={() => {
                setGraph(null);
                patch({ graphId: null, simulationId: null, simulationReady: false, reportId: null });
              }}
              onGraph={(graphId) => {
                patch({ graphId, simulationId: null, simulationReady: false, reportId: null });
                loadGraph(graphId);
                setStep(2);
              }}
              onGraphData={(nextGraph) => {
                setGraph(nextGraph);
                patch({ simulationId: null, simulationReady: false, reportId: null });
              }}
            />
          )}
          {step === 2 && (
            <Step2EnvSetup
              wf={wf}
              onSimulationId={(simulationId) =>
                patch({ simulationId, simulationReady: false, reportId: null })
              }
              onReady={(simulationId) => {
                patch({ simulationId, simulationReady: true });
                setStep(3);
              }}
            />
          )}
          {step === 3 && (
            <Step3Simulation wf={wf} onDone={() => setStep(4)} />
          )}
          {step === 4 && (
            <Step4Report
              wf={wf}
              onReportId={(reportId) => patch({ reportId })}
              onDone={() => setStep(5)}
            />
          )}
          {step === 5 && <Step5Interaction wf={wf} />}
        </aside>
      </div>
    </div>
  );
}
