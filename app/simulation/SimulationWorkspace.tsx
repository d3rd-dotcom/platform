'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { GraphData, Project } from '@/lib/simulation-api';
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
  reportId: string | null;
}

const STEPS = [
  { n: 1, label: 'Knowledge graph' },
  { n: 2, label: 'World setup' },
  { n: 3, label: 'Simulation' },
  { n: 4, label: 'Report' },
  { n: 5, label: 'Interaction' },
];

export default function SimulationWorkspace() {
  const [wf, setWf] = useState<WorkflowState | null>(null);
  const [step, setStep] = useState(1);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    api.checkHealth().then(setOnline);
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
      const graphId = project.graph_id || null;
      // find an existing simulation for this project, if any
      let simulationId: string | null = null;
      try {
        const sims = await api.listSimulations(project.project_id);
        simulationId = sims.data?.[0]?.simulation_id ?? null;
      } catch {
        /* ignore */
      }
      setWf({ project, graphId, simulationId, reportId: null });
      setGraph(null);
      if (graphId) {
        loadGraph(graphId);
        setStep(simulationId ? 2 : 2);
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
    setWf(null);
    setGraph(null);
    setStep(1);
  }, []);

  if (!wf) {
    return (
      <ProjectGallery online={online} onOpen={openProject} />
    );
  }

  const canVisit = (n: number) => {
    if (n === 1) return true;
    if (n >= 2 && !wf.graphId) return false;
    if (n >= 3 && !wf.simulationId) return false;
    return true;
  };

  return (
    <div className={styles.workflow}>
      <div className={styles.workflowHeader}>
        <button className={styles.backLink} onClick={exit}>
          ← All worlds
        </button>
      </div>

      <div className={styles.workflowBody}>
        <section className={styles.graphColumn} aria-label="Knowledge graph canvas">
          <div className={styles.graphCard}>
            <GraphPanel graph={graph} worldName={wf.project.name} />
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
                    onClick={() => reachable && setStep(s.n)}
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
              onGraph={(graphId) => {
                patch({ graphId });
                loadGraph(graphId);
                setStep(2);
              }}
              onGraphData={setGraph}
            />
          )}
          {step === 2 && (
            <Step2EnvSetup
              wf={wf}
              onReady={(simulationId) => {
                patch({ simulationId });
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
