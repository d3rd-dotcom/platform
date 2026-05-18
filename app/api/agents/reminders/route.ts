import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import {
  AgentReminder,
  AgentReminderKind,
  buildVirtualMorningPagesReminder,
  getOperatorAgentRows,
  loadAgentAllWeekPages,
  normalizeWallet,
  summarizeMorningPages,
} from '@/lib/agent-home';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OperatorReminderRow = {
  id: string;
  agent_user_id: string;
  agent_username: string;
  kind: string;
  message: string;
  due_at: string | null;
  created_at: string;
};

function normalizeKind(kind: string): AgentReminderKind {
  return kind === 'morning_pages' ? 'morning_pages' : 'custom';
}

function mapStoredReminder(row: OperatorReminderRow): AgentReminder {
  return {
    id: row.id,
    agentId: row.agent_user_id,
    agentUsername: row.agent_username,
    kind: normalizeKind(row.kind),
    message: row.message,
    dueAt: row.due_at,
    createdAt: row.created_at,
    virtual: false,
  };
}

export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
    }
    await ensureForumSchema();

    const rawOperator = await getWalletAddressFromRequest();
    if (!rawOperator) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    const operatorWallet = normalizeWallet(rawOperator);

    const agents = await getOperatorAgentRows(operatorWallet);

    const rows = await sqlQuery<OperatorReminderRow[]>(
      `SELECT r.id, r.agent_user_id, u.username AS agent_username,
              r.kind, r.message, r.due_at, r.created_at
       FROM agent_reminders r
       INNER JOIN users u ON u.id = r.agent_user_id
       WHERE LOWER(r.operator_wallet) = LOWER(:operatorWallet)
         AND r.dismissed_at IS NULL
         AND u.account_type = 'agent'
       ORDER BY COALESCE(r.due_at, r.created_at) ASC, r.created_at DESC`,
      { operatorWallet }
    );

    const reminders = rows.map(mapStoredReminder);

    for (const agent of agents) {
      try {
        const allWeekPages = await loadAgentAllWeekPages(agent.id);
        const virtualReminder = buildVirtualMorningPagesReminder(
          agent,
          summarizeMorningPages(allWeekPages)
        );
        if (virtualReminder) reminders.unshift(virtualReminder);
      } catch (err: any) {
        console.warn('Agent reminders feed: could not compute morning-pages reminder:', err?.message);
      }
    }

    const countsByAgent = reminders.reduce<Record<string, number>>((acc, reminder) => {
      acc[reminder.agentId] = (acc[reminder.agentId] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ reminders, countsByAgent });
  } catch (err: any) {
    console.error('Agent reminders feed error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load reminders.' }, { status: 500 });
  }
}
