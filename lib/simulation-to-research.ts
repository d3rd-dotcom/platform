import * as api from './simulation-api';
import type { AgentProfile, GraphData, Project } from './simulation-api';

const STORAGE_KEY = 'mwa-sim-to-research';

export interface SimTransferPayload {
  csv: string;
  source: string;
  timestamp: number;
}

function esc(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function fetchSimulationData(
  projectId: string,
  graphId: string,
  simulationId: string,
  projectName: string,
): Promise<SimTransferPayload> {
  const [projectRes, graphRes, redditProfiles, twitterProfiles] =
    await Promise.all([
      api.getProject(projectId).catch(() => ({ data: undefined })),
      api.getGraphData(graphId).catch(() => ({ data: undefined })),
      api
        .getSimulationProfiles(simulationId, 'reddit')
        .then((r) => r.data?.profiles ?? [], () => [] as AgentProfile[]),
      api
        .getSimulationProfiles(simulationId, 'twitter')
        .then((r) => r.data?.profiles ?? [], () => [] as AgentProfile[]),
    ]);

  const project = projectRes.data;
  const graph = graphRes.data;
  const ontology = project?.ontology;
  const entityTypes = new Set(
    (ontology?.entity_types ?? []).map((e) => e.name),
  );
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const allProfiles = [...redditProfiles, ...twitterProfiles];

  const rows: string[] = [];

  // Ontology entity-types as schema reference rows
  for (const et of ontology?.entity_types ?? []) {
    rows.push(
      [
        'schema',
        esc(et.name),
        '',
        '',
        '',
        '',
        '',
        '',
        esc(et.description || ''),
        '',
        '',
        '',
        '',
      ].join(','),
    );
  }

  // Ontology edge-types as schema reference rows
  for (const et of ontology?.edge_types ?? []) {
    rows.push(
      [
        'schema',
        '',
        '',
        '',
        '',
        '',
        esc(et.name),
        '',
        esc(et.description || ''),
        '',
        '',
        '',
        '',
      ].join(','),
    );
  }

  // Graph nodes as entity rows
  for (const n of nodes) {
    const entityType = entityTypes.has(n.type || '')
      ? (n.type || '')
      : entityTypes.has(n.label || '')
        ? (n.label || '')
        : (n.type || n.label || 'unknown');
    rows.push(
      [
        'entity',
        esc(entityType),
        esc(n.name || n.id || ''),
        esc(n.label || ''),
        esc(n.summary || ''),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ].join(','),
    );
  }

  // Graph edges as relationship rows
  for (const e of edges) {
    rows.push(
      [
        'relationship',
        '',
        '',
        '',
        '',
        esc(e.source_node_name || e.source || ''),
        esc(e.fact || e.name || e.type || ''),
        esc(e.target_node_name || e.target || ''),
        esc(e.fact || ''),
        '',
        '',
        '',
        '',
      ].join(','),
    );
  }

  // Agent profiles as agent rows
  for (const p of allProfiles) {
    rows.push(
      [
        'agent',
        '',
        esc(p.name || ''),
        '',
        '',
        '',
        '',
        '',
        '',
        esc(p.username || ''),
        esc(p.bio || ''),
        esc(p.persona || ''),
        '',
      ].join(','),
    );
  }

  const header =
    'record_type,entity_type,name,label,summary,source_name,relationship,target_name,fact,username,bio,persona,note';

  return {
    csv: [header, ...rows].join('\n'),
    source: projectName,
    timestamp: Date.now(),
  };
}

export function saveTransferPayload(payload: SimTransferPayload): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function getTransferPayload(): SimTransferPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SimTransferPayload) : null;
  } catch {
    return null;
  }
}

export function clearTransferPayload(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
