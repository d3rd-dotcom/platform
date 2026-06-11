import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { isStorageConfigured, uploadPublicObject } from '@/lib/supabase-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = process.env.SUPABASE_PROOF_BUCKET || 'quest-proofs';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Proof artifacts: images, PDFs, short clips, and common docs. Maps MIME → ext.
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/**
 * POST /api/quests/proof/upload  (multipart form-data: file)
 * Auth-gated. Stores a proof artifact in the public Supabase Storage bucket and
 * returns its URL for the submitter to attach to a quest proof.
 */
export async function POST(request: Request) {
  const rl = checkRateLimit({
    max: 8,
    windowMs: 60 * 1000,
    identifier: `proof-upload:${getClientIdentifier(request)}`,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please try again in a moment.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'File uploads are not enabled yet. Paste a link to your work instead.' },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 10MB.` },
      { status: 413 },
    );
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload an image, PDF, doc, or short video.' },
      { status: 415 },
    );
  }

  try {
    const data = await file.arrayBuffer();
    const { url } = await uploadPublicObject({ bucket: BUCKET, data, contentType: file.type, ext });
    return NextResponse.json({
      url,
      name: file.name || `proof.${ext}`,
      mime: file.type,
      size: file.size,
    });
  } catch (err) {
    console.error('Proof upload failed:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 502 });
  }
}
