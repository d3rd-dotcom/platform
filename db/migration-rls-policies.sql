-- ============================================================================
-- Real Row Level Security Policies (Upgrade 2)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query),
-- AFTER all prior migrations:
--   db/schema.sql
--   db/migration-proposals.sql
--   db/migration-guides.sql
--   db/migration-guide-verification.sql
--   db/migration-guide-disputes.sql
--   db/migration-guide-materials.sql
--   db/migration-guide-rewards.sql
--   db/migration-enable-rls-all-tables.sql
--
-- ----------------------------------------------------------------------------
-- CONTEXT / CURRENT EXPOSURE
-- ----------------------------------------------------------------------------
-- Today every table has RLS ENABLED but ZERO policies, and the app connects
-- through lib/db.ts as the `postgres` role, which carries BYPASSRLS. RLS is
-- therefore inert for the application: it protects nothing at the app layer.
-- The only thing RLS currently does is lock out the Supabase Data API
-- (anon / authenticated roles), because "RLS on + no policy" = deny-all for
-- non-bypass roles.
--
-- This migration adds REAL policies scoped to a NEW, non-privileged role
-- `app_service` (NOBYPASSRLS). It does NOT change how the running app connects
-- (still `postgres`), so it is safe to apply to production TODAY: the postgres
-- role bypasses RLS and is completely unaffected. The policies only "bite" once
-- the app is migrated to connect as `app_service` and to set the per-request
-- identity via `SET LOCAL app.user_id` (see db.ts transition plan in
-- docs/security/rls-plan.md). Until then this is defense-in-depth that is ready
-- and tested.
--
-- ----------------------------------------------------------------------------
-- IDENTITY MODEL
-- ----------------------------------------------------------------------------
-- The app authenticates users with Privy SERVER-SIDE. It does NOT use Supabase
-- Auth JWTs, so `auth.uid()` is NOT available and MUST NOT be referenced.
-- Instead, row ownership is expressed against a transaction-local GUC:
--
--     current_setting('app.user_id', true)::text
--
-- The `true` second argument makes the lookup "missing_ok": if the GUC has not
-- been set, current_setting returns NULL instead of raising. A NULL identity
-- therefore matches NO owner row -- fail-closed. The app is expected to issue
-- `SET LOCAL app.user_id = '<users.id>'` at the start of every authenticated
-- transaction (SET LOCAL is scoped to the transaction, which is exactly right
-- for a pooled connection: it cannot leak into the next checkout).
--
-- This design is forward-compatible with either future path:
--   (a) Supabase Auth mirrors the Privy user id into a JWT claim -- swap the
--       GUC for the claim in a follow-up, policy shape is identical; or
--   (b) the app keeps its own pool but connects as `app_service` -- this
--       migration is already the target state.
--
-- ----------------------------------------------------------------------------
-- SAFETY PROPERTIES
-- ----------------------------------------------------------------------------
--   * FORCE ROW LEVEL SECURITY is deliberately NOT set on any table, so the
--     table-owning `postgres` role keeps working during the transition.
--   * Idempotent: every policy is DROP POLICY IF EXISTS'd before CREATE, and
--     the role / grants use guards so re-running is harmless.
--   * No grants are made to `anon` or `authenticated`: the Supabase Data API
--     continues to see NOTHING (deny-all preserved).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. The application service role
-- ---------------------------------------------------------------------------
-- NOLOGIN by itself; the real login role (the pooler user) will be GRANTed
-- membership in app_service in the transition step, OR app_service is granted
-- LOGIN out-of-band. NOBYPASSRLS is the whole point: this role is SUBJECT to
-- the policies below. Created only if absent so the migration is re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

-- Schema usage (no object privileges implied by this alone).
GRANT USAGE ON SCHEMA public TO app_service;

-- ---------------------------------------------------------------------------
-- 1. Table-level privileges (the GRANT matrix)
-- ---------------------------------------------------------------------------
-- Minimal per-table grants derived from an audit of the lib/*.ts queries.
-- RLS narrows WHICH ROWS within these tables app_service may touch; the GRANT
-- decides WHICH VERBS are even attemptable. A verb not granted here can never
-- be exercised, regardless of policy. No SELECT/INSERT/UPDATE/DELETE is granted
-- beyond what a route actually issues.

-- Core identity / auth (self-scoped) -----------------------------------------
GRANT SELECT, UPDATE                 ON users    TO app_service; -- profile read; shard_count credit (guide-rewards-db)
GRANT SELECT, INSERT, DELETE         ON sessions TO app_service; -- login create / logout delete / validate

-- Guide DAG ------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE         ON guides         TO app_service; -- create; status + canonical_group transitions
GRANT SELECT, INSERT                 ON guide_edges    TO app_service; -- read DAG; fork inserts prereq edges
GRANT SELECT, INSERT                 ON guide_subjects TO app_service; -- read tags; fork assigns niche subject
GRANT SELECT                         ON guide_methods  TO app_service; -- read-only in app (methods seeded, not user-written)

-- Per-user guide state (row-owner scoped) ------------------------------------
GRANT SELECT, INSERT                 ON guide_progress       TO app_service; -- completions (append-only)
GRANT SELECT, INSERT, UPDATE         ON guide_votes          TO app_service; -- upsert one vote per (user,guide)
GRANT SELECT, INSERT                 ON guide_diamond_claims TO app_service; -- idempotent reward ledger (append-only)

-- Materials marketplace ------------------------------------------------------
GRANT SELECT, INSERT, DELETE         ON guide_materials TO app_service; -- read; author replaces set (delete-then-insert)

-- Verifier jury --------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE         ON verifier_credentials   TO app_service; -- upsert on passing the verifier test
GRANT SELECT, INSERT, UPDATE         ON verifier_panels        TO app_service; -- open panel; resolve -> approved/rejected
GRANT SELECT, INSERT                 ON verifier_panel_members TO app_service; -- draw jurors (append-only)
GRANT SELECT, INSERT                 ON verifier_panel_votes   TO app_service; -- one juror vote (append-only, immutable)
GRANT SELECT, INSERT, UPDATE         ON guide_cre_scores       TO app_service; -- DON-signed advisory score upsert (latest wins)

-- Disputes & spin-offs -------------------------------------------------------
GRANT SELECT, INSERT, UPDATE         ON guide_disputes        TO app_service; -- open; status lifecycle transitions
GRANT SELECT, INSERT                 ON dispute_panel_members TO app_service; -- draw moderator jury (append-only)
GRANT SELECT, INSERT                 ON dispute_panel_votes   TO app_service; -- one juror verdict (append-only, immutable)

-- NOTE: sequences are not needed -- all PKs default to gen_random_uuid()::text,
-- so app_service requires no USAGE on any sequence.

-- ---------------------------------------------------------------------------
-- 2. Helper: current app identity as text
-- ---------------------------------------------------------------------------
-- Wrapping current_setting keeps every policy readable and consistent, and
-- centralises the "missing_ok = fail closed" behaviour. STABLE + SECURITY
-- INVOKER; marked LEAKPROOF-free intentionally (no data access inside).
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.user_id', true)::text
$$;

GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_service;

-- ============================================================================
-- 3. POLICIES
-- ============================================================================
-- Convention: policies are scoped `TO app_service` so they never widen access
-- for anon/authenticated (which have no grants anyway) and never constrain
-- postgres (which bypasses RLS). USING governs visibility of existing rows
-- (SELECT/UPDATE/DELETE); WITH CHECK governs the shape of new/changed rows
-- (INSERT/UPDATE). "public read" below means "readable by app_service", i.e.
-- any signed-in app request -- NOT the internet.

-- ---------------------------------------------------------------------------
-- users -- self only
-- ---------------------------------------------------------------------------
-- Protects: PII (email, wallet_address), password_hash, shard balance.
-- A request may read and update ONLY its own row. Password/email columns are
-- still column-level exposed to reads by design (the app selects them
-- server-side); row scoping ensures one user cannot read another's secrets.
DROP POLICY IF EXISTS users_select_self ON users;
CREATE POLICY users_select_self ON users
  FOR SELECT TO app_service
  USING (id = app_current_user_id());

-- Only the owner may update their row, and may not reassign it to someone else.
DROP POLICY IF EXISTS users_update_self ON users;
CREATE POLICY users_update_self ON users
  FOR UPDATE TO app_service
  USING (id = app_current_user_id())
  WITH CHECK (id = app_current_user_id());
-- (No INSERT/DELETE policy: account creation & deletion run as postgres in the
--  onboarding path and are intentionally NOT reachable as app_service.)

-- ---------------------------------------------------------------------------
-- sessions -- self only
-- ---------------------------------------------------------------------------
-- Protects: session tokens. A user may create, read and delete only their own
-- sessions; they can never enumerate or revoke another user's session.
DROP POLICY IF EXISTS sessions_select_self ON sessions;
CREATE POLICY sessions_select_self ON sessions
  FOR SELECT TO app_service
  USING (user_id = app_current_user_id());

DROP POLICY IF EXISTS sessions_insert_self ON sessions;
CREATE POLICY sessions_insert_self ON sessions
  FOR INSERT TO app_service
  WITH CHECK (user_id = app_current_user_id());

DROP POLICY IF EXISTS sessions_delete_self ON sessions;
CREATE POLICY sessions_delete_self ON sessions
  FOR DELETE TO app_service
  USING (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- guides -- published readable to all; writes constrained
-- ---------------------------------------------------------------------------
-- Read: anyone signed in may read PUBLISHED guides. The author may additionally
-- read their own non-published drafts/forks (so the builder can load them).
-- Protects: unpublished/draft content stays private to its author.
DROP POLICY IF EXISTS guides_select_published_or_own ON guides;
CREATE POLICY guides_select_published_or_own ON guides
  FOR SELECT TO app_service
  USING (
    status = 'published'
    OR author_id = app_current_user_id()
  );

-- Insert: a user may create a guide only as themselves (author_id must be the
-- caller). New guides may only enter in a non-published state -- publication is
-- gated by the verifier pipeline, never by direct insert.
DROP POLICY IF EXISTS guides_insert_own_draft ON guides;
CREATE POLICY guides_insert_own_draft ON guides
  FOR INSERT TO app_service
  WITH CHECK (
    author_id = app_current_user_id()
    AND status IN ('draft', 'pending_verification')
  );

-- Update: the author may edit their own guide. This intentionally covers the
-- status transitions the app performs on behalf of the author's submission
-- (draft -> pending_verification). Panel-driven transitions (-> published /
-- unpublished / forked), the vote-driven auto-unpublish sweep, and dispute
-- resolutions run in code paths that operate across authors and are therefore
-- expected to execute as `postgres` (or a future dedicated `app_pipeline`
-- role), NOT as the row's author. Keeping author-scoped UPDATE here prevents a
-- user from flipping ANOTHER user's guide, while the trusted pipeline stays on
-- the bypass role. See docs/security/rls-plan.md "pipeline writes".
DROP POLICY IF EXISTS guides_update_own ON guides;
CREATE POLICY guides_update_own ON guides
  FOR UPDATE TO app_service
  USING (author_id = app_current_user_id())
  WITH CHECK (author_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- guide_edges -- public read, restricted write
-- ---------------------------------------------------------------------------
-- The prerequisite DAG is public knowledge-graph structure: any signed-in
-- request may read it to compute levels and walkthroughs. Edge inserts only
-- occur in the fork/spin-off pipeline (cross-author), so no app_service INSERT
-- policy is provided even though the verb is granted -- inserts are expected on
-- the bypass/pipeline role. With RLS on and no INSERT policy, app_service
-- inserts are denied (fail closed) until a pipeline path is defined.
DROP POLICY IF EXISTS guide_edges_select_all ON guide_edges;
CREATE POLICY guide_edges_select_all ON guide_edges
  FOR SELECT TO app_service
  USING (true);

-- ---------------------------------------------------------------------------
-- guide_subjects -- public read, restricted write
-- ---------------------------------------------------------------------------
-- Subject tags are public filters. Reads open to all signed-in requests.
-- Tag writes happen in the fork pipeline (cross-author) -> bypass/pipeline role,
-- so no app_service INSERT policy (denied for app_service; fail closed).
DROP POLICY IF EXISTS guide_subjects_select_all ON guide_subjects;
CREATE POLICY guide_subjects_select_all ON guide_subjects
  FOR SELECT TO app_service
  USING (true);

-- ---------------------------------------------------------------------------
-- guide_methods -- public read only
-- ---------------------------------------------------------------------------
-- Methods nest inside a guide and are content, not per-user data. Read open to
-- all signed-in requests; the app never writes them at runtime (seed/authoring
-- happens as postgres), and no write verb is granted to app_service.
DROP POLICY IF EXISTS guide_methods_select_all ON guide_methods;
CREATE POLICY guide_methods_select_all ON guide_methods
  FOR SELECT TO app_service
  USING (true);

-- ---------------------------------------------------------------------------
-- guide_progress -- row owner
-- ---------------------------------------------------------------------------
-- Protects: a user's completion history. Each user sees and appends only their
-- own completion rows. Append-only (no UPDATE/DELETE granted): completions are
-- immutable facts.
DROP POLICY IF EXISTS guide_progress_select_own ON guide_progress;
CREATE POLICY guide_progress_select_own ON guide_progress
  FOR SELECT TO app_service
  USING (user_id = app_current_user_id());

DROP POLICY IF EXISTS guide_progress_insert_own ON guide_progress;
CREATE POLICY guide_progress_insert_own ON guide_progress
  FOR INSERT TO app_service
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- guide_votes -- row owner (with public aggregate read)
-- ---------------------------------------------------------------------------
-- A user may cast/read/change ONLY their own vote (one per guide, enforced by
-- the table's UNIQUE + the app's upsert). We allow SELECT of any vote so the
-- app can compute public vote tallies, but INSERT/UPDATE are owner-locked so a
-- user cannot forge or overwrite someone else's vote.
DROP POLICY IF EXISTS guide_votes_select_all ON guide_votes;
CREATE POLICY guide_votes_select_all ON guide_votes
  FOR SELECT TO app_service
  USING (true);

DROP POLICY IF EXISTS guide_votes_insert_own ON guide_votes;
CREATE POLICY guide_votes_insert_own ON guide_votes
  FOR INSERT TO app_service
  WITH CHECK (user_id = app_current_user_id());

DROP POLICY IF EXISTS guide_votes_update_own ON guide_votes;
CREATE POLICY guide_votes_update_own ON guide_votes
  FOR UPDATE TO app_service
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- guide_diamond_claims -- row owner
-- ---------------------------------------------------------------------------
-- Protects: the reward ledger. A user reads only their own claims and can only
-- insert claims crediting themselves -- they cannot fabricate a claim for
-- another user. Append-only (idempotent ledger; no UPDATE/DELETE).
DROP POLICY IF EXISTS guide_diamond_claims_select_own ON guide_diamond_claims;
CREATE POLICY guide_diamond_claims_select_own ON guide_diamond_claims
  FOR SELECT TO app_service
  USING (user_id = app_current_user_id());

DROP POLICY IF EXISTS guide_diamond_claims_insert_own ON guide_diamond_claims;
CREATE POLICY guide_diamond_claims_insert_own ON guide_diamond_claims
  FOR INSERT TO app_service
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- guide_materials -- public read, author-restricted write
-- ---------------------------------------------------------------------------
-- Materials are public shopping context shown on a guide page: readable by all
-- signed-in requests. Writes (the app replaces the whole set via delete-then-
-- insert) must be performed by the guide's AUTHOR only, enforced by joining to
-- guides.author_id. A non-author cannot add or strip materials on someone
-- else's guide.
DROP POLICY IF EXISTS guide_materials_select_all ON guide_materials;
CREATE POLICY guide_materials_select_all ON guide_materials
  FOR SELECT TO app_service
  USING (true);

DROP POLICY IF EXISTS guide_materials_insert_author ON guide_materials;
CREATE POLICY guide_materials_insert_author ON guide_materials
  FOR INSERT TO app_service
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE g.id = guide_materials.guide_id
        AND g.author_id = app_current_user_id()
    )
  );

DROP POLICY IF EXISTS guide_materials_delete_author ON guide_materials;
CREATE POLICY guide_materials_delete_author ON guide_materials
  FOR DELETE TO app_service
  USING (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE g.id = guide_materials.guide_id
        AND g.author_id = app_current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- verifier_credentials -- row owner read; write via pipeline
-- ---------------------------------------------------------------------------
-- A user may read their OWN credentials (which subjects/levels they can verify).
-- Credentials are minted by the grading path (verifier-tests-db upsert), which
-- credits the tested user; we allow owner-scoped INSERT/UPDATE so that path can
-- run as app_service crediting the caller, and forbid crediting anyone else.
DROP POLICY IF EXISTS verifier_credentials_select_own ON verifier_credentials;
CREATE POLICY verifier_credentials_select_own ON verifier_credentials
  FOR SELECT TO app_service
  USING (user_id = app_current_user_id());

DROP POLICY IF EXISTS verifier_credentials_insert_own ON verifier_credentials;
CREATE POLICY verifier_credentials_insert_own ON verifier_credentials
  FOR INSERT TO app_service
  WITH CHECK (user_id = app_current_user_id());

DROP POLICY IF EXISTS verifier_credentials_update_own ON verifier_credentials;
CREATE POLICY verifier_credentials_update_own ON verifier_credentials
  FOR UPDATE TO app_service
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- verifier_panels -- public audit read; write via pipeline
-- ---------------------------------------------------------------------------
-- The jury audit trail is public: any signed-in request may read panel status
-- to show verification state on a guide. Panel creation and resolution
-- (open -> approved/rejected) are pipeline actions spanning many users, so no
-- app_service INSERT/UPDATE policy -- those writes run on the bypass/pipeline
-- role. Fail closed for app_service writes.
DROP POLICY IF EXISTS verifier_panels_select_all ON verifier_panels;
CREATE POLICY verifier_panels_select_all ON verifier_panels
  FOR SELECT TO app_service
  USING (true);

-- ---------------------------------------------------------------------------
-- verifier_panel_members -- juror sees own draw; roster read public
-- ---------------------------------------------------------------------------
-- The panel roster is part of the public audit trail (who judged what), so
-- SELECT is open. Member draws are performed by the pipeline (random selection
-- across users) -> bypass/pipeline role; no app_service INSERT policy.
DROP POLICY IF EXISTS verifier_panel_members_select_all ON verifier_panel_members;
CREATE POLICY verifier_panel_members_select_all ON verifier_panel_members
  FOR SELECT TO app_service
  USING (true);

-- ---------------------------------------------------------------------------
-- verifier_panel_votes -- public audit read; owner-only cast
-- ---------------------------------------------------------------------------
-- Votes + justifications are a PUBLIC audit log (transparency of the jury), so
-- SELECT is open. A juror may cast ONLY their own vote (user_id = caller);
-- votes are immutable (no UPDATE/DELETE granted) so a strike/justification can
-- never be edited after the fact.
DROP POLICY IF EXISTS verifier_panel_votes_select_all ON verifier_panel_votes;
CREATE POLICY verifier_panel_votes_select_all ON verifier_panel_votes
  FOR SELECT TO app_service
  USING (true);

DROP POLICY IF EXISTS verifier_panel_votes_insert_own ON verifier_panel_votes;
CREATE POLICY verifier_panel_votes_insert_own ON verifier_panel_votes
  FOR INSERT TO app_service
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- guide_cre_scores -- public audit read; write via signed callback
-- ---------------------------------------------------------------------------
-- The DON-signed advisory score is displayed to the panel and is public audit
-- data (SELECT open). It is written back only by the authenticated CRE callback
-- route (secret-header auth, not an end user), so it belongs on the
-- bypass/pipeline role -- no app_service INSERT/UPDATE policy. Fail closed for
-- app_service writes.
DROP POLICY IF EXISTS guide_cre_scores_select_all ON guide_cre_scores;
CREATE POLICY guide_cre_scores_select_all ON guide_cre_scores
  FOR SELECT TO app_service
  USING (true);

-- ---------------------------------------------------------------------------
-- guide_disputes -- public audit read; opener-scoped create
-- ---------------------------------------------------------------------------
-- Disputes are a public accountability record (SELECT open). A user may OPEN a
-- dispute only as themselves (opener_id = caller). Status lifecycle transitions
-- (panel_drawn / resolved_* / dismissed) are pipeline decisions spanning the
-- jury, so no app_service UPDATE policy -- resolution runs on the bypass/
-- pipeline role. This lets a user file, but never self-resolve, a dispute.
DROP POLICY IF EXISTS guide_disputes_select_all ON guide_disputes;
CREATE POLICY guide_disputes_select_all ON guide_disputes
  FOR SELECT TO app_service
  USING (true);

DROP POLICY IF EXISTS guide_disputes_insert_opener ON guide_disputes;
CREATE POLICY guide_disputes_insert_opener ON guide_disputes
  FOR INSERT TO app_service
  WITH CHECK (
    opener_id = app_current_user_id()
    AND status = 'open'
  );

-- ---------------------------------------------------------------------------
-- dispute_panel_members -- public audit read; write via pipeline
-- ---------------------------------------------------------------------------
-- Roster is public audit data (SELECT open). Moderator draws are pipeline
-- actions (random, conflict-of-interest excluded) -> bypass/pipeline role; no
-- app_service INSERT policy.
DROP POLICY IF EXISTS dispute_panel_members_select_all ON dispute_panel_members;
CREATE POLICY dispute_panel_members_select_all ON dispute_panel_members
  FOR SELECT TO app_service
  USING (true);

-- ---------------------------------------------------------------------------
-- dispute_panel_votes -- public audit read; owner-only cast
-- ---------------------------------------------------------------------------
-- Verdicts + justifications are a PUBLIC audit log (SELECT open). A juror may
-- cast ONLY their own verdict (user_id = caller); verdicts are immutable (no
-- UPDATE/DELETE granted).
DROP POLICY IF EXISTS dispute_panel_votes_select_all ON dispute_panel_votes;
CREATE POLICY dispute_panel_votes_select_all ON dispute_panel_votes
  FOR SELECT TO app_service
  USING (true);

DROP POLICY IF EXISTS dispute_panel_votes_insert_own ON dispute_panel_votes;
CREATE POLICY dispute_panel_votes_insert_own ON dispute_panel_votes
  FOR INSERT TO app_service
  WITH CHECK (user_id = app_current_user_id());

-- ============================================================================
-- TABLES DELIBERATELY LEFT WITH NO app_service POLICY (fully locked)
-- ============================================================================
-- The following tables already have RLS enabled (from prior migrations) and are
-- INTENTIONALLY given NO policy here and NO grant to app_service. They therefore
-- remain deny-all for app_service (and anon/authenticated), and are reachable
-- ONLY by the bypass `postgres` role. This is by design: they are either
-- secrets, financial/on-chain records, or subsystems outside the guide scope of
-- this migration and must not be exposed to a per-request app role yet.
--
--   proposals, proposal_reviews, proposal_transactions   -- on-chain funding + wallet
--   x_accounts, x_oauth_states                            -- OAuth secrets / tokens
--   agent_api_keys, agent_wallet_keys, agent_reminders    -- agent secrets
--   membership_orders, research_shard_reclaims            -- payments / ledgers
--   blue_chat_messages, blue_memory_facts,
--     blue_relationship_state                             -- Blue private memory
--   custom_quests, quest_completions, quests,
--     generated_tests, events, weeks, personal_courses    -- other subsystems
--   reading_comments, reading_comment_likes,
--     room_log_posts, room_log_comments, room_log_votes   -- other subsystems
--   user_avatars, forum_categories, forum_threads,
--     forum_posts                                         -- not in guide scope
--
-- When any of these subsystems is migrated onto app_service, add its grants and
-- policies in a follow-up migration -- do NOT loosen them here.
-- ============================================================================

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
