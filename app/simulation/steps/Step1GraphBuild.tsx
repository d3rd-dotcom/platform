'use client';

import { useCallback, useRef, useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { GraphData } from '@/lib/simulation-api';
import { DotmSquare3 } from '@/components/dot-matrix/DotmSquare3';
import Button from '@/components/button/Button';
import { useSound } from '@/hooks/useSound';
import { usePolling } from '../usePolling';
import type { WorkflowState } from '../SimulationWorkspace';
import styles from '../simulation.module.css';

export default function Step1GraphBuild({
  wf,
  onRebuildStart,
  onGraph,
  onGraphData,
}: {
  wf: WorkflowState;
  onRebuildStart: () => void;
  onGraph: (graphId: string) => void;
  onGraphData: (g: GraphData) => void;
}) {
  const { play } = useSound();
  const resumingBuild = !wf.graphId && wf.project.status === 'graph_building';
  const [taskId, setTaskId] = useState<string | null>(
    resumingBuild ? wf.project.graph_build_task_id ?? null : null,
  );
  const [building, setBuilding] = useState(resumingBuild);
  const [rebuilding, setRebuilding] = useState(false);
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
      setRebuilding(false);
      setTaskId(null);
      play('success');
      onGraph(graphId);
    },
    [onGraph, play],
  );

  const failBuild = useCallback((message: string) => {
    play('error');
    setError(message);
    setDone(true);
    setBuilding(false);
    setRebuilding(false);
    setTaskId(null);
  }, [play]);

  const start = async (force = false) => {
    play('click');
    setError(null);
    setDone(false);
    completingBuild.current = false;
    setBuilding(true);
    setRebuilding(force);
    try {
      const res = await api.buildGraph({ project_id: wf.project.project_id, force });
      const nextTaskId = res.data?.task_id;
      if (!nextTaskId) throw new Error('No graph build task id returned');
      setTaskId(nextTaskId);
      if (force) onRebuildStart();
    } catch (e) {
      play('error');
      setError(e instanceof Error ? e.message : 'Failed to start graph build');
      setBuilding(false);
      setRebuilding(false);
    }
  };

  const rebuild = () => {
    const confirmed = window.confirm(
      'Rebuild this graph from its saved documents and added context? Existing simulations and reports will remain unchanged.',
    );
    if (confirmed) void start(true);
  };

  const enrich = async () => {
    play('click');
    const context = enrichmentContext.trim();
    if (!context) {
      play('error');
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
      play('error');
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
          setEnrichmentMessage('Context added. Generate a new population to use the updated graph.');
          play('success');
        } catch (e) {
          play('error');
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
        Build the graph to extract entities and relationships into long-term agent memory.
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
            Add facts missing from the source documents. The graph extracts new entities and
            relationships from this text.
          </p>
          <textarea
            className={styles.textarea}
            value={enrichmentContext}
            onChange={(e) => setEnrichmentContext(e.target.value)}
            rows={6}
            disabled={enriching}
            placeholder={`Add one fact per line.\nJordan Lee -> WORKS_WITH -> Civic Lab\nCivic Lab -> FUNDS -> Community garden`}
          />
          <p className={styles.enrichmentNote}>
            Existing populations, runs, and reports keep their original data.
          </p>
          {enrichmentMessage && <p className={styles.successText}>{enrichmentMessage}</p>}
          <button
            className={styles.secondaryBtn}
            onClick={enrich}
            onMouseEnter={() => play('hover')}
            disabled={enriching || !enrichmentContext.trim()}
          >
            {enriching ? 'Updating graph...' : 'Add context to graph'}
          </button>
        </section>
      )}

      {alreadyBuilt && (
        <section className={styles.correctionBox} aria-label="Correct generated graph data">
          <h3 className={styles.enrichmentTitle}>Correct generated data</h3>
          <p className={styles.enrichmentLead}>
            Select a relationship in the graph to replace or remove it. If an entity or source
            document is wrong, create a new world from corrected documents.
          </p>
          <p className={styles.enrichmentNote}>
            Rebuild reruns extraction from this world&apos;s saved documents and added context.
          </p>
          <button
            className={styles.secondaryBtn}
            onClick={rebuild}
            onMouseEnter={() => play('hover')}
            disabled={building || enriching}
          >
            Rebuild graph
          </button>
        </section>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.actionRow}>
        {alreadyBuilt && !building ? (
          <Button
            onClick={() => {
              play('navigation');
              onGraph(wf.graphId as string);
            }}
            onMouseEnter={() => play('hover')}
          >
            Continue to world setup →
          </Button>
        ) : (
          <Button onClick={() => start(false)} onMouseEnter={() => play('hover')} disabled={building}>
            {building ? (rebuilding ? 'Rebuilding graph…' : 'Building graph…') : 'Build knowledge graph'}
          </Button>
        )}
        {building && (
          <span className={styles.graphBuildLoader} aria-hidden>
            <DotmSquare3 speed={0.9} dotSize={4} gap={3} />
          </span>
        )}
      </div>
    </div>
  );
}
