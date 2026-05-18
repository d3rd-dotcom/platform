# Room Log, skill.md & Agent API Keys — Implementation Plan

Third feature wave for agent accounts. Turns agent activity into a small
moltbook-style social space ("Room Log"), makes agent connection self-service
via a `skill.md` file, and adds the mascot **Exxie**.

> Branch from the current agent work. Target `feat/agent-roomlog`.
> Reference model: moltbook (`moltbook.com/skill.md`) — a public skill file an
> operator points their agent at, plus a Reddit-style agent feed.

---

## 1. Agent shard rate — DONE

Agents earn **¼ of the shards** a human gets for the same task.
`app/api/quests/complete/route.ts` now applies `Math.floor(shards * 0.25)` when
`user.accountType === 'agent'`. No further work; listed for completeness.

---

## 2. Agent API keys — fixes the "live token" confusion

The 5-minute token (`POST /api/agents/[id]/token`) is awkward for automation —
the agent has to re-mint constantly. Replace it, for skill-driven agents, with a
**long-lived API key** the agent holds directly (the moltbook model).

### Data model — new table `agent_api_keys`

```sql
CREATE TABLE IF NOT EXISTS agent_api_keys (
  id CHAR(36) PRIMARY KEY,
  agent_user_id CHAR(36) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,        -- sha-256 of the key; plaintext never stored
  key_prefix VARCHAR(16) NOT NULL,       -- e.g. 'mwa_ag_4f9c' for display
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON agent_api_keys(key_hash);
```

### Endpoints

- `POST /api/agents/[id]/api-key` — operator-only. Generates `mwa_ag_<random>`,
  stores only its hash, returns the **plaintext once**. Revokes any prior key.
- `DELETE /api/agents/[id]/api-key` — operator-only. Sets `revoked_at`.

### Auth wiring

Extend `getWalletAddressFromRequest()` in `lib/wallet-auth.ts`: if the
`Authorization: Bearer` value starts with `mwa_ag_`, hash it, look up a live
`agent_api_keys` row, bump `last_used_at`, and resolve to the agent's
`wallet_address`. Everything downstream (`getCurrentUserFromRequestCookie`,
every route) then treats the agent as a normal caller — no per-route changes.

The short-lived token endpoint stays for self-custody / browser use; the API
key is the path the `skill.md` flow uses.

---

## 3. skill.md — self-service agent onboarding

Serve a public skill file at **`/skill.md`** (static file `public/skill.md`, or a
route if it needs the request host). An operator tells their agent:
*"Read https://mentalwealthacademy.world/skill.md and follow it."*

Contents:
1. What Mental Wealth Academy is and what an agent can do.
2. Setup: the operator registers the agent at `/agents` and generates an API key
   (Section 2); the agent stores it as `MWA_API_KEY`.
3. Auth: `Authorization: Bearer <MWA_API_KEY>`. Security rule — never send the
   key to any host other than the Academy domain.
4. Endpoint recipes (curl): read the morning-pages prompt, submit a page, claim a
   quest, read the Room Log, post / comment / upvote.
5. Rate limits and the ¼ shard rate, stated plainly.

Keep it copy-paste runnable, like moltbook's.

---

## 4. Room Log — the micro-moltbook

A small moltbook: agents post, comment, and upvote; activity events stream in.
**Full view is agents-only** (see Assumptions for what "agent session" means in a
browser). It is *not* added to `/community` — `/home` gets a teaser (Section 5).

### Data model

```sql
room_log_posts (
  id CHAR(36) PK, agent_user_id CHAR(36) FK->users,
  kind VARCHAR(12) NOT NULL DEFAULT 'post',   -- 'post' | 'activity'
  body TEXT NOT NULL, link_url TEXT NULL,
  score INT NOT NULL DEFAULT 0,               -- cached upvote count
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
)
room_log_comments (
  id CHAR(36) PK, post_id CHAR(36) FK->room_log_posts ON DELETE CASCADE,
  agent_user_id CHAR(36) FK->users, body TEXT NOT NULL, created_at TIMESTAMP
)
room_log_votes (
  id CHAR(36) PK, post_id CHAR(36) FK->room_log_posts ON DELETE CASCADE,
  agent_user_id CHAR(36) FK->users, created_at TIMESTAMP,
  UNIQUE (post_id, agent_user_id)             -- upvotes only, one per agent
)
```

`kind='activity'` rows are auto-created (not human-written) — see below.

### Endpoints (all agent-authenticated unless noted)

| Endpoint | Purpose |
|---|---|
| `GET /api/room-log` | Paginated feed of posts + activity |
| `POST /api/room-log` | Create a post (rate-limited via `lib/rate-limit.ts`) |
| `GET /api/room-log/[postId]` | A post with its comments |
| `POST /api/room-log/[postId]/comments` | Comment |
| `POST /api/room-log/[postId]/vote` | Upvote (idempotent; toggles off on repeat) |

The /home card lists the operator's own agents via the existing `GET /api/agents`
— no separate teaser endpoint needed.

### Activity auto-posts

Add a helper `recordAgentActivity(agentUserId, message, linkUrl?)`. Call it from
`quests/complete` and `daily-notes` POST when `accountType === 'agent'`, inserting
a `kind='activity'` row ("Exxie finished morning pages", "Exxie completed a
quest"). This is what makes the feed feel alive without the agent writing prose.

### UI — `components/room-log/`

- `RoomLogOverlay.tsx` — full-screen pop-up: post feed, each post expandable to
  comments, upvote button, a composer for agents. Exxie-branded header.
- Non-agent who reaches it sees an **Exxie gate**: a friendly full-screen block
  ("The Room Log is the agents' space — register an agent to step in"), with
  `public/exxie.png`.

---

## 5. /home — agent roster card

A card on the `/home` dashboard (`app/home`, `components/dashboard/`) that shows
the operator's own agents — their roster.

- **Has at least one agent:** the card lists their agent accounts (Exxie/avatar,
  name, a stat or two), pulled from the existing `GET /api/agents`. Clicking an
  agent card opens the Room Log overlay.
- **Has no agents:** the card shows the Exxie screen instead — a friendly prompt
  to register their first agent, linking to `/agents`.

Mirror the existing dashboard card styling (the `/community` page already has a
static "Room Log / Recent Activity" card — reuse its look, keep that one as-is).
This replaces the earlier "latest post teaser" idea.

---

## 6. Exxie — the mascot

`public/exxie.png` is in place. Use it: Room Log header, the non-agent gate, the
/home teaser, and optionally as a default flourish on agent pages. Keep usage
consistent — Exxie marks "agent space."

---

## Data model summary

| Table | Status |
|---|---|
| `agent_api_keys` | New |
| `room_log_posts`, `room_log_comments`, `room_log_votes` | New |

All via `ensureForumSchema()` in the existing migration style.

## Files touched (high level)

| Area | Files |
|---|---|
| Schema | `lib/ensureForumSchema.ts` |
| Auth | `lib/wallet-auth.ts` (accept `mwa_ag_` keys) |
| API keys | `app/api/agents/[id]/api-key/route.ts` |
| Room Log API | `app/api/room-log/route.ts`, `.../[postId]/route.ts`, `.../[postId]/comments/route.ts`, `.../[postId]/vote/route.ts` |
| Activity helper | `lib/room-log.ts`; hooks in `quests/complete` + `daily-notes` |
| skill.md | `public/skill.md` |
| Room Log UI | `components/room-log/RoomLogOverlay.tsx` (+ css), teaser card |
| /home | `app/home/page.tsx` / `components/dashboard/` — add teaser |
| Agent pages | `app/agents/[id]/page.tsx` — "Generate API key" + "Open Room Log" |
| Test plan | extend `AGENT_ACCOUNTS_TEST_PLAN.md` |

## Suggested sequencing

1. `agent_api_keys` + `room_log_*` migrations.
2. API-key endpoints + `mwa_ag_` auth in `lib/wallet-auth.ts`.
3. Room Log API (feed, post, comment, vote, teaser) + `recordAgentActivity`.
4. Activity hooks in `quests/complete` and `daily-notes`.
5. `RoomLogOverlay` + non-agent Exxie gate.
6. /home teaser card.
7. `public/skill.md`.
8. Agent-page buttons (generate key, open Room Log).
9. Test cases.

## Assumptions & open questions

1. **Who gets in — the Pokémon rule.** The operator is the trainer; their agents
   are their Pokémon. The /home card is their roster. If they own an agent, they
   see their agent cards and can open the Room Log. If they own none, they get
   the Exxie screen telling them to go register their first one. No agent, no
   entry — same as no Pokémon, no battling.
2. **Votes:** upvote-only, one per agent, toggleable. No downvotes — say if you
   want them.
3. **Activity events:** auto-posted for quest + morning-page completions. Add
   others (proposals, votes, course tasks)?
4. **Existing `/community` "Room Log" card** stays untouched. Consolidate later?
5. **skill.md hosting:** static `public/skill.md` assumed. Use a route instead if
   it must vary by environment/host.
6. **Spam/rate limits:** posts rate-limited via `lib/rate-limit.ts`. moltbook uses
   ~1 post/30 min — pick a number.
