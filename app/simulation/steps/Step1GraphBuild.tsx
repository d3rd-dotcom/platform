'use client';

import { useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { GraphData } from '@/lib/simulation-api';
import { usePolling } from '../usePolling';
import type { WorkflowState } from '../SimulationWorkspace';
import styles from '../simulation.module.css';

export default function Step1GraphBuild({
  wf,
  onGraph,
  onGraphData,
}: {
  wf: WorkflowState;
  onGraph: (graphId: string) => void;
  onGraphData: (g: GraphData) => void;
}) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ontology = wf.project.ontology;
  const alreadyBuilt = !!wf.graphId;

  const start = async () => {
    setError(null);
    setBuilding(true);
    try {
      const res = await api.buildGraph({ project_id: wf.project.project_id });
      setTaskId(res.data?.task_id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start graph build');
      setBuilding(false);
    }
  };

  usePolling(() => api.getGraphTaskStatus(taskId as string), {
    enabled: !!taskId && !done,
    intervalMs: 2500,
    stop: (res) => res.data?.status === 'completed' || res.data?.status === 'failed',
    onData: async (res) => {
      const st = res.data?.status;
      if (st === 'failed') {
        setError(res.data?.error || 'Graph build failed');
        setBuilding(false);
        setTaskId(null);
      } else if (st === 'completed') {
        setDone(true);
        setBuilding(false);
        try {
          const proj = await api.getProject(wf.project.project_id);
          const graphId = proj.data?.graph_id;
          if (graphId) {
            const g = await api.getGraphData(graphId);
            if (g.data) onGraphData(g.data);
            onGraph(graphId);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Graph built but could not be loaded');
        }
      }
    },
  });

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Knowledge graph</h2>
      <p className={styles.panelLead}>
        We analyzed your documents and proposed the entities and relationships that define this
        world. Build the graph to extract them into long-term agent memory.
      </p>

      {ontology?.analysis_summary && (
        <div className={styles.summaryBox}>{ontology.analysis_summary}</div>
      )}

      <div className={styles.twoCol}>
        <div>
          <h4 className={styles.subhead}>Entity types</h4>
          <ul className={styles.tagList}>
            {(ontology?.entity_types ?? []).map((e, i) => (
              <li key={i} className={styles.tag} title={e.description}>
                {e.name}
              </li>
            ))}
            {!ontology?.entity_types?.length && <li className={styles.muted}>None detected</li>}
          </ul>
        </div>
        <div>
          <h4 className={styles.subhead}>Relationship types</h4>
          <ul className={styles.tagList}>
            {(ontology?.edge_types ?? []).map((e, i) => (
              <li key={i} className={styles.tag} title={e.description}>
                {e.name}
              </li>
            ))}
            {!ontology?.edge_types?.length && <li className={styles.muted}>None detected</li>}
          </ul>
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.actionRow}>
        {alreadyBuilt && !building ? (
          <button className={styles.primaryBtn} onClick={() => onGraph(wf.graphId as string)}>
            Continue to world setup →
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={start} disabled={building}>
            {building ? 'Building graph…' : 'Build knowledge graph'}
          </button>
        )}
        {building && <span className={styles.spinnerInline} aria-hidden />}
      </div>
    </div>
  );
}
