import * as api from './simulation-api';
import type { AgentProfile, GraphData, GraphEdge, GraphNode, Project } from './simulation-api';

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

// Normalization matching GraphPanel.tsx logic
function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function nodeName(n: GraphNode): string {
  return str(n.name) || str(n.label) || str(n.attributes?.name as string) || str(n.id) || '';
}

function nodeId(n: GraphNode): string {
  return str(n.id) || str(n.uuid) || str(n.attributes?.id as string) || nodeName(n);
}

function nodeType(n: GraphNode): string {
  return str(n.type) || str(n.labels?.[0]) || str(n.attributes?.type as string) || 'Entity';
}

function edgeSource(e: GraphEdge): string {
  return str(e.source) || str(e.source_node_uuid) || str(e.from) || str(e.source_node_name) || '';
}

function edgeTarget(e: GraphEdge): string {
  return str(e.target) || str(e.target_node_uuid) || str(e.to) || str(e.target_node_name) || '';
}

function edgeLabel(e: GraphEdge): string {
  return str(e.type) || str(e.name) || str(e.fact_type) || str(e.attributes?.edge_type as string) || '';
}

function edgeFact(e: GraphEdge): string {
  return str(e.fact) || str(e.attributes?.fact as string) || '';
}

export function buildCsv(
  project: Project | undefined,
  graph: GraphData | undefined,
  allProfiles: AgentProfile[],
): string {
  const ontology = project?.ontology;
  const entityTypeNames = new Set(
    (ontology?.entity_types ?? []).map((e) => e.name),
  );
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  // Build node lookup by UUID to resolve edge source/target to display names
  const nodeById = new Map<string, GraphNode>();
  for (const n of nodes) {
    const id = nodeId(n);
    if (id) nodeById.set(id, n);
    if (n.uuid) nodeById.set(n.uuid, n);
    if (n.attributes?.id) nodeById.set(String(n.attributes.id), n);
  }

  const rows: string[] = [];

  // Ontology schema rows
  for (const et of ontology?.entity_types ?? []) {
    rows.push(
      [
        'schema',
        'entity_type',
        esc(et.name),
        esc(et.description || ''),
        '', '', '', '', '', '', '', '', '', '',
      ].join(','),
    );
  }
  for (const et of ontology?.edge_types ?? []) {
    rows.push(
      [
        'schema',
        'edge_type',
        esc(et.name),
        esc(et.description || ''),
        '', '', '', '', '', '', '', '', '', '',
      ].join(','),
    );
  }

  // Graph nodes as entity rows
  for (const n of nodes) {
    const nType = nodeType(n);
    const entityType = entityTypeNames.has(nType)
      ? nType
      : 'unknown';
    const attrs = n.attributes ? Object.entries(n.attributes).map(([k, v]) => `${k}:${v}`).join('; ') : '';
    rows.push(
      [
        'entity',
        esc(entityType),
        esc(nodeName(n)),
        esc(nodeId(n)),
        esc(n.summary || ''),
        esc(attrs),
        '', '', '', '', '', '', '', '',
      ].join(','),
    );
  }

  // Graph edges as relationship rows
  for (const e of edges) {
    const srcId = edgeSource(e);
    const tgtId = edgeTarget(e);
    const srcNode = srcId ? nodeById.get(srcId) : undefined;
    const tgtNode = tgtId ? nodeById.get(tgtId) : undefined;
    const attrs = e.attributes ? Object.entries(e.attributes).map(([k, v]) => `${k}:${v}`).join('; ') : '';
    rows.push(
      [
        'relationship',
        esc(edgeLabel(e)),
        esc(srcNode ? nodeName(srcNode) : srcId),
        esc(tgtNode ? nodeName(tgtNode) : tgtId),
        esc(edgeFact(e)),
        esc(attrs),
        esc(srcId),
        esc(tgtId),
        '', '', '', '', '', '',
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
        esc(p.username || ''),
        esc(p.bio || ''),
        esc(p.persona || ''),
        esc(p.description || ''),
        '', '', '', '', '', '', '',
      ].join(','),
    );
  }

  const header =
    'record_type,type,name,id,summary,attributes,source,target,fact,bio,persona,description,note1,note2';

  return [header, ...rows].join('\n');
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

  const allProfiles = [...redditProfiles, ...twitterProfiles];
  const csv = buildCsv(projectRes.data, graphRes.data, allProfiles);

  return {
    csv,
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
