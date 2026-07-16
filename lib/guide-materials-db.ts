import { sqlQuery } from './db';

// ============================================================================
// Guide materials — contextual marketplace (BlueLearn integration — Phase 6)
// ----------------------------------------------------------------------------
// Reads/writes the guide_materials table created in
// db/migration-guide-materials.sql. Each material justifies how a guide uses it
// (rationale is required + length-checked at the DB level). Does NOT touch
// lib/guides-db.ts or any other lib/guide-*.ts file. Author-or-admin
// authorization is enforced by the API route, not here — these functions assume
// the caller already checked.
// ============================================================================

// ── Types ────────────────────────────────────────────────────────────────────

export type MaterialLinkType = 'internal_shop' | 'external';

export interface GuideMaterial {
  id: string;
  guideId: string;
  name: string;
  imageUrl: string | null;
  linkUrl: string;
  linkType: MaterialLinkType;
  rationale: string;
  priceLabel: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Material-card descriptions are intentionally concise. */
export const MAX_MATERIAL_DESCRIPTION_LENGTH = 30;
export const USDC_PRICE_LABEL_PATTERN = /^\d+(?:\.\d{1,2})? USDC$/;

// ── Row type / mapper ──────────────────────────────────────────────────────

interface GuideMaterialRow {
  id: string;
  guide_id: string;
  name: string;
  image_url: string | null;
  link_url: string;
  link_type: string;
  rationale: string;
  price_label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toMaterial(row: GuideMaterialRow): GuideMaterial {
  return {
    id: row.id,
    guideId: row.guide_id,
    name: row.name,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    linkType: row.link_type === 'internal_shop' ? 'internal_shop' : 'external',
    rationale: row.rationale,
    priceLabel: row.price_label,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** All materials for a guide, in author-defined display order. Public. */
export async function getMaterialsForGuide(guideId: string): Promise<GuideMaterial[]> {
  const rows = await sqlQuery<GuideMaterialRow[]>(
    `SELECT * FROM guide_materials
     WHERE guide_id = :guideId
     ORDER BY sort_order ASC, created_at ASC`,
    { guideId },
  );
  return rows.map(toMaterial);
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface AddMaterialInput {
  guideId: string;
  name: string;
  linkUrl: string;
  linkType: MaterialLinkType;
  rationale: string;
  imageUrl?: string | null;
  priceLabel?: string | null;
  sortOrder?: number;
}

/**
 * Inserts one material for a guide. Author-or-admin authorization is the route's
 * responsibility — this only validates the shape and enforces the contextual
 * description and USDC price rules (surfacing DB checks as clean 400 errors).
 *
 * @throws { status:number } on validation / not-found errors.
 */
export async function addMaterial(input: AddMaterialInput): Promise<GuideMaterial> {
  const name = input.name?.trim();
  const linkUrl = input.linkUrl?.trim();
  const rationale = input.rationale?.trim();
  const linkType: MaterialLinkType =
    input.linkType === 'internal_shop' ? 'internal_shop' : 'external';

  if (!name) {
    throw Object.assign(new Error('A material name is required.'), { status: 400 });
  }
  if (!linkUrl) {
    throw Object.assign(new Error('A link URL is required.'), { status: 400 });
  }
  if (!rationale || rationale.length > MAX_MATERIAL_DESCRIPTION_LENGTH) {
    throw Object.assign(
      new Error(
        `Material descriptions must be 1–${MAX_MATERIAL_DESCRIPTION_LENGTH} characters.`,
      ),
      { status: 400 },
    );
  }

  // Guide must exist (FK would error anyway, but this yields a clean 404).
  const guideRows = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM guides WHERE id = :guideId`,
    { guideId: input.guideId },
  );
  if (!guideRows[0]) {
    throw Object.assign(new Error('Guide not found.'), { status: 404 });
  }

  const imageUrl =
    typeof input.imageUrl === 'string' && input.imageUrl.trim()
      ? input.imageUrl.trim()
      : null;
  const priceLabel =
    typeof input.priceLabel === 'string' && input.priceLabel.trim()
      ? input.priceLabel.trim().slice(0, 64)
      : null;
  if (!priceLabel || !USDC_PRICE_LABEL_PATTERN.test(priceLabel)) {
    throw Object.assign(new Error('Material prices must use the format "8 USDC".'), {
      status: 400,
    });
  }
  const sortOrder = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0;

  try {
    const rows = await sqlQuery<GuideMaterialRow[]>(
      `INSERT INTO guide_materials
         (guide_id, name, image_url, link_url, link_type, rationale, price_label, sort_order)
       VALUES
         (:guideId, :name, :imageUrl, :linkUrl, :linkType, :rationale, :priceLabel, :sortOrder)
       RETURNING *`,
      {
        guideId: input.guideId,
        name: name.slice(0, 160),
        imageUrl,
        linkUrl,
        linkType,
        rationale,
        priceLabel,
        sortOrder,
      },
    );
    return toMaterial(rows[0]);
  } catch (err: any) {
    // DB checks for concise descriptions and USDC price badges.
    if (err?.code === '23514') {
      throw Object.assign(
        new Error(
          `Material descriptions must be 1–${MAX_MATERIAL_DESCRIPTION_LENGTH} characters and prices must use USDC.`,
        ),
        { status: 400 },
      );
    }
    throw err;
  }
}

/**
 * Removes one material by id, scoped to a guide so a stray/mismatched id can't
 * delete another guide's material. Author-or-admin authorization is the route's
 * responsibility. Idempotent — returns whether a row was removed.
 */
export async function removeMaterial(
  guideId: string,
  materialId: string,
): Promise<{ removed: boolean }> {
  const rows = await sqlQuery<Array<{ id: string }>>(
    `DELETE FROM guide_materials
     WHERE id = :materialId AND guide_id = :guideId
     RETURNING id`,
    { materialId, guideId },
  );
  return { removed: rows.length > 0 };
}
