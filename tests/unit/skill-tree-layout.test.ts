import { describe, it, expect } from 'vitest';
import type { Walkthrough, WalkthroughNode } from '@/lib/guides-db';

// ─────────────────────────────────────────────────────────────────────────────
// GuideSkillTree's layout filtering, band ordering, title wrapping, and per-node
// gating (stateOf) are defined
// inline in components/guides/GuideSkillTree.tsx (a client component). They are
// not exported, and importing the .tsx would pull in React / next/navigation /
// CSS-modules / the useSound hook — none of which belong in a pure logic test.
//
// So we test the LOGIC at the data level: we replicate the exact grouping/sorting
// and gating rules against the real Walkthrough / WalkthroughNode types imported
// from lib/guides-db. The rule bodies below are copied verbatim from the
// component so the test tracks the shipping behaviour; the types are the real
// contract, so a shape change in lib/ breaks compilation here.
// ─────────────────────────────────────────────────────────────────────────────

type NodeState = 'completed' | 'available' | 'locked';
type ClusterableNode = WalkthroughNode & { subjects?: string[] };

// Verbatim from GuideSkillTree.tsx `layoutNodes` useMemo: a selected subject
// shows its guides plus the full prerequisite closure required to reach them.
function computeLayoutNodes(nodes: ClusterableNode[], selectedSubject: string | null) {
  if (!selectedSubject) return nodes;

  const byId = new Map(nodes.map((entry) => [entry.id, entry]));
  const included = new Set(
    nodes
      .filter((entry) => entry.subjects?.includes(selectedSubject))
      .map((entry) => entry.id),
  );
  const queue = Array.from(included);
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const prereqId of byId.get(id)?.prereqIds ?? []) {
      if (included.has(prereqId)) continue;
      included.add(prereqId);
      queue.push(prereqId);
    }
  }
  return nodes.filter((entry) => included.has(entry.id));
}

// Verbatim from GuideSkillTree.tsx `bands` useMemo: group by level, then order
// child bands by the horizontal center of their prerequisites to reduce edge
// crossings. Titles provide the stable fallback.
function computeBands(nodes: ClusterableNode[]): Array<[number, ClusterableNode[]]> {
  const map = new Map<number, ClusterableNode[]>();
  for (const n of nodes) {
    const list = map.get(n.level);
    if (list) list.push(n);
    else map.set(n.level, [n]);
  }

  const order = new Map<string, number>();
  const sortedLevels = Array.from(map.keys()).sort((a, b) => a - b);
  for (const level of sortedLevels) {
    const list = map.get(level)!;
    list.sort((a, b) => {
      const aParents = a.prereqIds.map((id) => order.get(id)).filter((n): n is number => n !== undefined);
      const bParents = b.prereqIds.map((id) => order.get(id)).filter((n): n is number => n !== undefined);
      const aCenter = aParents.length > 0 ? aParents.reduce((sum, n) => sum + n, 0) / aParents.length : null;
      const bCenter = bParents.length > 0 ? bParents.reduce((sum, n) => sum + n, 0) / bParents.length : null;
      if (aCenter !== null && bCenter !== null && aCenter !== bCenter) return aCenter - bCenter;
      if (aCenter !== null && bCenter === null) return -1;
      if (aCenter === null && bCenter !== null) return 1;
      return a.topicTitle.localeCompare(b.topicTitle);
    });
    list.forEach((entry, index) => order.set(entry.id, index));
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

function titleLines(title: string): string[] {
  const maxChars = 22;
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || line.length === 0) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === 1) break;
  }

  if (lines.length < 2 && line) lines.push(line);
  lines.forEach((value, index) => {
    if (value.length > maxChars) lines[index] = `${value.slice(0, maxChars - 1)}…`;
  });
  const consumed = lines.join(' ').length;
  if (consumed < title.length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, maxChars - 1).trim()}…`;
  }
  return lines.slice(0, 2);
}

// Verbatim from GuideSkillTree.tsx `stateOf`: completed wins; else available iff
// every direct prereq is completed; else locked.
function stateOf(node: WalkthroughNode, completed: Set<string>): NodeState {
  if (completed.has(node.id)) return 'completed';
  const gated = node.prereqIds.some((pid) => !completed.has(pid));
  return gated ? 'locked' : 'available';
}

function computeDepthProgress(
  nodes: ClusterableNode[],
  totalLevels: number,
  completed: Set<string>,
  selectedSubject: string | null = null,
) {
  const visibleNodes = selectedSubject
    ? nodes.filter((entry) => entry.subjects?.includes(selectedSubject))
    : nodes;
  const stats = Array.from({ length: totalLevels }, (_, level) => {
    const levelNodes = visibleNodes.filter((entry) => entry.level === level);
    return {
      level,
      total: levelNodes.length,
      completed: levelNodes.filter((entry) => completed.has(entry.id)).length,
      available: levelNodes.filter((entry) => stateOf(entry, completed) === 'available').length,
    };
  }).filter((stat) => stat.total > 0);
  const completedNodes = visibleNodes.filter((entry) => completed.has(entry.id));
  const deepestCompleted =
    completedNodes.length > 0
      ? Math.max(...completedNodes.map((entry) => entry.level))
      : null;
  const available = visibleNodes.filter(
    (entry) => stateOf(entry, completed) === 'available',
  ).length;
  return { stats, deepestCompleted, available };
}

// ── Seed-shaped fixture ──────────────────────────────────────────────────────
// A 3-level chain that widens: two level-0 primitives feed a level-1 node, which
// (with another level-1 node) feeds the single level-2 target.
//   A (L0) ┐
//          ├─► C (L1) ┐
//   B (L0) ┘          ├─► E (L2, target)
//          D (L1) ────┘   (D has no prereqs inside the closure -> would be L0;
//                          we give it a prereq to make it L1 for the fixture)
// To keep it clean and deterministic we model:
//   A(L0) B(L0)  ->  C(L1 needs A,B)  D(L1 needs B)  ->  E(L2 needs C,D)
const node = (
  id: string,
  topicTitle: string,
  level: number,
  prereqIds: string[],
): WalkthroughNode => ({
  id,
  slug: id.toLowerCase(),
  topicTitle,
  status: 'published',
  level,
  prereqIds,
  completed: false,
});

function makeWalkthrough(): Walkthrough {
  const nodes: WalkthroughNode[] = [
    node('E', 'Target', 2, ['C', 'D']),
    node('C', 'Cognition', 1, ['A', 'B']),
    node('D', 'Discipline', 1, ['B']),
    node('A', 'Anatomy', 0, []),
    node('B', 'Basics', 0, []),
  ];
  return { targetId: 'E', levels: 3, nodes };
}

describe('level bands', () => {
  it('groups nodes by level and orders bands ascending (0 = primitives)', () => {
    const bands = computeBands(makeWalkthrough().nodes);
    expect(bands.map(([level]) => level)).toEqual([0, 1, 2]);
  });

  it('sorts nodes within a band by title', () => {
    const bands = computeBands(makeWalkthrough().nodes);
    const level0 = bands.find(([l]) => l === 0)![1];
    expect(level0.map((n) => n.topicTitle)).toEqual(['Anatomy', 'Basics']);
    const level1 = bands.find(([l]) => l === 1)![1];
    expect(level1.map((n) => n.topicTitle)).toEqual(['Cognition', 'Discipline']);
  });

  it('keeps dependent nodes close to their prerequisite columns', () => {
    const nodes = [
      node('A', 'Alpha root', 0, []),
      node('B', 'Beta root', 0, []),
      node('Z', 'Zed child', 1, ['A']),
      node('C', 'Alpha child', 1, ['B']),
    ];
    const level1 = computeBands(nodes).find(([level]) => level === 1)![1];

    expect(level1.map((entry) => entry.id)).toEqual(['Z', 'C']);
  });

  it('places the sole target as the single node at the max level', () => {
    const wt = makeWalkthrough();
    const bands = computeBands(wt.nodes);
    const maxLevel = bands[bands.length - 1][0];
    const topBand = bands[bands.length - 1][1];
    expect(maxLevel).toBe(2);
    expect(topBand).toHaveLength(1);
    expect(topBand[0].id).toBe(wt.targetId);
  });
});

describe('subject branch isolation', () => {
  const subjectNodes = (): ClusterableNode[] =>
    makeWalkthrough().nodes.map((entry) => ({
      ...entry,
      subjects: entry.id === 'C' ? ['Focus'] : ['Habits'],
    }));

  it('keeps the selected subject and its complete prerequisite closure', () => {
    expect(computeLayoutNodes(subjectNodes(), 'Focus').map((entry) => entry.id).sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('keeps the full published graph when no subject is selected', () => {
    expect(computeLayoutNodes(subjectNodes(), null)).toHaveLength(5);
  });
});

describe('task-header node titles', () => {
  it('keeps a short title on one line', () => {
    expect(titleLines('Healthy Boundaries')).toEqual(['Healthy Boundaries']);
  });

  it('wraps a long goal title to at most two readable lines', () => {
    const lines = titleLines('Building Emotional Resilience Through Daily Reflection');
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('truncates an unusually long unbroken topic name', () => {
    expect(titleLines('Psychoneuroimmunological')).toEqual(['Psychoneuroimmunologi…']);
  });
});

describe('stateOf gating', () => {
  it('primitives (no prereqs) are available from the start', () => {
    const completed = new Set<string>();
    const wt = makeWalkthrough();
    const a = wt.nodes.find((n) => n.id === 'A')!;
    const b = wt.nodes.find((n) => n.id === 'B')!;
    expect(stateOf(a, completed)).toBe('available');
    expect(stateOf(b, completed)).toBe('available');
  });

  it('a node is locked while ANY direct prereq is incomplete', () => {
    const wt = makeWalkthrough();
    const c = wt.nodes.find((n) => n.id === 'C')!; // needs A, B
    // Only A done -> B still missing -> locked.
    expect(stateOf(c, new Set(['A']))).toBe('locked');
    expect(stateOf(c, new Set())).toBe('locked');
  });

  it('a node becomes available once ALL direct prereqs are complete', () => {
    const wt = makeWalkthrough();
    const c = wt.nodes.find((n) => n.id === 'C')!; // needs A, B
    expect(stateOf(c, new Set(['A', 'B']))).toBe('available');
  });

  it('completed wins even if it were otherwise gated', () => {
    const wt = makeWalkthrough();
    const c = wt.nodes.find((n) => n.id === 'C')!;
    // C marked complete but its prereqs are NOT -> still 'completed'.
    expect(stateOf(c, new Set(['C']))).toBe('completed');
  });

  it('the target unlocks only after the whole level below it clears', () => {
    const wt = makeWalkthrough();
    const e = wt.nodes.find((n) => n.id === 'E')!; // needs C, D
    expect(stateOf(e, new Set(['C']))).toBe('locked'); // D missing
    expect(stateOf(e, new Set(['C', 'D']))).toBe('available');
  });

  it('walks the whole tree bottom-up to the target', () => {
    const wt = makeWalkthrough();
    const s = (id: string, done: string[]) =>
      stateOf(wt.nodes.find((n) => n.id === id)!, new Set(done));

    // Start: only primitives available.
    expect(s('A', [])).toBe('available');
    expect(s('C', [])).toBe('locked');
    expect(s('E', [])).toBe('locked');

    // Clear level 0.
    expect(s('C', ['A', 'B'])).toBe('available');
    expect(s('D', ['A', 'B'])).toBe('available');
    expect(s('E', ['A', 'B'])).toBe('locked');

    // Clear level 1 -> target available.
    expect(s('E', ['A', 'B', 'C', 'D'])).toBe('available');
  });
});

describe('branch-aware depth progress', () => {
  it('reports each depth independently when a shallow branch remains incomplete', () => {
    const walkthrough = makeWalkthrough();
    const progress = computeDepthProgress(
      walkthrough.nodes,
      walkthrough.levels,
      new Set(['A', 'B', 'C']),
    );

    expect(progress.deepestCompleted).toBe(1);
    expect(progress.stats).toEqual([
      { level: 0, total: 2, completed: 2, available: 0 },
      { level: 1, total: 2, completed: 1, available: 1 },
      { level: 2, total: 1, completed: 0, available: 0 },
    ]);
  });

  it('narrows progress counts to the selected canonical subject', () => {
    const nodes: ClusterableNode[] = makeWalkthrough().nodes.map((entry) => ({
      ...entry,
      subjects: entry.id === 'A' || entry.id === 'C' ? ['Focus'] : ['Habits'],
    }));
    const progress = computeDepthProgress(nodes, 3, new Set(['A']), 'Focus');

    expect(progress.stats).toEqual([
      { level: 0, total: 1, completed: 1, available: 0 },
      { level: 1, total: 1, completed: 0, available: 0 },
    ]);
    expect(progress.deepestCompleted).toBe(0);
    expect(progress.available).toBe(0);
  });
});
