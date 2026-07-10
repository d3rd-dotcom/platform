-- ============================================================================
-- Blue's Lists power tool
-- ============================================================================
-- Three fixed lists per user: todo (what you must do), watch (what you're
-- tracking), later (everything else). One row per item so each entry saves
-- and deletes independently.
--
-- All access goes through /api/blue-lists on the server's direct Postgres
-- connection, which owns the table and bypasses RLS. RLS is enabled with no
-- anon/authenticated policies so PostgREST access is denied by default.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blue_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id CHAR(36) NOT NULL,
  list_key TEXT NOT NULL CHECK (list_key IN ('todo', 'watch', 'later')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS blue_list_items_user_list_idx
  ON blue_list_items (user_id, list_key, created_at);

ALTER TABLE public.blue_list_items ENABLE ROW LEVEL SECURITY;
