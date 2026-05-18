import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureGeneratedTestsSchema } from '@/lib/ensureGeneratedTestsSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import {
  buildVirtualMorningPagesReminder,
  loadAgentAllWeekPages,
  loadAgentCourseSummary,
  summarizeMorningPages,
  type AgentReminder,
  type AgentCourseSummary,
  type MorningPagesSummary,
} from '@/lib/agent-home';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]
 * Per-agent detail for the owning operator: identity, shard balance, quests
 * completed, and tests/questions taken.
 */
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
    const operatorWallet = rawOperator.trim().toLowerCase();

    const agentId = params.id;
    const rows = await sqlQuery<
      Array<{
        id: string;
        username: string;
        wallet_address: string;
        agent_bio: string | null;
        avatar_url: string | null;
        shard_count: number;
        created_at: string;
        account_type: string | null;
        operator_wallet: string | null;
        custodial: boolean;
      }>
    >(
      `SELECT u.id, u.username, u.wallet_address, u.agent_bio, u.avatar_url,
              u.shard_count, u.created_at, u.account_type, u.operator_wallet,
              (k.user_id IS NOT NULL) AS custodial
       FROM users u
       LEFT JOIN agent_wallet_keys k ON k.user_id = u.id
       WHERE u.id = :id LIMIT 1`,
      { id: agentId }
    );
    const agent = rows[0];
    if (!agent || agent.account_type !== 'agent') {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }
    if ((agent.operator_wallet ?? '').toLowerCase() !== operatorWallet) {
      return NextResponse.json(
        { error: 'You are not the operator of this agent.' },
        { status: 403 }
      );
    }

    const quests = await sqlQuery<
      Array<{ quest_id: string; completed_at: string; shards_awarded: number }>
    >(
      `SELECT quest_id, completed_at, shards_awarded
       FROM quests WHERE user_id = :id ORDER BY completed_at DESC`,
      { id: agentId }
    );

    // Tests are tracked in a separate schema — non-fatal if it is unavailable.
    let tests: Array<{
      id: string;
      title: string;
      persona: string;
      difficulty: number;
      shardReward: number;
      completedAt: string | null;
      createdAt: string;
    }> = [];
    try {
      await ensureGeneratedTestsSchema();
      const testRows = await sqlQuery<
        Array<{
          id: string;
          title: string;
          persona: string;
          difficulty: number;
          shard_reward: number;
          completed_at: string | null;
          created_at: string;
        }>
      >(
        `SELECT id, title, persona, difficulty, shard_reward, completed_at, created_at
         FROM generated_tests WHERE user_id = :id ORDER BY created_at DESC`,
        { id: agentId }
      );
      tests = testRows.map((t) => ({
        id: t.id,
        title: t.title,
        persona: t.persona,
        difficulty: t.difficulty,
        shardReward: t.shard_reward,
        completedAt: t.completed_at,
        createdAt: t.created_at,
      }));
    } catch (err: any) {
      console.warn('Agent detail: could not load tests:', err?.message);
    }

    let morningPages: MorningPagesSummary = {
      totalEntries: 0,
      currentStreak: 0,
      lastEntryDate: null,
      hasEntryToday: false,
      dueToday: false,
      completedDays: [false, false, false, false, false],
      currentWeek: 1,
    };
    try {
      const allWeekPages = await loadAgentAllWeekPages(agent.id);
      morningPages = summarizeMorningPages(allWeekPages);
    } catch (err: any) {
      console.warn('Agent detail: could not load morning-pages summary:', err?.message);
    }
    const virtualReminder = buildVirtualMorningPagesReminder(agent, morningPages);
    const reminders: AgentReminder[] = virtualReminder ? [virtualReminder] : [];

    let course: AgentCourseSummary = {
      status: 'not_started',
      hasCourse: false,
      title: null,
      focus: null,
      totalWeeks: 0,
      totalTasks: 0,
      completedTasks: 0,
      progressPercent: 0,
    };
    try {
      course = await loadAgentCourseSummary(agent.id);
    } catch (err: any) {
      console.warn('Agent detail: could not load course summary:', err?.message);
    }

    return NextResponse.json({
      agent: {
        id: agent.id,
        username: agent.username,
        walletAddress: agent.wallet_address,
        bio: agent.agent_bio,
        avatarUrl: agent.avatar_url,
        shardCount: agent.shard_count,
        createdAt: agent.created_at,
        walletMode: agent.custodial ? 'custodial' : 'self',
      },
      progress: {
        questsCompleted: quests.length,
        testsCompleted: tests.filter((t) => t.completedAt).length,
        morningPagesCompleted: morningPages.totalEntries,
        courseTasksCompleted: course.completedTasks,
      },
      morningPages,
      course,
      reminders,
      quests: quests.map((q) => ({
        questId: q.quest_id,
        completedAt: q.completed_at,
        shardsAwarded: q.shards_awarded,
      })),
      tests,
    });
  } catch (err: any) {
    console.error('Agent detail error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load agent detail.' }, { status: 500 });
  }
}
