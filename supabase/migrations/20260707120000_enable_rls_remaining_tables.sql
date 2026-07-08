-- Enable RLS on every remaining public table that had it off. All app access
-- goes through the server's direct Postgres connection (table owner, bypasses
-- RLS); the anon key is used only by Supabase Realtime for live chat, which
-- needs a read policy on chat_messages to keep receiving INSERT events.
-- No anon/authenticated policies exist on the other tables, so PostgREST
-- access with the publishable key is denied by default.

ALTER TABLE public.survey_certificate_mints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_proof_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_diamond_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamond_onchain_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shard_count_backup_20260702 ENABLE ROW LEVEL SECURITY;

-- Global chat is public in the product; a read-only policy keeps the
-- Realtime postgres_changes subscription (anon key) delivering new messages.
-- Writes still only happen through the server API.
CREATE POLICY chat_messages_public_read ON public.chat_messages
  FOR SELECT TO anon, authenticated USING (true);
