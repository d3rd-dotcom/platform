import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureBlueListsSchema } from '@/lib/ensureBlueListsSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIST_KEYS = ['todo', 'watch', 'later'] as const;
type ListKey = (typeof LIST_KEYS)[number];

const MAX_CONTENT = 500;
const MAX_ITEMS_PER_LIST = 200;

// Postgres throws on a malformed uuid literal; screen ids before they reach it.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ListItemRow {
  id: string;
  list_key: ListKey;
  content: string;
  done: boolean;
  created_at: string;
}

function isListKey(value: unknown): value is ListKey {
  return typeof value === 'string' && (LIST_KEYS as readonly string[]).includes(value);
}

function cleanContent(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CONTENT) return null;
  return trimmed;
}

function toItem(row: ListItemRow) {
  return {
    id: row.id,
    listKey: row.list_key,
    content: row.content,
    done: row.done,
    createdAt: row.created_at,
  };
}

type AuthResult =
  | { error: NextResponse; user?: undefined }
  | { error?: undefined; user: { id: string } };

/** Resolves the caller, or the response to return instead. */
async function requireUser(): Promise<AuthResult> {
  if (!isDbConfigured()) {
    return { error: NextResponse.json({ error: 'Database not configured.' }, { status: 503 }) };
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }
  await ensureBlueListsSchema();
  return { user };
}

/** GET /api/blue-lists — every item the caller owns, grouped by list. */
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const rows = await sqlQuery<ListItemRow[]>(
    `SELECT id, list_key, content, done, created_at
     FROM blue_list_items
     WHERE user_id = :userId
     ORDER BY created_at ASC`,
    { userId: auth.user.id }
  );

  const lists: Record<ListKey, ReturnType<typeof toItem>[]> = { todo: [], watch: [], later: [] };
  for (const row of rows) lists[row.list_key].push(toItem(row));

  return NextResponse.json({ lists });
}

/** POST /api/blue-lists — add one item to one list. */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const listKey = body?.listKey;
  const content = cleanContent(body?.content);

  if (!isListKey(listKey)) {
    return NextResponse.json({ error: 'Unknown list.' }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: `Write something, up to ${MAX_CONTENT} characters.` }, { status: 400 });
  }

  const [{ count }] = await sqlQuery<Array<{ count: string }>>(
    `SELECT COUNT(*) AS count FROM blue_list_items
     WHERE user_id = :userId AND list_key = :listKey`,
    { userId: auth.user.id, listKey }
  );
  if (Number(count) >= MAX_ITEMS_PER_LIST) {
    return NextResponse.json(
      { error: `That list is full at ${MAX_ITEMS_PER_LIST} items. Clear a few out.` },
      { status: 409 }
    );
  }

  const [row] = await sqlQuery<ListItemRow[]>(
    `INSERT INTO blue_list_items (user_id, list_key, content)
     VALUES (:userId, :listKey, :content)
     RETURNING id, list_key, content, done, created_at`,
    { userId: auth.user.id, listKey, content }
  );

  return NextResponse.json({ item: toItem(row) }, { status: 201 });
}

/** PATCH /api/blue-lists — edit an item's text or done state. */
export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: 'Missing or malformed item id.' }, { status: 400 });
  }

  const hasContent = body?.content !== undefined;
  const hasDone = body?.done !== undefined;
  const content = hasContent ? cleanContent(body.content) : null;

  if (hasContent && !content) {
    return NextResponse.json({ error: `Write something, up to ${MAX_CONTENT} characters.` }, { status: 400 });
  }
  if (hasDone && typeof body.done !== 'boolean') {
    return NextResponse.json({ error: 'done must be a boolean.' }, { status: 400 });
  }
  if (!hasContent && !hasDone) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  // COALESCE leaves the untouched column alone; the casts give Postgres a type
  // for the null placeholder. The user_id filter is what stops one user
  // editing another's row.
  const [row] = await sqlQuery<ListItemRow[]>(
    `UPDATE blue_list_items
     SET content = COALESCE(:content::text, content),
         done = COALESCE(:done::boolean, done),
         updated_at = now()
     WHERE id = :id AND user_id = :userId
     RETURNING id, list_key, content, done, created_at`,
    {
      id,
      userId: auth.user.id,
      content: hasContent ? content : null,
      done: hasDone ? body.done : null,
    }
  );

  if (!row) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
  }

  return NextResponse.json({ item: toItem(row) });
}

/** DELETE /api/blue-lists?id=… — remove one item. */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const id = request.nextUrl.searchParams.get('id');
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Missing or malformed item id.' }, { status: 400 });
  }

  const deleted = await sqlQuery<Array<{ id: string }>>(
    `DELETE FROM blue_list_items
     WHERE id = :id AND user_id = :userId
     RETURNING id`,
    { id, userId: auth.user.id }
  );

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
