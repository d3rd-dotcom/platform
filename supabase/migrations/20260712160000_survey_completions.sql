CREATE TABLE IF NOT EXISTS public.survey_completions (
  id           CHAR(36)     PRIMARY KEY,
  user_id      CHAR(36)     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  survey_id    VARCHAR(64)  NOT NULL,
  profile_type VARCHAR(64)  NOT NULL,
  completed_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_survey_completion_user_survey UNIQUE (user_id, survey_id)
);

ALTER TABLE public.survey_completions ENABLE ROW LEVEL SECURITY;

-- Certificate eligibility is written and read only by authenticated server routes.
-- Service-role access bypasses RLS; browser clients receive no direct table policy.
