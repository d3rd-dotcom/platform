'use client';

import { useCallback, useRef, useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { GraphData } from '@/lib/simulation-api';
import { DotmSquare15 } from '@/components/dot-matrix/DotmSquare15';
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
  const resumingBuild = !wf.graphId && wf.project.status === 'graph_building';
  const [taskId, setTaskId] = useState<string | null>(
    resumingBuild ? wf.project.graph_build_task_id ?? null : null,
  );
  const [building, setBuilding] = useState(resumingBuild);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [enrichmentContext, setEnrichmentContext] = useState('');
  const [enrichmentTaskId, setEnrichmentTaskId] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentMessage, setEnrichmentMessage] = useState<string | null>(null);
  const completingBuild = useRef(false);

  const ontology = wf.project.ontology;
  const alreadyBuilt = !!wf.graphId;

  const finishBuild = useCallback(
    (graphId: string) => {
      if (completingBuild.current) return;
      completingBuild.current = true;
      setDone(true);
      setBuilding(false);
      setTaskId(null);
      onGraph(graphId);
    },
    [onGraph],
  );

  const failBuild = useCallback((message: string) => {
    setError(message);
    setDone(true);
    setBuilding(false);
    setTaskId(null);
  }, []);

  const start = async () => {
    setError(null);
    setDone(false);
    completingBuild.current = false;
    setBuilding(true);
    try {
      const res = await api.buildGraph({ project_id: wf.project.project_id });
      const nextTaskId = res.data?.task_id;
      if (!nextTaskId) throw new Error('No graph build task id returned');
      setTaskId(nextTaskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start graph build');
      setBuilding(false);
    }
  };

  const enrich = async () => {
    const context = enrichmentContext.trim();
    if (!context) {
      setError('Add at least one fact before updating the graph.');
      return;
    }
    setError(null);
    setEnrichmentMessage(null);
    setEnriching(true);
    try {
      const res = await api.enrichGraph({ project_id: wf.project.project_id, context });
      const nextTaskId = res.data?.task_id;
      if (!nextTaskId) throw new Error('No enrichment task id returned');
      setEnrichmentTaskId(nextTaskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add context to the graph');
      setEnriching(false);
    }
  };

  usePolling(() => api.getGraphTaskStatus(taskId as string), {
    enabled: !!taskId && !done,
    intervalMs: 2500,
    stop: (res) => res.data?.status === 'completed' || res.data?.status === 'failed',
    onData: async (res) => {
      const st = res.data?.status;
      if (st === 'failed') {
        failBuild(res.data?.error || 'Graph build failed');
      } else if (st === 'completed') {
        const result = res.data?.result;
        const graphId =
          result && typeof result === 'object' && 'graph_id' in result
            ? (result as { graph_id?: unknown }).graph_id
            : null;
        if (typeof graphId === 'string' && graphId) {
          finishBuild(graphId);
        }
      }
    },
  });

  // Project state is persisted by the backend and is the durable fallback if a
  // task status response is missed or a user reopens a build already in flight.
  usePolling(() => api.getProject(wf.project.project_id), {
    enabled: building && !done,
    intervalMs: 2500,
    stop: (res) =>
      res.data?.status === 'failed' ||
      Boolean(
        res.data?.graph_id &&
        (res.data.status === 'graph_completed' || res.data.status === 'graph_built'),
      ),
    onData: (res) => {
      const project = res.data;
      if (project?.status === 'failed') {
        failBuild(project.error || 'Graph build failed');
      } else if (
        project?.graph_id &&
        (project.status === 'graph_completed' || project.status === 'graph_built')
      ) {
        finishBuild(project.graph_id);
      }
    },
  });

  usePolling(() => api.getGraphTaskStatus(enrichmentTaskId as string), {
    enabled: !!enrichmentTaskId && enriching,
    intervalMs: 2500,
    stop: (res) => res.data?.status === 'completed' || res.data?.status === 'failed',
    onData: async (res) => {
      const st = res.data?.status;
      if (st === 'failed') {
        setError(res.data?.error || 'Graph enrichment failed');
        setEnriching(false);
        setEnrichmentTaskId(null);
      } else if (st === 'completed' && wf.graphId) {
        try {
          const g = await api.getGraphData(wf.graphId);
          if (g.data) onGraphData(g.data);
          setEnrichmentContext('');
          setEnrichmentMessage('New context added. The graph has been refreshed.');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Context added, but the graph could not be reloaded');
        } finally {
          setEnriching(false);
          setEnrichmentTaskId(null);
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

      {alreadyBuilt && (
        <section className={styles.enrichmentBox} aria-label="Add new context to ontology">
          <h3 className={styles.enrichmentTitle}>Add new context</h3>
          <p className={styles.enrichmentLead}>
            Add people, events, or relationship facts that were not in the original documents.
            The existing graph stays in place while new facts are extracted into it.
          </p>
          <textarea
            className={styles.textarea}
            value={enrichmentContext}
            onChange={(e) => setEnrichmentContext(e.target.value)}
            rows={6}
            disabled={enriching}
            placeholder={`Add one fact per line.\nJames -> WORKS_WITH -> Maya Chen\nMaya Chen -> REVIEWS -> Artizen application`}
          />
          <p className={styles.enrichmentNote}>
            Existing setup runs and reports do not update until you rerun them.
          </p>
          {enrichmentMessage && <p className={styles.successText}>{enrichmentMessage}</p>}
          <button
            className={styles.secondaryBtn}
            onClick={enrich}
            disabled={enriching || !enrichmentContext.trim()}
          >
            {enriching ? 'Updating graph...' : 'Add context to graph'}
          </button>
        </section>
      )}

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
        {building && (
          <span className={styles.graphBuildLoader} aria-hidden>
            <DotmSquare15 speed={0.9} dotSize={4} gap={3} />
          </span>
        )}
      </div>
    </div>
  );
}
