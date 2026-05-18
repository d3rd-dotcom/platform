import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { getAgentHomeRow, isAgentOperator } from '@/lib/agent-home';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string; reminderId: string } }
) {
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

    if (params.reminderId.startsWith('virtual:')) {
      return NextResponse.json({ error: 'Automatic reminders clear when the condition is resolved.' }, { status: 400 });
    }

    const rows = await sqlQuery<Array<{ id: string }>>(
      `UPDATE agent_reminders
       SET dismissed_at = CURRENT_TIMESTAMP
       WHERE id = :reminderId
         AND agent_user_id = :agentId
         AND dismissed_at IS NULL
       RETURNING id`,
      { reminderId: params.reminderId, agentId: agent.id }
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Reminder not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Agent reminder dismiss error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to dismiss reminder.' }, { status: 500 });
  }
}
