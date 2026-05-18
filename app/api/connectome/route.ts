import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getPersonalCourse } from '@/lib/personal-course-db';
import { buildConnectome } from '@/lib/dsm-connectome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/connectome
// Returns the user's DSM symptom-cluster connectome as machine-readable JSON.
// Falls back to the baseline graph for guests or when no intake exists.
export async function GET() {
  let intake;

  if (isDbConfigured()) {
    const user = await getCurrentUserFromRequestCookie();
    if (user) {
      try {
        const course = await getPersonalCourse(user.id);
        intake = course?.intakeData;
      } catch (err) {
        console.error('Connectome intake load error:', err);
      }
    }
  }

  return NextResponse.json(buildConnectome(intake));
}
