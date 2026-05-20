-- Migration: Enable RLS on all remaining public tables
-- Fixes Supabase Security Advisor errors: "RLS Disabled in Public"
--
-- The app connects through lib/db.ts using a pg.Pool with the `postgres`
-- role (DATABASE_URL), which has BYPASSRLS — so enabling RLS does not affect
-- the application. There is no supabase-js anon-key client in the codebase.
--
-- No policies are added: with RLS on and no policy, the anon/authenticated
-- roles (the Data API) are denied all access, which is the intended lockdown.
-- If client-side anon access is ever added, create explicit policies then.

ALTER TABLE public.agent_api_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reminders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_wallet_keys       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_memory_facts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_relationship_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_quests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_tests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_completions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_comment_likes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_shard_reclaims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_log_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_log_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_log_votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks                   ENABLE ROW LEVEL SECURITY;
