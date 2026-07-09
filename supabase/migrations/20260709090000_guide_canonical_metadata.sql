-- ============================================================================
-- Canonical guide metadata
-- ============================================================================
-- Adds stable subject identifiers and contributor-authored discovery metadata.
-- Existing guide_subjects.subject labels remain the public display contract.
-- Graph levels remain computed from guide_edges.
-- ============================================================================

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS summary VARCHAR(280),
  ADD COLUMN IF NOT EXISTS intended_audience VARCHAR(280),
  ADD COLUMN IF NOT EXISTS estimated_minutes SMALLINT,
  ADD COLUMN IF NOT EXISTS source_provenance TEXT,
  ADD COLUMN IF NOT EXISTS source_reviewed_at DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guides_estimated_minutes_check'
  ) THEN
    ALTER TABLE guides
      ADD CONSTRAINT guides_estimated_minutes_check
      CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 600);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS guide_subject_catalog (
  id VARCHAR(64) PRIMARY KEY,
  label VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(280) NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO guide_subject_catalog (id, label, description, aliases, sort_order)
VALUES
  ('foundations', 'Foundations', 'Core concepts used across the knowledge map.', ARRAY['Fundamentals'], 10),
  ('focus', 'Focus', 'Attention, cognition, memory, and clear thinking.', ARRAY['Attention', 'Cognition'], 20),
  ('emotional-regulation', 'Emotional Regulation', 'Recognizing emotions and responding with greater control.', ARRAY['Emotion Regulation'], 30),
  ('reflection', 'Reflection', 'Self-observation, values, and deliberate learning.', ARRAY['Self Reflection'], 40),
  ('habits', 'Habits', 'Repeatable behaviors, routines, sleep, and movement.', ARRAY['Routines'], 50),
  ('coping', 'Coping', 'Skills for responding to stress and difficult experiences.', ARRAY['Resilience'], 60)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

ALTER TABLE guide_subjects
  ADD COLUMN IF NOT EXISTS subject_id VARCHAR(64)
  REFERENCES guide_subject_catalog(id) ON DELETE RESTRICT;

UPDATE guide_subjects gs
SET subject_id = catalog.id
FROM guide_subject_catalog catalog
WHERE gs.subject_id IS NULL
  AND (
    lower(trim(gs.subject)) = lower(catalog.label)
    OR EXISTS (
      SELECT 1
      FROM unnest(catalog.aliases) alias
      WHERE lower(trim(gs.subject)) = lower(alias)
    )
  );

CREATE INDEX IF NOT EXISTS idx_guide_subjects_subject_id
  ON guide_subjects(subject_id);

CREATE TABLE IF NOT EXISTS guide_topic_aliases (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  alias VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guide_id, alias)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guide_topic_aliases_normalized_unique
  ON guide_topic_aliases(lower(trim(alias)));
CREATE INDEX IF NOT EXISTS idx_guide_topic_aliases_guide
  ON guide_topic_aliases(guide_id);

ALTER TABLE guide_subject_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_topic_aliases ENABLE ROW LEVEL SECURITY;
