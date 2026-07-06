# RLS Plan (Upgrade 2)

Companion to `db/migration-rls-policies.sql`. Explains the current exposure, the
role/identity transition, what the Data API can see, and how to prove the
policies actually bite.

## 1. Current exposure (why RLS protects nothing today)

- The app connects via `lib/db.ts` (`pg.Pool`, `DATABASE_URL`) as the **`postgres`**
  role, which carries **`BYPASSRLS`**.
- Every table has **RLS enabled with ZERO policies** (from `schema.sql`,
  `migration-enable-rls-all-tables.sql`, and the guide migrations).
- Net effect: RLS is **inert at the app layer**. Because `postgres` bypasses RLS,
  a bug (SQL injection, a missing `WHERE user_id = ...`, a leaked query) is *not*
  contained by the database — every row of every table is reachable on that
  connection. The only thing RLS does today is deny the Supabase **Data API**
  (`anon` / `authenticated`) all access (RLS on + no policy = deny-all).

The fix is not "add more `WHERE` clauses"; it is to give the app a role that is
**subject to** RLS, so the database enforces ownership even if app code is wrong.

## 2. What this migration does (safe to apply TODAY)

`db/migration-rls-policies.sql` is safe to run on production **now** because it
does **not** change how the app connects — it still uses `postgres`, which
bypasses RLS, so the running app is unaffected. The migration:

1. Creates role **`app_service`** — `NOLOGIN`, **`NOBYPASSRLS`** (the whole
   point: it obeys policies).
2. Grants `app_service` **only the verbs each table's routes actually use**
   (the grant matrix — see `migration-rls-policies.sql` §1).
3. Adds row-scoped **policies** for the guide system, keyed on
   `current_setting('app.user_id', true)::text = <owner column>`.
4. Does **not** set `FORCE ROW LEVEL SECURITY` (so `postgres`, the table owner,
   keeps bypassing during the transition).
5. Grants **nothing** to `anon` / `authenticated`.

The policies only start enforcing once step 3 below (the app cutover) happens.
Until then this is tested, ready defense-in-depth.

## 3. Identity: `SET LOCAL app.user_id` per transaction

The app uses **Privy server-side** for auth and does **not** use Supabase Auth
JWTs, so `auth.uid()` is unavailable. Ownership is expressed against a
transaction-local GUC instead:

```sql
current_setting('app.user_id', true)::text   -- 'true' = missing_ok => NULL if unset => matches no row (fail closed)
```

The app must run, at the start of **every authenticated transaction**:

```sql
SET LOCAL app.user_id = '<users.id>';
```

`SET LOCAL` is scoped to the transaction, so on a **pooled** connection it can
never leak into the next checkout. Requests with no authenticated user simply
don't set it → identity is `NULL` → owner checks all fail closed.

## 4. Transition plan (NOT executed now — do this later, in order)

Nothing below is done in this task. `lib/db.ts`, env, and app code are untouched.

**Step A — apply the migration (safe now).**
Run `db/migration-rls-policies.sql`. App keeps working on `postgres`.

**Step B — give `app_service` a way to log in.**
Either `ALTER ROLE app_service LOGIN PASSWORD '...';`, or create a dedicated
login role and `GRANT app_service TO <login_role>;`. In Supabase, provision a
pooler user mapped to this role.

**Step C — wrap every app transaction with the identity GUC (lib/db.ts).**
Add a helper so all authenticated queries run inside a transaction that first
issues `SET LOCAL app.user_id = $1`. Concretely, in `lib/db.ts`:
  - Add e.g. `withUser(userId, fn)` that does
    `BEGIN; SET LOCAL app.user_id = <userId>; <fn(client)>; COMMIT;` on a single
    checked-out `PoolClient`.
  - Route the guide-system queries (guides-db, guide-votes-db,
    guide-rewards-db, guide-verification-db, guide-disputes-db,
    guide-materials-db, verifier-tests-db, verifier-prestige-db) through it.
  - **Do not** call `SET LOCAL` outside a transaction — it would be a no-op.

**Step D — point the app at `app_service` (Vercel env).**
Change `DATABASE_URL` to connect as the `app_service`-backed login role instead
of `postgres`. Do this **per environment** (Preview first, then Production) in
Vercel → Project → Settings → Environment Variables. Keep the old `postgres`
`DATABASE_URL` available (e.g. as `DATABASE_URL_ADMIN`) for the trusted pipeline
paths below.

**Step E — route trusted "pipeline" writes on an admin/bypass connection.**
Some writes are cross-author and are *deliberately* not given an `app_service`
policy: verifier panel create/resolve, dispute resolution, the vote-driven
auto-unpublish sweep, fork/spin-off edge+subject inserts, and the DON-signed
CRE-score callback. These must run on the bypass (`postgres`) connection (or a
future dedicated `app_pipeline` role). Keep them on `DATABASE_URL_ADMIN`.

**Step F — (optional, later) lock the owner too.**
Once every path is on `app_service` or a named pipeline role, consider
`ALTER TABLE ... FORCE ROW LEVEL SECURITY` and retiring the raw `postgres`
`DATABASE_URL`. Not now — it would break the transition.

## 5. What the Data API (anon / authenticated) can see after this migration

**Nothing.** This migration makes **no** `GRANT` to `anon` or `authenticated`
and adds **no** policy `TO anon`/`TO authenticated`. Every table remains
deny-all for those roles (RLS on + no policy + no grant). The `app_service`
policies are scoped `TO app_service` and do not widen Data API access. If
client-side anon access is ever wanted, it must be added explicitly in a
separate migration.

## 6. Verification checklist (prove the policies bite)

Run in a session as a superuser/owner, using `SET ROLE app_service` to
impersonate the app role. Because `app_service` is `NOBYPASSRLS`, policies apply
under `SET ROLE`.

```sql
-- 0. Confirm the role exists and does NOT bypass RLS.
SELECT rolname, rolbypassrls, rolcanlogin
FROM pg_roles WHERE rolname = 'app_service';           -- rolbypassrls = false

-- 1. Confirm no Data API grants leaked.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('anon','authenticated')
  AND table_schema = 'public';                          -- expect ZERO rows

-- 2. Owner scoping: user A cannot see user B's private rows.
--    (Assumes two seeded users A_ID, B_ID with progress rows.)
BEGIN;
  SET LOCAL ROLE app_service;
  SET LOCAL app.user_id = 'A_ID';
  SELECT count(*) FROM guide_progress WHERE user_id = 'B_ID';   -- expect 0
  SELECT count(*) FROM guide_progress;                           -- only A's rows
  SELECT count(*) FROM users WHERE id = 'B_ID';                  -- expect 0 (self-only)
COMMIT;

-- 3. Fail-closed when identity is unset.
BEGIN;
  SET LOCAL ROLE app_service;
  -- deliberately do NOT set app.user_id
  SELECT count(*) FROM guide_progress;                           -- expect 0
  SELECT count(*) FROM users;                                    -- expect 0
COMMIT;

-- 4. Cannot forge ownership on write.
BEGIN;
  SET LOCAL ROLE app_service;
  SET LOCAL app.user_id = 'A_ID';
  INSERT INTO guide_votes (guide_id, user_id, direction)
  VALUES ('SOME_GUIDE', 'B_ID', 'up');                           -- expect: RLS WITH CHECK violation
ROLLBACK;

-- 5. Published guides are readable; another user's draft is not.
BEGIN;
  SET LOCAL ROLE app_service;
  SET LOCAL app.user_id = 'A_ID';
  SELECT count(*) FROM guides WHERE status = 'published';        -- > 0
  SELECT count(*) FROM guides
   WHERE status <> 'published' AND author_id = 'B_ID';           -- expect 0
COMMIT;

-- 6. Public audit tables are readable; locked tables are not.
BEGIN;
  SET LOCAL ROLE app_service;
  SET LOCAL app.user_id = 'A_ID';
  SELECT count(*) FROM verifier_panel_votes;                     -- readable (public audit log)
  SELECT count(*) FROM proposals;                                -- expect: permission denied (no grant)
COMMIT;

-- 7. Non-author cannot mutate someone else's materials.
BEGIN;
  SET LOCAL ROLE app_service;
  SET LOCAL app.user_id = 'A_ID';   -- A is NOT the author of B_GUIDE
  DELETE FROM guide_materials WHERE guide_id = 'B_GUIDE';        -- expect 0 rows affected
ROLLBACK;
```

Pass criteria: steps 1–3 return the expected zero/own-only counts, steps 4 and 6
(`proposals`) raise errors, step 7 affects 0 rows. If any owner-scoped query
returns another user's rows, a policy is missing or the app connected on a
bypass role.
