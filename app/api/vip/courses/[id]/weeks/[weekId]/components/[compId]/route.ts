import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { updateCourseComponent, deleteCourseComponent } from '@/lib/vip-course-db';
import type { ComponentType } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_COMPONENT_TYPES: ComponentType[] = [
  'rich_text',
  'multiple_choice',
  'image_embed',
  'video_embed',
  'file_upload',
  'text_input',
  'rating_scale',
  'reflection_journal',
  'quiz_block',
  'password_gate',
];

export async function PATCH(request: Request, { params }: { params: { id: string; weekId: string; compId: string } }) {
  try {
    await assertCourseUser();
    const body = await request.json() as Record<string, unknown>;
    const input: Record<string, unknown> = {};

    if (body.componentType !== undefined) {
      if (!VALID_COMPONENT_TYPES.includes(body.componentType as ComponentType)) {
        return NextResponse.json({
          error: `Invalid componentType. Must be one of: ${VALID_COMPONENT_TYPES.join(', ')}`,
        }, { status: 400 });
      }
      input.componentType = body.componentType;
    }
    if (body.title !== undefined) {
      input.title = typeof body.title === 'string' ? body.title : '';
    }
    if (body.config !== undefined) {
      if (typeof body.config !== 'object' || body.config === null) {
        return NextResponse.json({ error: 'config must be an object.' }, { status: 400 });
      }
      input.config = body.config;
    }
    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== 'number') {
        return NextResponse.json({ error: 'Invalid sortOrder.' }, { status: 400 });
      }
      input.sortOrder = body.sortOrder;
    }
    if (body.required !== undefined) {
      input.required = body.required === true;
    }

    const component = await updateCourseComponent(params.compId, input);
    if (!component) {
      return NextResponse.json({ error: 'Component not found.' }, { status: 404 });
    }
    return NextResponse.json({ component });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string; weekId: string; compId: string } }) {
  try {
    await assertCourseUser();
    const deleted = await deleteCourseComponent(params.compId);
    if (!deleted) {
      return NextResponse.json({ error: 'Component not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
