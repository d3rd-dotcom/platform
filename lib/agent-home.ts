import { sqlQuery } from './db';
import { decryptForUser } from './encrypt';
import { ensurePersonalCourseSchema } from './ensurePersonalCourseSchema';
import { ensurePrayersSchema } from './ensurePrayersSchema';
import { getPersonalCourse } from './personal-course-db';

export type AgentReminderKind = 'morning_pages' | 'custom';

export interface AgentHomeRow {
  id: string;
  username: string;
  wallet_address: string;
  shard_count: number;
  created_at: string;
  account_type: string | null;
  operator_wallet: string | null;
  custodial: boolean;
}

export interface AgentMorningPageEntry {
  day: number | null;
  date: string | null;
  text: string;
  submittedAt: number | null;
}

export interface MorningPagesSummary {
  totalEntries: number;
  currentStreak: number;
  lastEntryDate: string | null;
  hasEntryToday: boolean;
  dueToday: boolean;
  completedDays: boolean[];
  currentWeek: number;
}

export interface AgentCourseSummary {
  status: 'not_started' | 'intake' | 'generating' | 'ready';
  hasCourse: boolean;
  title: string | null;
  focus: string | null;
  totalWeeks: number;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
}

export interface AgentReminder {
  id: string;
  agentId: string;
  agentUsername?: string;
  kind: AgentReminderKind;
  message: string;
  dueAt: string | null;
  createdAt: string;
  virtual: boolean;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeWallet(wallet: string | null | undefined) {
  return wallet?.trim().toLowerCase() ?? '';
}

export function isAgentOperator(agent: Pick<AgentHomeRow, 'operator_wallet'>, wallet: string | null | undefined) {
  return Boolean(normalizeWallet(wallet) && normalizeWallet(agent.operator_wallet) === normalizeWallet(wallet));
}

export function isAgentWallet(agent: Pick<AgentHomeRow, 'wallet_address'>, wallet: string | null | undefined) {
  return Boolean(normalizeWallet(wallet) && normalizeWallet(agent.wallet_address) === normalizeWallet(wallet));
}

export async function getAgentHomeRow(agentId: string): Promise<AgentHomeRow | null> {
  const rows = await sqlQuery<AgentHomeRow[]>(
    `SELECT u.id, u.username, u.wallet_address,
            u.shard_count, u.created_at, u.account_type, u.operator_wallet,
            (k.user_id IS NOT NULL) AS custodial
     FROM users u
     LEFT JOIN agent_wallet_keys k ON k.user_id = u.id
     WHERE u.id = :id
     LIMIT 1`,
    { id: agentId }
  );

  const agent = rows[0];
  if (!agent || agent.account_type !== 'agent') return null;
  return agent;
}

export async function getOperatorAgentRows(operatorWallet: string): Promise<AgentHomeRow[]> {
  return sqlQuery<AgentHomeRow[]>(
    `SELECT u.id, u.username, u.wallet_address,
            u.shard_count, u.created_at, u.account_type, u.operator_wallet,
            (k.user_id IS NOT NULL) AS custodial
     FROM users u
     LEFT JOIN agent_wallet_keys k ON k.user_id = u.id
     WHERE u.account_type = 'agent' AND LOWER(u.operator_wallet) = LOWER(:operatorWallet)
     ORDER BY u.created_at DESC`,
    { operatorWallet: normalizeWallet(operatorWallet) }
  );
}

function normalizeEntry(rawEntry: unknown): AgentMorningPageEntry | null {
  if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
  const entry = rawEntry as Record<string, unknown>;
  const day = typeof entry.day === 'number' && Number.isFinite(entry.day) ? entry.day : null;
  const date = typeof entry.date === 'string' && DATE_KEY_RE.test(entry.date) ? entry.date : null;
  const content = typeof entry.content === 'string'
    ? entry.content
    : typeof entry.text === 'string'
      ? entry.text
      : '';
  const submittedAtValue = entry.submittedAt;
  const submittedAt = typeof submittedAtValue === 'number' && Number.isFinite(submittedAtValue)
    ? submittedAtValue
    : typeof submittedAtValue === 'string' && Number.isFinite(Number(submittedAtValue))
      ? Number(submittedAtValue)
      : null;

  return {
    day,
    date,
    text: content,
    submittedAt,
  };
}

function normalizeAllWeekPages(raw: unknown): Record<string, AgentMorningPageEntry[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const allWeekPages: Record<string, AgentMorningPageEntry[]> = {};
  for (const [weekKey, rawEntries] of Object.entries(raw as Record<string, unknown>)) {
    const weekNumber = Number(weekKey);
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 12) continue;
    if (!Array.isArray(rawEntries)) {
      allWeekPages[String(weekNumber)] = [];
      continue;
    }

    allWeekPages[String(weekNumber)] = rawEntries
      .map(normalizeEntry)
      .filter((entry): entry is AgentMorningPageEntry => entry !== null);
  }

  return allWeekPages;
}

export function parseAgentAllWeekPages(
  agentUserId: string,
  progressData: unknown
): Record<string, AgentMorningPageEntry[]> {
  if (!progressData || typeof progressData !== 'object') return {};
  const data = progressData as Record<string, unknown>;

  if (data.encrypted && typeof data.data === 'string') {
    const decrypted = decryptForUser(agentUserId, data.data, 'daily-notes');
    const parsed = JSON.parse(decrypted) as { allWeekPages?: unknown };
    return normalizeAllWeekPages(parsed.allWeekPages);
  }

  return normalizeAllWeekPages(data.allWeekPages);
}

export async function loadAgentAllWeekPages(agentUserId: string): Promise<Record<string, AgentMorningPageEntry[]>> {
  await ensurePrayersSchema();

  const rows = await sqlQuery<Array<{ progress_data: unknown }>>(
    `SELECT progress_data
     FROM prayers
     WHERE user_id = :userId
     LIMIT 1`,
    { userId: agentUserId }
  );

  if (rows.length === 0) return {};
  return parseAgentAllWeekPages(agentUserId, rows[0].progress_data);
}

function dateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function shiftedDateKey(base: Date, daysAgo: number) {
  const date = new Date(base);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return dateKey(date);
}

export function resolveCurrentMorningPagesWeek(allWeekPages: Record<string, AgentMorningPageEntry[]>) {
  let resolvedWeek = 1;

  for (let week = 1; week <= 12; week += 1) {
    const entries = allWeekPages[String(week)] ?? [];
    const previousCount = week === 1 ? 7 : (allWeekPages[String(week - 1)] ?? []).length;
    const unlocked = previousCount >= 7;

    if (unlocked) resolvedWeek = week;
    if (unlocked && entries.length < 7) {
      resolvedWeek = week;
      break;
    }
  }

  return resolvedWeek;
}

export function summarizeMorningPages(
  allWeekPages: Record<string, AgentMorningPageEntry[]>,
  now = new Date()
): MorningPagesSummary {
  const entries = Object.values(allWeekPages).flat();
  const allDates = new Set<string>();
  let lastEntryDate: string | null = null;
  let latestSubmittedAt = -1;

  for (const entry of entries) {
    if (entry.date) {
      allDates.add(entry.date);
      if (!lastEntryDate || entry.date > lastEntryDate) {
        lastEntryDate = entry.date;
      }
    }
    if (entry.submittedAt !== null && entry.submittedAt > latestSubmittedAt) {
      latestSubmittedAt = entry.submittedAt;
      if (entry.date) lastEntryDate = entry.date;
    }
  }

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = dateKey(today);
  const hasEntryToday = allDates.has(todayStr);

  let currentStreak = 0;
  const checkDate = new Date(today);
  if (!hasEntryToday) {
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }
  while (allDates.has(dateKey(checkDate))) {
    currentStreak += 1;
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }

  const completedDays = [];
  for (let daysAgo = 4; daysAgo >= 0; daysAgo -= 1) {
    completedDays.push(allDates.has(shiftedDateKey(today, daysAgo)));
  }

  return {
    totalEntries: entries.length,
    currentStreak,
    lastEntryDate,
    hasEntryToday,
    dueToday: currentStreak > 0 && !hasEntryToday,
    completedDays,
    currentWeek: resolveCurrentMorningPagesWeek(allWeekPages),
  };
}

export function getMorningPagesWeek(
  allWeekPages: Record<string, AgentMorningPageEntry[]>,
  weekNumber: number
) {
  const resolvedWeek = Number.isInteger(weekNumber) && weekNumber >= 1 && weekNumber <= 12
    ? weekNumber
    : resolveCurrentMorningPagesWeek(allWeekPages);

  return {
    weekNumber: resolvedWeek,
    entries: allWeekPages[String(resolvedWeek)] ?? [],
    previousWeekCount: resolvedWeek === 1 ? 7 : (allWeekPages[String(resolvedWeek - 1)] ?? []).length,
  };
}

function countCompletedProgressItems(progressData: unknown): number {
  const completed = new Set<string>();
  const seen = new WeakSet<object>();

  const visit = (value: unknown, path: string) => {
    if (value == null) return;

    if (typeof value === 'boolean') {
      if (value) completed.add(path);
      return;
    }

    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      const pathLooksCompleted = /completed/i.test(path);
      value.forEach((item, index) => {
        if (pathLooksCompleted && (typeof item === 'string' || typeof item === 'number')) {
          completed.add(String(item));
        } else {
          visit(item, `${path}.${index}`);
        }
      });
      return;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (Array.isArray(child) && /completed/i.test(key)) {
        child.forEach((item, index) => {
          if (typeof item === 'string' || typeof item === 'number') {
            completed.add(String(item));
          } else {
            visit(item, `${childPath}.${index}`);
          }
        });
      } else {
        visit(child, childPath);
      }
    }
  };

  visit(progressData, 'progress');
  return completed.size;
}

export async function loadAgentCourseSummary(agentUserId: string): Promise<AgentCourseSummary> {
  await ensurePersonalCourseSchema();
  const course = await getPersonalCourse(agentUserId);

  if (!course) {
    return {
      status: 'not_started',
      hasCourse: false,
      title: null,
      focus: null,
      totalWeeks: 0,
      totalTasks: 0,
      completedTasks: 0,
      progressPercent: 0,
    };
  }

  const weeks = course.courseData?.weeks ?? [];
  const totalTasks = weeks.reduce((sum, week) => sum + week.tasks.length, 0);
  const completedTasks = Math.min(countCompletedProgressItems(course.progressData), totalTasks || Number.MAX_SAFE_INTEGER);

  return {
    status: course.status,
    hasCourse: Boolean(course.courseData),
    title: course.courseData?.title ?? null,
    focus: course.courseData?.focus ?? null,
    totalWeeks: weeks.length,
    totalTasks,
    completedTasks,
    progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

export function buildVirtualMorningPagesReminder(
  agent: Pick<AgentHomeRow, 'id' | 'username'>,
  summary: MorningPagesSummary,
  now = new Date()
): AgentReminder | null {
  if (!summary.dueToday) return null;

  return {
    id: `virtual:morning-pages:${agent.id}:${dateKey(now)}`,
    agentId: agent.id,
    agentUsername: agent.username,
    kind: 'morning_pages',
    message: `Morning pages due - keep the ${summary.currentStreak}-day streak.`,
    dueAt: null,
    createdAt: now.toISOString(),
    virtual: true,
  };
}
