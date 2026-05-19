import { NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_EXTRACTED_TEXT_LENGTH = 12000;

const IMAGE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

type FileKind = 'image' | 'text';

/**
 * Classify an upload. Text files (.txt/.md) are matched by extension first
 * because browsers report Markdown's MIME type inconsistently (often empty
 * or text/x-markdown). Images are matched by MIME type.
 */
function classify(file: File): { ext: string; mime: string; kind: FileKind } | null {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.md')) return { ext: 'md', mime: 'text/markdown', kind: 'text' };
  if (name.endsWith('.txt')) return { ext: 'txt', mime: 'text/plain', kind: 'text' };
  if (file.type === 'text/markdown' || file.type === 'text/x-markdown') {
    return { ext: 'md', mime: 'text/markdown', kind: 'text' };
  }
  if (file.type === 'text/plain') return { ext: 'txt', mime: 'text/plain', kind: 'text' };
  if (IMAGE_EXT[file.type]) return { ext: IMAGE_EXT[file.type], mime: file.type, kind: 'image' };
  return null;
}

export async function POST(request: Request) {
  const rlResult = checkRateLimit({
    max: 5,
    windowMs: 60 * 1000,
    identifier: `upload:${getClientIdentifier(request)}`,
  });
  if (!rlResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rlResult) }
    );
  }

  // SECURITY: Require authentication
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB` },
      { status: 413 }
    );
  }

  const classified = classify(file);
  if (!classified) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload a .txt or .md text file, or a PNG/JPEG/GIF/WebP image.' },
      { status: 415 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Store under /public/uploads so it can be served at /uploads/...
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${uuidv4()}.${classified.ext}`;
  await writeFile(path.join(uploadsDir, filename), bytes);

  // Text files are read straight into extractedText so Blue can use them as
  // source material. Images carry no extracted text.
  const extractedText = classified.kind === 'text'
    ? bytes.toString('utf-8').slice(0, MAX_EXTRACTED_TEXT_LENGTH).trim() || null
    : null;

  return NextResponse.json({
    url: `/uploads/${filename}`,
    name: path.basename(file.name || `upload.${classified.ext}`),
    mime: classified.mime,
    size: file.size,
    extractedText,
  });
}
