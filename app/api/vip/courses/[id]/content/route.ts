import { NextResponse } from 'next/server';
import { assertCourseOwner } from '@/lib/assert-course-auth';
import { replaceCourseContent, type ComponentType } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_COMPONENT_TYPES: ComponentType[] = [
  'rich_text',
  'multiple_choice',
  'media_embed',
  'image_embed',
  'video_embed',
  'file_upload',
  'text_input',
  'rating_scale',
  'reflection_journal',
  'quiz_block',
  'password_gate',
  'mission_container',
];

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCourseOwner(params.id);
    const body = await request.json() as { weeks?: unknown };

    if (!body.weeks || !Array.isArray(body.weeks)) {
      return NextResponse.json({ error: 'weeks array is required.' }, { status: 400 });
    }

    const weeks = body.weeks.map((week: any, idx: number) => {
      if (typeof week.weekNumber !== 'number') {
        throw new Error(`week[${idx}].weekNumber is required and must be a number.`);
      }
      if (!week.title || typeof week.title !== 'string') {
        throw new Error(`week[${idx}].title is required.`);
      }
      if (!Array.isArray(week.components)) {
        throw new Error(`week[${idx}].components must be an array.`);
      }
      const components = week.components.map((comp: any, ci: number) => {
        if (!comp.componentType || !VALID_COMPONENT_TYPES.includes(comp.componentType)) {
          throw new Error(
            `week[${idx}].components[${ci}].componentType is required. Must be one of: ${VALID_COMPONENT_TYPES.join(', ')}`,
          );
        }
        const blocks = Array.isArray(comp.blocks)
          ? comp.blocks.map((block: any, bi: number) => {
              if (!block.blockType || !VALID_COMPONENT_TYPES.includes(block.blockType)) {
                throw new Error(
                  `week[${idx}].components[${ci}].blocks[${bi}].blockType is required. Must be one of: ${VALID_COMPONENT_TYPES.join(', ')}`,
                );
              }
              return {
                blockType: block.blockType as ComponentType,
                config: typeof block.config === 'object' && block.config !== null ? block.config as Record<string, unknown> : {},
                sortOrder: typeof block.sortOrder === 'number' ? block.sortOrder : bi,
                required: block.required === true,
              };
            })
          : [];
        return {
          componentType: comp.componentType as ComponentType,
          title: typeof comp.title === 'string' ? comp.title : '',
          config: typeof comp.config === 'object' && comp.config !== null ? comp.config as Record<string, unknown> : {},
          sortOrder: typeof comp.sortOrder === 'number' ? comp.sortOrder : ci,
          required: comp.required === true,
          blocks,
        };
      });
      return {
        weekNumber: week.weekNumber,
        title: week.title.trim(),
        theme: typeof week.theme === 'string' ? week.theme.trim() : '',
        sortOrder: typeof week.sortOrder === 'number' ? week.sortOrder : idx,
        components,
      };
    });

    const course = await replaceCourseContent(params.id, weeks);
    return NextResponse.json({ course });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
