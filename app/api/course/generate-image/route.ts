import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getPersonalCourse, updateWeekImage } from '@/lib/personal-course-db';
import { fallbackStoryArt, generateStoryImage } from '@/lib/personal-course';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { weekNumber?: unknown; imagePrompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const weekNumber = typeof body.weekNumber === 'number' ? Math.floor(body.weekNumber) : NaN;
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 4) {
    return NextResponse.json({ error: 'weekNumber must be 1-4' }, { status: 400 });
  }

  let prompt = typeof body.imagePrompt === 'string' ? body.imagePrompt.trim().slice(0, 1200) : '';

  // For signed-in users, prefer the stored prompt and persist the result.
  let userId: string | null = null;
  if (isDbConfigured()) {
    try {
      const user = await getCurrentUserFromRequestCookie();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  if (userId) {
    try {
      const record = await getPersonalCourse(userId);
      const week = record?.courseData?.weeks.find((w) => w.weekNumber === weekNumber);
      if (week) {
        if (week.story.imageUrl) {
          return NextResponse.json({ imageUrl: week.story.imageUrl, generated: false });
        }
        if (week.story.imagePrompt) prompt = week.story.imagePrompt;
      }
    } catch {
      // fall through to the prompt from the request body
    }
  }

  if (!prompt) {
    return NextResponse.json({ error: 'imagePrompt is required' }, { status: 400 });
  }

  let imageUrl: string | null = null;
  let generated = false;
  try {
    imageUrl = await generateStoryImage({
      prompt,
      userId: userId ?? 'guest',
      weekNumber,
    });
    generated = imageUrl !== null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'image generation failed';
    console.warn('Story image generation failed, using fallback art:', msg);
  }

  if (!imageUrl) {
    imageUrl = fallbackStoryArt(weekNumber);
  }

  if (userId) {
    try {
      await updateWeekImage(userId, weekNumber, imageUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'failed to persist image';
      console.error('updateWeekImage error:', msg);
    }
  }

  return NextResponse.json({ imageUrl, generated });
}
