import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { createCourseComponent } from '@/lib/vip-course-db';
import type { ComponentType } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_COMPONENT_TYPES: ComponentType[] = [
  'rich_text',
  'multiple_choice',
  'dropdown',
  'image_embed',
  'video_embed',
  'file_upload',
  'text_input',
  'rating_scale',
  'reflection_journal',
  'quiz_block',
  'markdown_file',
];

async function assertVipUser(): Promise<string> {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw Object.assign(new Error('Sign in to access courses.'), { status: 401 });
  }
  const hasMembership = await walletHoldsVipMembershipCard(user.walletAddress);
  if (!hasMembership) {
    throw Object.assign(new Error('A VIP membership is required.'), { status: 403, code: 'vip_required' });
  }
  return user.id;
}

export async function POST(request: Request, { params }: { params: { id: string; weekId: string } }) {
  try {
    await assertVipUser();
    const body = await request.json() as {
      componentType?: unknown;
      title?: unknown;
      config?: unknown;
      sortOrder?: unknown;
      required?: unknown;
    };

    if (!body.componentType || !VALID_COMPONENT_TYPES.includes(body.componentType as ComponentType)) {
      return NextResponse.json({
        error: `componentType is required. Must be one of: ${VALID_COMPONENT_TYPES.join(', ')}`,
      }, { status: 400 });
    }

    const component = await createCourseComponent({
      weekId: params.weekId,
      componentType: body.componentType as ComponentType,
      title: typeof body.title === 'string' ? body.title : '',
      config: typeof body.config === 'object' && body.config !== null
        ? body.config as Record<string, unknown>
        : {},
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      required: body.required === true,
    });

    return NextResponse.json({ component }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
