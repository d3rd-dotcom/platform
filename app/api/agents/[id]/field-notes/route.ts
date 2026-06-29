import { NextRequest, NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import {
  getAgentHomeRow,
  getMorningPagesWeek,
  isAgentOperator,
  loadAgentAllWeekPages,
} from '@/lib/agent-home';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]/field-notes?week=N
 * Operator view of one week of an agent's encrypted field notes. The server
 * decrypts with the agent user id after confirming operator ownership.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const weekParam = Number(request.nextUrl.searchParams.get('week'));
    const allWeekPages = await loadAgentAllWeekPages(agent.id);
    const week = getMorningPagesWeek(allWeekPages, weekParam);

    return NextResponse.json(week);
  } catch (err: any) {
    console.error('Agent field notes error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load agent field notes.' }, { status: 500 });
  }
}
