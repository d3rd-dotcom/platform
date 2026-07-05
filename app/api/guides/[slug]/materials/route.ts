import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getGuideBySlug } from '@/lib/guides-db';
import {
  getMaterialsForGuide,
  addMaterial,
  removeMaterial,
  type MaterialLinkType,
} from '@/lib/guide-materials-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/[slug]/materials — public list of a guide's materials, in the
 * author-defined display order. No auth (contextual marketplace is public).
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const guide = await getGuideBySlug(params.slug);
  if (!guide) {
    return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  }
  const materials = await getMaterialsForGuide(guide.id);
  return NextResponse.json({ materials });
}

/**
 * POST /api/guides/[slug]/materials — add a material to a guide. Auth via Privy
 * cookie (same pattern as app/api/guides/[slug]/vote/route.ts). Only the guide's
 * author may add: we compare guide.authorId to the caller's user id.
 *
 * Body: { name, linkUrl, linkType?, rationale, imageUrl?, priceLabel?, sortOrder? }
 * rationale must be a real justification (>= 40 chars, DB-enforced; surfaced 400).
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const guide = await getGuideBySlug(params.slug);
  if (!guide) {
    return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  }
  // Only the guide's author may attach materials (contextual matching is the
  // author's editorial call; verifiers review it downstream).
  if (guide.authorId !== user.id) {
    return NextResponse.json(
      { error: 'Only the guide author can add materials.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    linkUrl?: unknown;
    linkType?: unknown;
    rationale?: unknown;
    imageUrl?: unknown;
    priceLabel?: unknown;
    sortOrder?: unknown;
  };

  if (typeof body.name !== 'string' || typeof body.linkUrl !== 'string') {
    return NextResponse.json(
      { error: 'name and linkUrl are required.' },
      { status: 400 },
    );
  }
  if (typeof body.rationale !== 'string') {
    return NextResponse.json(
      { error: 'rationale is required — explain how the guide uses this material.' },
      { status: 400 },
    );
  }

  const linkType: MaterialLinkType =
    body.linkType === 'internal_shop' ? 'internal_shop' : 'external';

  try {
    const material = await addMaterial({
      guideId: guide.id,
      name: body.name,
      linkUrl: body.linkUrl,
      linkType,
      rationale: body.rationale,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
      priceLabel: typeof body.priceLabel === 'string' ? body.priceLabel : null,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
    });
    return NextResponse.json({ ok: true, material }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * DELETE /api/guides/[slug]/materials — remove a material. Author only.
 *
 * Body: { materialId: string }
 */
export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const guide = await getGuideBySlug(params.slug);
  if (!guide) {
    return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  }
  if (guide.authorId !== user.id) {
    return NextResponse.json(
      { error: 'Only the guide author can remove materials.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { materialId?: unknown };
  if (typeof body.materialId !== 'string' || !body.materialId.trim()) {
    return NextResponse.json({ error: 'materialId is required.' }, { status: 400 });
  }

  const { removed } = await removeMaterial(guide.id, body.materialId.trim());
  if (!removed) {
    return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
