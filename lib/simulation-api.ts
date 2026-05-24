/**
 * Client for the Azure World simulation backend (vendored under
 * `simulation-backend/`, deployed as its own service — see its DEPLOY.md).
 *
 * The backend is Flask + the OASIS multi-agent engine. It can't run on Vercel,
 * so it's deployed as its own service. The browser never talks to it directly —
 * all calls go through the same-origin proxy at /api/sim-proxy, which enforces
 * the VIP-membership gate server-side and injects the backend's shared secret.
 * (The backend host lives in the server-only SIMULATION_API_URL env var.)
 *
 * Every backend handler returns a JSON envelope `{ success, data?, error?, ... }`.
 * `request()` unwraps that: it throws on `success === false` or non-2xx, and
 * otherwise returns the parsed body so callers can read `.data`.
 *
 * Endpoint groups (mirrors the Flask blueprints):
 *   /api/graph/*       ontology + knowledge-graph build      (Step 1)
 *   /api/simulation/*  env setup, profiles, run control      (Steps 2–3, interviews)
 *   /api/report/*      report generation + Report-Agent chat (Steps 4–5)
 */

// Same-origin proxy. Authentication + the membership gate are enforced there;
// the real backend host is never exposed to the browser.
const BASE_URL = '/api/sim-proxy';

// ── Envelope + core types ──

export interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  [k: string]: unknown;
}

export type ProjectStatus =
  | 'created'
  | 'ontology_generated'
  | 'graph_building'
  | 'graph_built'
  | 'error'
  | string;

export interface OntologyEntityType {
  name: string;
  description?: string;
  [k: string]: unknown;
}

export interface Ontology {
  entity_types: OntologyEntityType[];
  edge_types: Array<{ name: string; description?: string; [k: string]: unknown }>;
  analysis_summary?: string;
  [k: string]: unknown;
}

export interface Project {
  project_id: string;
  name: string;
  status: ProjectStatus;
  simulation_requirement?: string;
  ontology?: Ontology;
  graph_id?: string | null;
  files?: Array<{ filename: string; size: number }>;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface TaskState {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  progress?: number;
  message?: string;
  result?: unknown;
  error?: string;
  [k: string]: unknown;
}

export interface GraphNode {
  id: string;
  uuid?: string;
  name?: string;
  label?: string;
  labels?: string[];
  type?: string;
  summary?: string;
  attributes?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface GraphEdge {
  source: string;
  target: string;
  id?: string;
  uuid?: string;
  source_node_uuid?: string;
  target_node_uuid?: string;
  source_node_name?: string;
  target_node_name?: string;
  fact?: string;
  fact_type?: string;
  expired_at?: string | null;
  invalid_at?: string | null;
  type?: string;
  name?: string;
  attributes?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  [k: string]: unknown;
}

export type SimPlatform = 'reddit' | 'twitter';

export interface AgentProfile {
  // Backend uses `user_id` as the agent identifier; `agent_id` kept optional for
  // callers/actions that use that name.
  user_id?: number | string;
  agent_id?: number | string;
  name?: string;
  username?: string;
  bio?: string;
  persona?: string;
  description?: string;
  [k: string]: unknown;
}

export interface ProfilesResponse {
  count: number;
  platform: string;
  profiles: AgentProfile[];
}

export interface SimulationInfo {
  simulation_id: string;
  project_id: string;
  graph_id?: string;
  status?: string;
  enable_twitter?: boolean;
  enable_reddit?: boolean;
  [k: string]: unknown;
}

export interface RunStatus {
  status: string;
  current_round?: number;
  max_rounds?: number;
  progress?: number;
  message?: string;
  [k: string]: unknown;
}

export interface SimPost {
  post_id: string | number;
  agent_id: string | number;
  content: string;
  round_num?: number;
  likes?: number;
  [k: string]: unknown;
}

export interface ReportState {
  report_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  progress?: number;
  content?: string;
  // The finished report body lives here (markdown).
  markdown_content?: string;
  // On completion the status endpoint returns the real report id under `result`.
  result?: { report_id?: string; status?: string; [k: string]: unknown };
  message?: string;
  error?: string;
  [k: string]: unknown;
}

// ── transport ──

async function request<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<Envelope<T>> {
  const { json, ...rest } = init || {};
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body,
    credentials: 'same-origin',
  });
  let payload: Envelope<T>;
  try {
    payload = (await res.json()) as Envelope<T>;
  } catch {
    throw new Error(`Simulation backend returned non-JSON (${res.status})`);
  }
  if (!res.ok || payload.success === false) {
    throw new Error(
      payload.error || payload.message || `Request failed (${res.status})`,
    );
  }
  return payload;
}

const qs = (params: Record<string, unknown>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
};

export function getSimulationBaseUrl() {
  return BASE_URL;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Step 1: Graph / Ontology ──

export const listProjects = (limit = 50) =>
  request<Project[]>(`/api/graph/project/list${qs({ limit })}`);

export const getProject = (projectId: string) =>
  request<Project>(`/api/graph/project/${projectId}`);

export const deleteProject = (projectId: string) =>
  request(`/api/graph/project/${projectId}`, { method: 'DELETE' });

export const resetProject = (projectId: string) =>
  request<Project>(`/api/graph/project/${projectId}/reset`, { method: 'POST' });

/**
 * Upload documents + a natural-language requirement; returns project + ontology.
 * Pass a ready FormData with `files` (one or many), `simulation_requirement`,
 * and optional `project_name` / `additional_context`.
 */
export const generateOntology = (formData: FormData) =>
  request<{
    project_id: string;
    ontology: Ontology;
    files: Array<{ filename: string; size: number }>;
    total_text_length: number;
  }>(`/api/graph/ontology/generate`, { method: 'POST', body: formData });

export const buildGraph = (data: { project_id: string; graph_name?: string }) =>
  request<{ task_id: string }>(`/api/graph/build`, { method: 'POST', json: data });

export const getGraphTaskStatus = (taskId: string) =>
  request<TaskState>(`/api/graph/task/${taskId}`);

export const getGraphData = (graphId: string) =>
  request<GraphData>(`/api/graph/data/${graphId}`);

// ── Steps 2–3: Simulation ──

export const createSimulation = (data: {
  project_id: string;
  graph_id?: string;
  enable_twitter?: boolean;
  enable_reddit?: boolean;
}) => request<SimulationInfo>(`/api/simulation/create`, { method: 'POST', json: data });

export const prepareSimulation = (data: {
  simulation_id: string;
  entity_types?: string[];
  use_llm_for_profiles?: boolean;
  parallel_profile_count?: number;
  force_regenerate?: boolean;
}) => request<{ task_id: string }>(`/api/simulation/prepare`, { method: 'POST', json: data });

export const getPrepareStatus = (data: { task_id?: string; simulation_id?: string }) =>
  request<TaskState>(`/api/simulation/prepare/status`, { method: 'POST', json: data });

export const getSimulation = (simulationId: string) =>
  request<SimulationInfo>(`/api/simulation/${simulationId}`);

export const getSimulationProfiles = (simulationId: string, platform: SimPlatform = 'reddit') =>
  request<ProfilesResponse>(`/api/simulation/${simulationId}/profiles${qs({ platform })}`);

export const getSimulationProfilesRealtime = (
  simulationId: string,
  platform: SimPlatform = 'reddit',
) => request<ProfilesResponse>(`/api/simulation/${simulationId}/profiles/realtime${qs({ platform })}`);

export const getSimulationConfig = (simulationId: string) =>
  request(`/api/simulation/${simulationId}/config`);

export const getSimulationConfigRealtime = (simulationId: string) =>
  request(`/api/simulation/${simulationId}/config/realtime`);

export const listSimulations = (projectId?: string) =>
  request<SimulationInfo[]>(`/api/simulation/list${qs({ project_id: projectId })}`);

export const startSimulation = (data: {
  simulation_id: string;
  platform?: SimPlatform;
  max_rounds?: number;
  enable_graph_memory_update?: boolean;
}) => request(`/api/simulation/start`, { method: 'POST', json: data });

export const stopSimulation = (data: { simulation_id: string }) =>
  request(`/api/simulation/stop`, { method: 'POST', json: data });

export const getRunStatus = (simulationId: string) =>
  request<RunStatus>(`/api/simulation/${simulationId}/run-status`);

export const getRunStatusDetail = (simulationId: string) =>
  request<RunStatus & { recent_actions?: unknown[] }>(
    `/api/simulation/${simulationId}/run-status/detail`,
  );

export const getSimulationPosts = (
  simulationId: string,
  platform: SimPlatform = 'reddit',
  limit = 50,
  offset = 0,
) => request<SimPost[]>(`/api/simulation/${simulationId}/posts${qs({ platform, limit, offset })}`);

export const getSimulationTimeline = (
  simulationId: string,
  startRound = 0,
  endRound: number | null = null,
) =>
  request(
    `/api/simulation/${simulationId}/timeline${qs({ start_round: startRound, end_round: endRound })}`,
  );

export const getAgentStats = (simulationId: string) =>
  request(`/api/simulation/${simulationId}/agent-stats`);

export const getSimulationActions = (
  simulationId: string,
  params: {
    limit?: number;
    offset?: number;
    platform?: SimPlatform;
    agent_id?: string | number;
    round_num?: number;
  } = {},
) => request(`/api/simulation/${simulationId}/actions${qs(params)}`);

export const closeSimulationEnv = (data: { simulation_id: string; timeout?: number }) =>
  request(`/api/simulation/close-env`, { method: 'POST', json: data });

export const getEnvStatus = (data: { simulation_id: string }) =>
  request(`/api/simulation/env-status`, { method: 'POST', json: data });

export interface InterviewResult {
  interviews_count: number;
  mode?: string;
  results: Record<string, { agent_id: number | string; platform?: string; response: string }>;
}

export const interviewAgents = (data: {
  simulation_id: string;
  interviews: Array<{ agent_id: string | number; prompt: string }>;
}) =>
  request<{ result: InterviewResult }>(`/api/simulation/interview/batch`, {
    method: 'POST',
    json: data,
  });

export const getSimulationHistory = (limit = 20) =>
  request(`/api/simulation/history${qs({ limit })}`);

// ── Steps 4–5: Report ──

export const generateReport = (data: { simulation_id: string; force_regenerate?: boolean }) =>
  request<{
    report_id: string;
    task_id?: string;
    simulation_id: string;
    status?: string;
    already_generated?: boolean;
  }>(`/api/report/generate`, {
    method: 'POST',
    json: data,
  });

// Status is a POST that takes task_id / simulation_id in the body (not a GET by
// report_id — the backend route is methods=['POST']).
export const getReportStatus = (params: { task_id?: string; simulation_id?: string }) =>
  request<ReportState>(`/api/report/generate/status`, { method: 'POST', json: params });

export const getAgentLog = (reportId: string, fromLine = 0) =>
  request<{ lines: string[]; total: number }>(
    `/api/report/${reportId}/agent-log${qs({ from_line: fromLine })}`,
  );

export const getConsoleLog = (reportId: string, fromLine = 0) =>
  request<{ lines: string[]; total: number }>(
    `/api/report/${reportId}/console-log${qs({ from_line: fromLine })}`,
  );

export const getReport = (reportId: string) =>
  request<ReportState>(`/api/report/${reportId}`);

export const chatWithReport = (data: {
  simulation_id: string;
  message: string;
  chat_history?: Array<{ role: string; content: string }>;
}) =>
  request<{ response: string; sources?: unknown[]; tool_calls?: unknown[] }>(`/api/report/chat`, {
    method: 'POST',
    json: data,
  });
