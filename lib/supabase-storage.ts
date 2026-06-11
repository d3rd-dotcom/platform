import { v4 as uuidv4 } from 'uuid';

/**
 * Minimal server-only Supabase Storage client.
 *
 * Uploads go through the Storage REST API with the service-role key — no
 * `@supabase/supabase-js` dependency, consistent with the rest of the app
 * talking to Supabase over raw connections (see lib/db.ts). Files land in a
 * PUBLIC bucket so reviewers can open them by URL; paths are random UUIDs so
 * they are effectively unguessable.
 *
 * Setup (one-time, in the Supabase dashboard):
 *   1. Storage → New bucket → name it (default: `quest-proofs`) → mark Public.
 *   2. Add env `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role key).
 *      `SUPABASE_URL` is optional — it is derived from DATABASE_URL when unset.
 */

function projectUrl(): string | null {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/+$/, '');
  // Derive from the Supabase pooler DATABASE_URL, whose username is
  // `postgres.<project-ref>` — the ref maps to https://<ref>.supabase.co.
  const match = (process.env.DATABASE_URL || '').match(/postgres\.([a-z0-9]+)[:.]/i);
  return match ? `https://${match[1]}.supabase.co` : null;
}

function serviceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function isStorageConfigured(): boolean {
  return Boolean(projectUrl() && serviceKey());
}

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload raw bytes to a public bucket and return the public URL. Throws if
 * Storage is not configured or the upload fails.
 */
export async function uploadPublicObject(params: {
  bucket: string;
  data: ArrayBuffer;
  contentType: string;
  ext: string;
}): Promise<UploadResult> {
  const base = projectUrl();
  const key = serviceKey();
  if (!base || !key) {
    throw new Error('Supabase Storage is not configured.');
  }

  const path = `${uuidv4()}.${params.ext}`;
  const res = await fetch(`${base}/storage/v1/object/${params.bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': params.contentType,
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body: params.data,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Storage upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  return {
    url: `${base}/storage/v1/object/public/${params.bucket}/${path}`,
    path,
  };
}
