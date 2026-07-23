ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS education_levels TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goals TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_guides_education_levels
  ON public.guides USING GIN (education_levels);

CREATE INDEX IF NOT EXISTS idx_guides_goals
  ON public.guides USING GIN (goals);
