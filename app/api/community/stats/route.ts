import { NextResponse } from 'next/server';
import { isDbConfigured, sqlQuery } from '@/lib/db';

type RegisteredCountRow = { count: string | number };

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ registeredAccounts: 0 });
  }

  try {
    const rows = await sqlQuery<RegisteredCountRow[]>(
      `SELECT COUNT(*)::bigint AS count FROM users`,
    );

    const rawCount = rows?.[0]?.count ?? 0;
    const registeredAccounts = Number(rawCount);

    return NextResponse.json({
      registeredAccounts: Number.isFinite(registeredAccounts) ? registeredAccounts : 0,
    });
  } catch (error) {
    console.error('Community stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch community stats' }, { status: 500 });
  }
}
