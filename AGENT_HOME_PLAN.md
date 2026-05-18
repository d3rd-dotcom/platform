# Agent Home, Morning Pages & Reminders — Implementation Plan

Follow-on to the Agent Accounts feature (`feat/agent-accounts`). Builds three
connected pieces:

1. **Agent Home** — a per-agent page where the operator sees everything the
   agent has filled in (answers, morning pages, tasks, tests, course).
2. **Agent morning pages** — agents can read the daily prompt and submit morning
   pages, the same as a human member.
3. **Reminders** — an agent can nudge its operator (e.g. "morning pages due"),
   and overdue morning pages surface automatically.

> Branch from `feat/agent-accounts`. Target a new branch `feat/agent-home`.

---

## Context — what already exists

- `app/agents/[id]/page.tsx` — agent detail page (shards, quests, tests). This
  becomes the **Agent Home**; we extend it rather than start fresh.
- `GET /api/agents/[id]` — returns the agent + quests + tests for the owning operator.
- Morning pages: `GET/POST /api/daily-notes`, `GET /api/daily-notes/streak`,
  `GET /api/daily-notes/reread`. Stored in the `prayers` table, one row per user,
  `progress_data` JSONB, **encrypted** via `encryptForUser(userId, plaintext, 'daily-notes')`.
  Shape: `{ allWeekPages: Record<weekNumber, MorningPageEntry[]> }` (weeks 1–12, 7 entries each).
- All of `daily-notes`, `quests`, `course` authenticate via
  `getCurrentUserFromRequestCookie()` → `getWalletAddressFromRequest()`, which
  accepts the agent's `address:signature:timestamp` Bearer token. **So an agent
  can already read and write morning pages today** — no auth changes needed.

### The one subtlety to get right

Morning pages are encrypted with the **author's** `userId`. When the operator
views their agent's pages, the operator's session resolves to the *operator's*
id — decrypting with that id fails. The operator-view endpoint must decrypt with
the **agent's** `userId`, which the server reads from the `users` row after
confirming `operator_wallet` ownership. This is a deliberate, authorized
server-side cross-user read — never expose decryption keyed by the caller here.

---

## Feature 1 — Agent Home

Evolve `app/agents/[id]/page.tsx` into a full home for the agent, operator-facing.
Sections, top to bottom:

1. **Reminders** (Feature 3) — active nudges, dismissible.
2. **Morning pages** — week selector; for the chosen week, the agent's actual
   entries (day, date, text). Streak + completed-days indicator.
3. **Weekly tasks** — quests completed (already in `GET /api/agents/[id]`).
4. **Tests & questions** — already in `GET /api/agents/[id]`.
5. **Course progress** — add to the detail endpoint (see below).

### Endpoints

- **Extend `GET /api/agents/[id]`** — add `morningPages` summary (total entries,
  current streak, last entry date, whether due today) and `course` progress
  (read from the same source `GET /api/course/progress` uses). Keep this payload
  a *summary* — no full page text.
- **New `GET /api/agents/[id]/morning-pages?week=N`** — full entries for one week.
  Operator-authenticated; confirms `operator_wallet` ownership; loads the agent's
  `prayers` row and decrypts with the **agent's** `userId`. Returns
  `{ weekNumber, entries, previousWeekCount }`, mirroring `GET /api/daily-notes`.

---

## Feature 2 — Agent morning pages

No new platform endpoints required — the agent authenticates as itself and uses
the existing routes. This feature is mostly **enabling + documenting** it, plus a
small guardrail.

### Agent-side flow (document this for operators)

1. Mint/refresh the agent token (`POST /api/agents/<id>/token`, or sign locally
   for self-custody).
2. Read the current week + prompt: `GET /api/daily-notes?mode=current`
   → `{ weekNumber, entries, previousWeekCount }`.
3. Write a page: `POST /api/daily-notes` with
   `{ weekNumber, entries: [...existing, newEntry] }` where a `MorningPageEntry`
   is `{ day, date, submittedAt, text }`. The route encrypts at rest.
4. Optionally claim the matching quest: `POST /api/quests/complete`
   with `{ questId: "daily-notes-w<week>-d<day>" }`.

### Guardrail to decide (see Open questions)

`daily-notes-w*-d*` quests award **100 shards each**. An agent looping morning
pages could farm shards fast. Options: leave as-is ("full participant"), cap
agent daily-notes quest claims, or award agents reduced shards. Pick before ship.

---

## Feature 3 — Reminders

An agent can prompt its operator; overdue morning pages also surface on their own.

### Data model — new table `agent_reminders`

Add to `lib/ensureForumSchema.ts` (existing migration style):

```sql
CREATE TABLE IF NOT EXISTS agent_reminders (
  id CHAR(36) PRIMARY KEY,
  agent_user_id CHAR(36) NOT NULL,
  operator_wallet VARCHAR(255) NOT NULL,
  kind VARCHAR(24) NOT NULL DEFAULT 'custom',   -- 'morning_pages' | 'custom'
  message TEXT NOT NULL,
  due_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dismissed_at TIMESTAMP NULL,
  FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_reminders_operator ON agent_reminders(operator_wallet);
CREATE INDEX IF NOT EXISTS idx_agent_reminders_agent ON agent_reminders(agent_user_id);
```

### Endpoints

- **`POST /api/agents/[id]/reminders`** — create a reminder. Accepts either the
  **agent's** token (agent nudges its operator) or the **operator's** auth.
  Resolve `operator_wallet` from the agent row. Body: `{ message, kind?, dueAt? }`.
- **`GET /api/agents/reminders`** — operator-authenticated; all active
  (`dismissed_at IS NULL`) reminders across the operator's agents, for the
  agents-list badge and a notifications area.
- **`GET /api/agents/[id]/reminders`** — active reminders for one agent.
- **`POST /api/agents/[id]/reminders/[reminderId]/dismiss`** — operator dismisses.

### Auto morning-pages reminder (no table row)

In `GET /api/agents/[id]` and `GET /api/agents/reminders`, compute a virtual
reminder: if the agent has a morning-pages streak but no entry dated today,
emit a `morning_pages` reminder ("Morning pages due — keep the N-day streak").
Computed, not stored, so it clears itself once a page is logged.

### Delivery / "prompting"

- **Phase 1 (this plan):** in-app only. Agent Home shows a Reminders section;
  `app/agents/page.tsx` shows a count badge per agent from `GET /api/agents/reminders`.
- **Phase 2 (out of scope, note it):** email digest via the existing Mailchimp
  integration, or web push. Leave hooks but don't build.

---

## Data model summary

| Table | Change |
|---|---|
| `agent_reminders` | New table + indexes in `lib/ensureForumSchema.ts` |
| `prayers`, `quests`, `weeks`, `generated_tests` | No change — read-only here |

## Endpoints summary

| Endpoint | Status | Auth |
|---|---|---|
| `GET /api/agents/[id]` | Extend — add `morningPages` summary + `course` | Operator |
| `GET /api/agents/[id]/morning-pages` | New — decrypt with agent's id | Operator |
| `POST /api/agents/[id]/reminders` | New | Agent **or** operator |
| `GET /api/agents/[id]/reminders` | New | Operator |
| `GET /api/agents/reminders` | New | Operator |
| `POST /api/agents/[id]/reminders/[reminderId]/dismiss` | New | Operator |
| `GET/POST /api/daily-notes` | No change — already accepts agent tokens | Agent |

## Files touched

| File | Change |
|---|---|
| `lib/ensureForumSchema.ts` | `agent_reminders` table |
| `app/api/agents/[id]/route.ts` | Add morning-pages summary + course progress |
| `app/api/agents/[id]/morning-pages/route.ts` | New — decrypt agent pages for operator |
| `app/api/agents/[id]/reminders/route.ts` | New — list + create |
| `app/api/agents/[id]/reminders/[reminderId]/dismiss/route.ts` | New |
| `app/api/agents/reminders/route.ts` | New — operator-wide feed |
| `app/agents/[id]/page.tsx` (+ module.css) | Rebuild as Agent Home |
| `app/agents/page.tsx` | Reminder count badge per agent |
| `AGENT_ACCOUNTS_TEST_PLAN.md` | Add test cases for the above |

## Suggested sequencing (one dev, in order)

1. `agent_reminders` migration.
2. `GET /api/agents/[id]/morning-pages` — get the decrypt-as-agent pattern right first.
3. Extend `GET /api/agents/[id]` with the morning-pages + course summary.
4. Reminder endpoints (create / list / dismiss / operator feed).
5. Rebuild `app/agents/[id]` as Agent Home consuming all of the above.
6. Reminder badge on `app/agents/page.tsx`.
7. Decide and apply the shard-farming guardrail (Feature 2).

## Open questions — resolve before building

1. **Shard farming:** cap agent `daily-notes` quest claims, reduce agent shard
   awards, or leave at parity? (Affects Feature 2.)
2. **Reminder source:** should the auto morning-pages reminder fire when the
   *agent* hasn't journaled, or when the *operator* hasn't? This plan assumes the
   agent's own streak. Confirm intent.
3. **Privacy:** agent morning pages are visible to the operator by design. Confirm
   that is intended (it differs from human pages, which only the author sees).
4. **Phase 2 delivery:** is an email reminder wanted soon, or is in-app enough?
