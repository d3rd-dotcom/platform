import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { listGuideSubjectCatalog } from '@/lib/guides-db';
import type { GuideSubjectsResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const subjects = await listGuideSubjectCatalog();
    return NextResponse.json({ subjects } satisfies GuideSubjectsResponse);
  } catch {
    return NextResponse.json(
      { error: 'Could not load the subject catalog.' },
      { status: 500 },
    );
  }
}
