# Database migrations

This project uses the **Supabase CLI** for schema management. This document is
the source of truth for how database changes flow from a developer's machine to
production.

## TL;DR

- All **new** schema changes go in `supabase/migrations/` — nowhere else.
- `db/` is **frozen history**. Do not add, edit, or delete files there.
- Never point the CLI at the remote without understanding the baseline section
  below — production predates this migration history.

---

## Directory layout

| Path                     | Role                                                             |
| ------------------------ | --------------------------------------------------------------- |
| `supabase/config.toml`   | Local stack config (ports, auth, etc.).                         |
| `supabase/migrations/`   | Ordered, timestamped migrations. The canonical schema history.  |
| `supabase/seed.sql`      | Seed data loaded by `supabase db reset` (the starter guide DAG).|
| `db/`                    | **Legacy.** Ad-hoc SQL applied by hand before CLI adoption.     |

The initial `supabase/migrations/` set was created by lifting the already-applied
guide-system SQL out of `db/` into timestamped files, in dependency order:

| Timestamped migration                        | Copied verbatim from                  |
| -------------------------------------------- | ------------------------------------- |
| `20260705090000_guides_dag.sql`              | `db/migration-guides.sql`             |
| `20260705090100_guide_verification.sql`      | `db/migration-guide-verification.sql` |
| `20260705090200_guide_disputes.sql`          | `db/migration-guide-disputes.sql`     |
| `20260705090300_guide_materials.sql`         | `db/migration-guide-materials.sql`    |
| `20260705090400_verifier_tests.sql`          | `db/migration-verifier-tests.sql`     |
| `20260705090500_guide_rewards.sql`           | `db/migration-guide-rewards.sql`      |
| `20260705090600_guide_rls_policies.sql`      | `db/migration-rls-policies.sql`       |

`supabase/seed.sql` is a verbatim copy of `db/seed-guides.sql`.

> **RLS policies:** lifted as migration `20260705090600_guide_rls_policies.sql`. This
> is a **genuinely new migration** — the RLS policies it defines are **not yet
> applied** to production. The six earlier guide migrations only *enable* RLS with
> zero policies (locked down — matching the repo convention at the time). The new
> migration adds real per-table policies scoped to an `app_service` role
> (NOBYPASSRLS). It is safe to apply at any time: `postgres` continues to bypass
> RLS until the app connection is migrated. Push it to production via
> `supabase db push` after baselining the first six.

All lifted migrations are idempotent (`CREATE ... IF NOT EXISTS`,
`DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`, `ADD COLUMN IF NOT EXISTS`), so
re-running them against production is safe.

---

## Everyday workflow: making a schema change

1. Create a new migration file (this only scaffolds an empty timestamped file):

   ```bash
   supabase migration new <short_snake_case_name>
   # -> creates supabase/migrations/<timestamp>_<short_snake_case_name>.sql
   ```

2. Write your SQL in that new file **only**. Prefer idempotent statements
   (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   `DROP ... IF EXISTS` guards before `CREATE TRIGGER`/`CREATE POLICY`).

3. Test locally against a fresh database (see next section).

4. Commit the migration file. One logical change per migration; never edit a
   migration that has already been pushed to production — write a new one.

---

## Local development

Start the local Supabase stack (Postgres, Auth, Storage, Studio) once:

```bash
supabase start
```

Apply the full migration history and reload seed data from scratch:

```bash
supabase db reset
```

`db reset` drops the local database, replays every file in
`supabase/migrations/` in timestamp order, then runs `supabase/seed.sql`. A green
reset means your migrations plus seed produce a working knowledge base locally —
that is the check to run before pushing.

Stop the stack when done:

```bash
supabase stop
```

---

## Applying changes to production

Two supported paths. Pick one and be consistent.

### Option A — CLI push (preferred)

```bash
supabase db push
```

Pushes any migrations not yet recorded in the remote
`supabase_migrations.schema_migrations` table. Requires the project to be linked
(`supabase link --project-ref <ref>`) and the **baseline** to be in place (below).

### Option B — Supabase SQL editor + manual record

If you cannot push from the CLI, paste the migration SQL into the Supabase
dashboard SQL editor and run it, **then** record it so the CLI does not try to
re-apply it:

```bash
supabase migration repair --status applied <timestamp>
```

Both paths end in the same state: the migration is applied AND its timestamp is
recorded in the remote migrations table.

---

## Baselining the existing production database

Production predates this migration history: the guide-system tables (and much
more) already exist there, applied by hand from `db/`. If you run
`supabase db push` without baselining, the CLI will try to replay the lifted
migrations and, although they are idempotent, their timestamps will be recorded
as freshly applied rather than reflecting reality. Do the baseline **once**.

### Step 1 — link the project

```bash
supabase link --project-ref <your-project-ref>
```

### Step 2 — tell the remote these migrations are already applied

Because the guide-system SQL is already live in production, mark every lifted
migration as `applied` without re-running it:

```bash
supabase migration repair --status applied \
  20260705090000 \
  20260705090100 \
  20260705090200 \
  20260705090300 \
  20260705090400 \
  20260705090500
```

After this, `supabase migration list` should show these six as applied both
locally and remotely, and `supabase db push` will apply only genuinely new
migrations (including `20260705090600_guide_rls_policies.sql`, which is NOT
included in the repair because it has never been run on production).

### Step 3 (optional) — capture the rest of the pre-existing schema

The lifted migrations cover the guide system only. Everything else in production
(courses, proposals, events, membership, RLS enablement, etc. — the other files
in `db/`) has no corresponding migration yet. To capture that pre-existing schema
as a baseline migration, pull it from the remote:

```bash
supabase db pull
# -> writes a new supabase/migrations/<timestamp>_remote_schema.sql
```

`db pull` diffs the remote schema against local migration history and writes the
difference as a new migration, then marks it applied remotely. Review the
generated file, give it a clear name, and commit it. From that point on,
`supabase/migrations/` describes the entire production schema and the `db/` files
are purely historical.

> Order note: if you run `db pull` **before** the repair in Step 2, the pulled
> schema will include the guide tables (they already exist remotely) and you may
> get overlap with the lifted migrations. Do Step 2 first, then Step 3.

---

## Legacy `db/` files — what state they represent

The `db/` directory holds SQL that was applied to production **by hand** over
time, before CLI discipline existed. It is **frozen**: kept for provenance, never
edited or deleted, and not read by any Supabase CLI command.

The guide-system files below were **already applied to production** and are the
ones lifted into `supabase/migrations/`:

- `migration-guides.sql`, `migration-guide-verification.sql`,
  `migration-guide-disputes.sql`, `migration-guide-materials.sql`,
  `migration-verifier-tests.sql`, `migration-guide-rewards.sql`
- `seed-guides.sql` (lifted into `supabase/seed.sql`)

One additional `db/` file has been lifted as a **new** migration (not yet applied
to production):

- `migration-rls-policies.sql` → `20260705090600_guide_rls_policies.sql`

The remaining `db/` files (`schema.sql`, `migration-proposals.sql`,
`migration-events.sql`, `migration-membership-orders.sql`,
`migration-enable-rls.sql`, `migration-enable-rls-all-tables.sql`,
rename/cleanup scripts, etc.) also represent live production state but have
**not** been lifted into migrations. Capture them via `supabase db pull`
(Step 3 above) if and when you want them under CLI management.

**Rule going forward:** treat `db/` as read-only history. Every new change is a
new file in `supabase/migrations/`.
