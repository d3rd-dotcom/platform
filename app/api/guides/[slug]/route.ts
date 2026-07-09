import { NextResponse } from 'next/server';
import { requireVip } from '@/lib/guide-api-auth';
import {
  getGuideBySlug,
  getGuideMethods,
  getDirectPrereqs,
  getDirectDependents,
  getWalkthrough,
  updateGuide,
  type GuideBodyComponent,
} from '@/lib/guides-db';
import type { GuideDetailResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const guide = await getGuideBySlug(params.slug);
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }

    // Published guides are public reading. Unpublished/draft/etc. are visible to
    // their author alone (mirrors the VIP course-by-slug convention).
    if (guide.status !== 'published') {
      const { userId } = await requireVip(_request);
      if (guide.authorId !== userId) {
        return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
      }
    }

    const [methods, prereqs, dependents, walkthrough] = await Promise.all([
      getGuideMethods(guide.id),
      getDirectPrereqs(guide.id),
      getDirectDependents(guide.id),
      getWalkthrough(guide.id),
    ]);

    // The guide's own level = height of its prerequisite closure (1-based).
    const level = Math.max(walkthrough?.levels ?? 1, 1);

    return NextResponse.json(
      { guide, methods, prereqs, dependents, level } satisfies GuideDetailResponse,
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * PATCH /api/guides/[slug] — author edits their own draft (topic title, body,
 * subjects). VIP-gated (requireVip) and author-only, mirroring the create
 * route. Published guides are locked here: once verified, edits flow through
 * the verification/revision path, not free editing.
 *
 * Body: { topicTitle?, body?, subjects? }
 */
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  try {
    const { userId } = await requireVip(request);

    const guide = await getGuideBySlug(params.slug);
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }
    if (guide.authorId !== userId) {
      return NextResponse.json(
        { error: 'Only the author can edit this guide.' },
        { status: 403 },
      );
    }
    if (guide.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft guides can be edited. This guide is already in review or published.' },
        { status: 409 },
      );
    }

    const raw = (await request.json().catch(() => ({}))) as {
      topicTitle?: unknown;
      topicAliases?: unknown;
      summary?: unknown;
      intendedAudience?: unknown;
      estimatedMinutes?: unknown;
      sourceProvenance?: unknown;
      sourceReviewedAt?: unknown;
      body?: unknown;
      subjects?: unknown;
      subjectIds?: unknown;
      evidenceCriteria?: unknown;
    };

    const patch: {
      id: string;
      topicTitle?: string;
      topicAliases?: string[];
      summary?: string;
      intendedAudience?: string;
      estimatedMinutes?: number | null;
      sourceProvenance?: string;
      sourceReviewedAt?: string | null;
      body?: GuideBodyComponent[];
      subjects?: string[];
      subjectIds?: string[];
      evidenceCriteria?: string[];
    } = { id: guide.id };

    if (raw.topicTitle !== undefined) {
      if (typeof raw.topicTitle !== 'string' || !raw.topicTitle.trim()) {
        return NextResponse.json({ error: 'topicTitle must be a non-empty string.' }, { status: 400 });
      }
      patch.topicTitle = raw.topicTitle.trim();
    }
    if (raw.topicAliases !== undefined) {
      if (
        !Array.isArray(raw.topicAliases) ||
        raw.topicAliases.length > 12 ||
        raw.topicAliases.some((alias) => typeof alias !== 'string')
      ) {
        return NextResponse.json(
          { error: 'topicAliases must contain up to 12 strings.' },
          { status: 400 },
        );
      }
      patch.topicAliases = raw.topicAliases as string[];
    }
    if (raw.summary !== undefined) {
      if (typeof raw.summary !== 'string' || raw.summary.trim().length > 280) {
        return NextResponse.json(
          { error: 'summary must be 280 characters or fewer.' },
          { status: 400 },
        );
      }
      patch.summary = raw.summary;
    }
    if (raw.intendedAudience !== undefined) {
      if (
        typeof raw.intendedAudience !== 'string' ||
        raw.intendedAudience.trim().length > 280
      ) {
        return NextResponse.json(
          { error: 'intendedAudience must be 280 characters or fewer.' },
          { status: 400 },
        );
      }
      patch.intendedAudience = raw.intendedAudience;
    }
    if (raw.estimatedMinutes !== undefined) {
      if (
        raw.estimatedMinutes !== null &&
        (
          typeof raw.estimatedMinutes !== 'number' ||
          !Number.isInteger(raw.estimatedMinutes) ||
          raw.estimatedMinutes < 1 ||
          raw.estimatedMinutes > 600
        )
      ) {
        return NextResponse.json(
          { error: 'estimatedMinutes must be a whole number from 1 to 600.' },
          { status: 400 },
        );
      }
      patch.estimatedMinutes = raw.estimatedMinutes as number | null;
    }
    if (raw.sourceProvenance !== undefined) {
      if (
        typeof raw.sourceProvenance !== 'string' ||
        raw.sourceProvenance.trim().length > 4000
      ) {
        return NextResponse.json(
          { error: 'sourceProvenance must be 4,000 characters or fewer.' },
          { status: 400 },
        );
      }
      patch.sourceProvenance = raw.sourceProvenance;
    }
    if (raw.sourceReviewedAt !== undefined) {
      if (
        raw.sourceReviewedAt !== null &&
        (
          typeof raw.sourceReviewedAt !== 'string' ||
          !isValidDateOnly(raw.sourceReviewedAt)
        )
      ) {
        return NextResponse.json(
          { error: 'sourceReviewedAt must be a valid date.' },
          { status: 400 },
        );
      }
      patch.sourceReviewedAt = raw.sourceReviewedAt as string | null;
    }
    if (raw.body !== undefined) {
      if (!Array.isArray(raw.body)) {
        return NextResponse.json({ error: 'body must be an array of components.' }, { status: 400 });
      }
      patch.body = raw.body as GuideBodyComponent[];
    }
    if (raw.subjects !== undefined) {
      if (!Array.isArray(raw.subjects) || raw.subjects.some((s) => typeof s !== 'string')) {
        return NextResponse.json({ error: 'subjects must be an array of strings.' }, { status: 400 });
      }
      patch.subjects = raw.subjects as string[];
    }
    if (raw.subjectIds !== undefined) {
      if (
        !Array.isArray(raw.subjectIds) ||
        raw.subjectIds.length > 12 ||
        raw.subjectIds.some((subjectId) => typeof subjectId !== 'string')
      ) {
        return NextResponse.json(
          { error: 'subjectIds must contain up to 12 strings.' },
          { status: 400 },
        );
      }
      patch.subjectIds = raw.subjectIds as string[];
    }
    if (raw.evidenceCriteria !== undefined) {
      if (
        !Array.isArray(raw.evidenceCriteria) ||
        raw.evidenceCriteria.some((c) => typeof c !== 'string')
      ) {
        return NextResponse.json(
          { error: 'evidenceCriteria must be an array of strings.' },
          { status: 400 },
        );
      }
      patch.evidenceCriteria = raw.evidenceCriteria as string[];
    }

    const updated = await updateGuide(patch);
    return NextResponse.json({ guide: updated });
  } catch (err: any) {
    // Unique violation on topic_title
    if (err?.code === '23505') {
      return NextResponse.json(
        { error: 'A guide with that topic already exists.' },
        { status: 409 },
      );
    }
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
