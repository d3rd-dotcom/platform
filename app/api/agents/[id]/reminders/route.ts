import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import {
  AgentReminder,
  AgentReminderKind,
  buildVirtualMorningPagesReminder,
  getAgentHomeRow,
  isAgentOperator,
  isAgentWallet,
  loadAgentAllWeekPages,
  normalizeWallet,
  summarizeMorningPages,
} from '@/lib/agent-home';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReminderRow = {
  id: string;
  kind: string;
  message: string;
  due_at: string | null;
  created_at: string;
};

function normalizeKind(kind: unknown): AgentReminderKind {
  return kind === 'field_notes' ? 'field_notes' : 'custom';
}

function parseDueAt(rawDueAt: unknown): string | null | 'invalid' {
  if (rawDueAt == null || rawDueAt === '') return null;
  if (typeof rawDueAt !== 'string') return 'invalid';
  const dueAt = new Date(rawDueAt);
  if (Number.isNaN(dueAt.getTime())) return 'invalid';
  return dueAt.toISOString();
}

function mapStoredReminder(row: ReminderRow, agentId: string, agentUsername?: string): AgentReminder {
  return {
    id: row.id,
    agentId,
    agentUsername,
    kind: normalizeKind(row.kind),
    message: row.message,
    dueAt: row.due_at,
    createdAt: row.created_at,
    virtual: false,
  };
}

async function loadStoredReminders(agentId: string, agentUsername: string) {
  const rows = await sqlQuery<ReminderRow[]>(
    `SELECT id, kind, message, due_at, created_at
     FROM agent_reminders
     WHERE agent_user_id = :agentId AND dismissed_at IS NULL
     ORDER BY COALESCE(due_at, created_at) ASC, created_at DESC`,
    { agentId }
  );

  return rows.map((row) => mapStoredReminder(row, agentId, agentUsername));
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
    }
    await ensureForumSchema();

    const rawOperator = await getWalletAddressFromRequest();
    if (!rawOperator) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const agent = await getAgentHomeRow(params.id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }
    if (!isAgentOperator(agent, rawOperator)) {
      return NextResponse.json({ error: 'You are not the operator of this agent.' }, { status: 403 });
    }

    const reminders = await loadStoredReminders(agent.id, agent.username);

    try {
      const allWeekPages = await loadAgentAllWeekPages(agent.id);
      const virtualReminder = buildVirtualMorningPagesReminder(
        agent,
        summarizeMorningPages(allWeekPages)
      );
      if (virtualReminder) reminders.unshift(virtualReminder);
    } catch (err: any) {
      console.warn('Agent reminders: could not compute field-notes reminder:', err?.message);
    }

    return NextResponse.json({ reminders });
  } catch (err: any) {
    console.error('Agent reminders load error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load reminders.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
    }
    await ensureForumSchema();

    const callerWallet = await getWalletAddressFromRequest();
    if (!callerWallet) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const agent = await getAgentHomeRow(params.id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }
    if (!isAgentOperator(agent, callerWallet) && !isAgentWallet(agent, callerWallet)) {
      return NextResponse.json({ error: 'You cannot create reminders for this agent.' }, { status: 403 });
    }
    if (!agent.operator_wallet) {
      return NextResponse.json({ error: 'Agent has no operator wallet.' }, { status: 409 });
    }

    let body: { message?: unknown; kind?: unknown; dueAt?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
    if (!message) {
      return NextResponse.json({ error: 'Reminder message is required.' }, { status: 400 });
    }

    const dueAt = parseDueAt(body.dueAt);
    if (dueAt === 'invalid') {
      return NextResponse.json({ error: 'Invalid dueAt value.' }, { status: 400 });
    }

    const id = randomUUID();
    const kind = normalizeKind(body.kind);
    const rows = await sqlQuery<ReminderRow[]>(
      `INSERT INTO agent_reminders (id, agent_user_id, operator_wallet, kind, message, due_at)
       VALUES (:id, :agentUserId, :operatorWallet, :kind, :message, :dueAt)
       RETURNING id, kind, message, due_at, created_at`,
      {
        id,
        agentUserId: agent.id,
        operatorWallet: normalizeWallet(agent.operator_wallet),
        kind,
        message,
        dueAt,
      }
    );

    return NextResponse.json(
      { reminder: mapStoredReminder(rows[0], agent.id, agent.username) },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Agent reminder create error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create reminder.' }, { status: 500 });
  }
}
