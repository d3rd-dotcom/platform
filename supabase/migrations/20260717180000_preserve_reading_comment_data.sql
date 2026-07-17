-- Migrate legacy UUID user IDs without deleting comments or likes.
-- New deployments already receive CHAR(36) columns from
-- lib/ensureReadingCommentsSchema.ts; this migration preserves live rows.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.reading_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reading_slug TEXT NOT NULL,
  user_id CHAR(36) NOT NULL REFERENCES public.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reading_comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.reading_comments(id) ON DELETE CASCADE,
  user_id CHAR(36) NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

DO $$
DECLARE
  constraint_name TEXT;
  column_type TEXT;
BEGIN
  SELECT data_type
    INTO column_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'reading_comments'
     AND column_name = 'user_id';

  IF column_type = 'uuid' THEN
    FOR constraint_name IN
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'public.reading_comments'::regclass
         AND contype = 'f'
         AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (user_id)%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.reading_comments DROP CONSTRAINT %I',
        constraint_name
      );
    END LOOP;

    ALTER TABLE public.reading_comments
      ALTER COLUMN user_id TYPE CHAR(36) USING user_id::text;
  END IF;

  SELECT data_type
    INTO column_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'reading_comment_likes'
     AND column_name = 'user_id';

  IF column_type = 'uuid' THEN
    FOR constraint_name IN
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'public.reading_comment_likes'::regclass
         AND contype = 'f'
         AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (user_id)%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.reading_comment_likes DROP CONSTRAINT %I',
        constraint_name
      );
    END LOOP;

    ALTER TABLE public.reading_comment_likes
      ALTER COLUMN user_id TYPE CHAR(36) USING user_id::text;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.reading_comments'::regclass
       AND conname = 'reading_comments_user_id_fkey'
  ) THEN
    ALTER TABLE public.reading_comments
      ADD CONSTRAINT reading_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.reading_comment_likes'::regclass
       AND conname = 'reading_comment_likes_user_id_fkey'
  ) THEN
    ALTER TABLE public.reading_comment_likes
      ADD CONSTRAINT reading_comment_likes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_reading_comments_slug
  ON public.reading_comments(reading_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_comment_likes_comment
  ON public.reading_comment_likes(comment_id);

ALTER TABLE public.reading_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_comment_likes ENABLE ROW LEVEL SECURITY;

