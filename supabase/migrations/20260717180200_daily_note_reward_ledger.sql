-- Server-owned evidence for paying daily-note quests. The encrypted prayers
-- blob predates this ledger and remains ineligible for rewards by itself.
CREATE TABLE IF NOT EXISTS daily_note_completions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  reward_day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_number, day_number),
  UNIQUE (user_id, reward_day)
);

ALTER TABLE daily_note_completions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_daily_note_completions_user
  ON daily_note_completions(user_id, week_number, day_number);
