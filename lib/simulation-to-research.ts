import * as api from './simulation-api';
import type { AgentProfile, Envelope, GraphData, GraphNode, Project } from './simulation-api';

interface ActionsResponse {
  count: number;
  actions: ActionRecord[];
}

interface StatsResponse {
  agents_count: number;
  stats: Array<Record<string, unknown>>;
}

interface AgentStatsEntry {
  agent_id: number | string;
  agent_name: string;
  total_actions: number;
  twitter_actions: number;
  reddit_actions: number;
  action_types: Record<string, number>;
  first_action_time: string;
  last_action_time: string;
}

const STORAGE_KEY = 'mwa-sim-to-research';

export interface SimTransferPayload {
  nodesCsv: string;
  edgesCsv: string;
  metadataCsv: string;
  source: string;
  timestamp: number;
}

interface ActionRecord {
  round_num: number;
  timestamp: string;
  platform: string;
  agent_id: number | string;
  agent_name: string;
  action_type: string;
  action_args: Record<string, unknown>;
  result: string | null;
  success: boolean;
}

function esc(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function cleanBio(text: string): string {
  const cleaned = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 500 ? cleaned.slice(0, 497) + '...' : cleaned;
}

// ── Build nodes.csv (numerical stats per agent) ──

function buildNodesCsv(
  allProfiles: AgentProfile[],
  agentStats: AgentStatsEntry[] | null,
  actions: ActionRecord[],
  project: Project | undefined,
): string {
  const rows: string[] = [];
  const seen = new Set<string>();

  const roundsPerAgent = new Map<string, Set<number>>();
  for (const a of actions) {
    const name = str(a.agent_name);
    if (!name) continue;
    if (!roundsPerAgent.has(name)) roundsPerAgent.set(name, new Set());
    roundsPerAgent.get(name)!.add(a.round_num);
  }

  const statsByName = new Map<string, AgentStatsEntry>();
  if (agentStats) {
    for (const s of agentStats) {
      const name = str(s.agent_name);
      if (name) statsByName.set(name, s);
    }
  }

  for (const p of allProfiles) {
    const id = p.user_id ?? p.agent_id;
    const agentName = p.name || p.username || `agent_${id}`;
    if (!agentName || seen.has(agentName)) continue;
    seen.add(agentName);

    const st = statsByName.get(agentName);
    const total = st?.total_actions ?? 0;
    const twit = st?.twitter_actions ?? 0;
    const reddit = st?.reddit_actions ?? 0;
    const actionTypes = st?.action_types ?? {};
    const diversity = Object.keys(actionTypes).length;
    const twitterPct = total > 0 ? round2((twit / total) * 100) : 0;
    const roundsActive = (roundsPerAgent.get(agentName)?.size ?? 0);
    const likesGiven = (actionTypes['LIKE_POST'] ?? 0) + (actionTypes['LIKE_COMMENT'] ?? 0);
    const postsMade = actionTypes['CREATE_POST'] ?? 0;
    const commentsMade = actionTypes['CREATE_COMMENT'] ?? 0;
    const followsGiven = actionTypes['FOLLOW'] ?? 0;

    rows.push(
      [
        esc(agentName),
        'Person',
        total,
        diversity,
        twitterPct,
        roundsActive,
        likesGiven,
        postsMade,
        commentsMade,
        followsGiven,
      ].join(','),
    );
  }

  // Ontology concepts as additional nodes (zero metrics)
  const ontology = project?.ontology;
  for (const et of ontology?.entity_types ?? []) {
    const conceptName = str(et.name);
    if (!conceptName || seen.has(conceptName)) continue;
    seen.add(conceptName);
    rows.push(
      [esc(conceptName), 'Concept', 0, 0, 0, 0, 0, 0, 0, 0].join(','),
    );
  }

  return [
    'node_id,entity_type,total_actions,action_diversity,twitter_pct,rounds_active,likes_given,posts_made,comments_made,follows_given',
    ...rows,
  ].join('\n');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Build metadata.csv (human-readable lookup) ──

function buildMetadataCsv(allProfiles: AgentProfile[], project: Project | undefined): string {
  const rows: string[] = [];
  const seen = new Set<string>();

  for (const p of allProfiles) {
    const id = p.user_id ?? p.agent_id;
    const agentName = p.name || p.username || `agent_${id}`;
    if (!agentName || seen.has(agentName)) continue;
    seen.add(agentName);

    const displayName = str(p.name) || str(p.username) || agentName;
    const bio = cleanBio(str(p.bio) || str(p.persona) || str(p.description) || '');

    rows.push(
      [esc(agentName), esc(displayName), esc(bio)].join(','),
    );
  }

  // Ontology concepts
  const ontology = project?.ontology;
  for (const et of ontology?.entity_types ?? []) {
    const conceptName = str(et.name);
    if (!conceptName || seen.has(conceptName)) continue;
    seen.add(conceptName);
    const desc = cleanBio(str(et.description));
    rows.push(
      [esc(conceptName), esc(conceptName), esc(desc)].join(','),
    );
  }

  return [
    'node_id,display_name,bio',
    ...rows,
  ].join('\n');
}

// ── Build edges.csv from simulation actions ──

const TARGET_FIELDS: Record<string, string> = {
  LIKE_POST: 'post_author_name',
  DISLIKE_POST: 'post_author_name',
  LIKE_COMMENT: 'comment_author_name',
  DISLIKE_COMMENT: 'comment_author_name',
  REPOST: 'original_author_name',
  QUOTE_POST: 'original_author_name',
  FOLLOW: 'target_user_name',
  MUTE: 'target_user_name',
  CREATE_COMMENT: 'post_author_name',
  SEARCH_USER: 'target_user_name',
};

function buildEdgesCsv(actions: ActionRecord[]): string {
  const rows: string[] = [];

  for (const a of actions) {
    const source = str(a.agent_name);
    if (!source) continue;

    const actionType = str(a.action_type);
    if (!actionType) continue;

    const args = a.action_args ?? {};
    const roundNum = a.round_num ?? 0;
    const targetField = TARGET_FIELDS[actionType];
    let target = '';

    if (targetField) {
      target = str(args[targetField]);
    }

    if (!target && (actionType === 'FOLLOW' || actionType === 'MUTE')) {
      target = str(args.target_user_name) || str(args.target_id) || '';
    }

    if (!target && actionType === 'CREATE_POST') {
      target = source;
    }

    if (!target) continue;

    const relType = ACTION_TO_REL[actionType] || actionType.toLowerCase();
    const weight = '1';

    rows.push(
      [
        esc(source),
        esc(target),
        String(roundNum),
        esc(relType),
        weight,
      ].join(','),
    );
  }

  return [
    'source_node,target_node,timestamp_round,relationship_type,trajectory_weight',
    ...rows,
  ].join('\n');
}

const ACTION_TO_REL: Record<string, string> = {
  CREATE_POST: 'posted',
  CREATE_COMMENT: 'commented_on',
  LIKE_POST: 'liked',
  DISLIKE_POST: 'disliked',
  LIKE_COMMENT: 'liked_comment',
  DISLIKE_COMMENT: 'disliked_comment',
  REPOST: 'reposted',
  QUOTE_POST: 'quoted',
  FOLLOW: 'follows',
  MUTE: 'muted',
  SEARCH_POSTS: 'searched',
  SEARCH_USER: 'searched_for',
  TREND: 'checked_trends',
};

// ── Public API ──

export async function fetchSimulationData(
  projectId: string,
  graphId: string,
  simulationId: string,
  projectName: string,
): Promise<SimTransferPayload> {
  const [projectRes, graphRes, redditProfiles, twitterProfiles, actionsRes, statsRes] =
    await Promise.all([
      api.getProject(projectId).catch(() => ({ data: undefined })),
      api.getGraphData(graphId).catch(() => ({ data: undefined })),
      api
        .getSimulationProfiles(simulationId, 'reddit')
        .then((r) => r.data?.profiles ?? [], () => [] as AgentProfile[]),
      api
        .getSimulationProfiles(simulationId, 'twitter')
        .then((r) => r.data?.profiles ?? [], () => [] as AgentProfile[]),
      api
        .getSimulationActions(simulationId, { limit: 10000 })
        .then((r) => ((r.data as ActionsResponse | undefined)?.actions ?? []) as ActionRecord[], () => [] as ActionRecord[]),
      api
        .getAgentStats(simulationId)
        .then((r) => ((r.data as StatsResponse | undefined)?.stats ?? null) as Array<Record<string, unknown>> | null, () => null),
    ]);

  const allProfiles = [...redditProfiles, ...twitterProfiles];
  const agentStatsTyped = statsRes as AgentStatsEntry[] | null;

  const nodesCsv = buildNodesCsv(
    allProfiles,
    agentStatsTyped,
    actionsRes,
    projectRes.data,
  );
  const metadataCsv = buildMetadataCsv(allProfiles, projectRes.data);
  const edgesCsv = buildEdgesCsv(actionsRes);

  return {
    nodesCsv,
    edgesCsv,
    metadataCsv,
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
