# Phase 02 — Hierarchical Knowledge Base inside /courses

**Status:** Complete (reviewed). TypeScript compiles clean (0 errors).

## What was built

**Data access — `lib/guides-db.ts`** (follows `vip-course-db.ts` conventions): `getGuideBySlug`, `listGuides` (subject/status filters), `createGuide`, `getWalkthrough` (leveled closure), `getUserGuideProgress`, `completeGuide` — the gate lives server-side: completing a guide with incomplete direct prereqs returns 409 with the missing topic titles.

**API — `app/api/guides/`**
- `route.ts` — GET published list; POST create-as-draft (Privy auth, VIP-gated like course authoring).
- `[slug]/route.ts` — guide + methods + direct prereqs/dependents. Published guides are public; drafts author-only.
- `[slug]/walkthrough/route.ts` — leveled walkthrough, enriched with viewer progress when signed in.
- `progress/route.ts` — GET completed ids; POST complete (gate enforced).

**UI — inside /courses only**
- `app/courses/guides/[slug]/page.tsx` — guide page rendering body through the existing `course-renderers` (guides are course content with a DAG on top — no parallel rendering stack), prereq/dependent links, collapsible methods, walkthrough entry.
- `app/courses/guides/[slug]/walkthrough/` — leveled climb view: guides grouped by computed level, rendered bottom-up, "Level N of M" indicator, upper levels visually locked until every lower-level guide is complete. This is the leveling-up/anti-fatigue mechanic.
- `components/guides/` — `GuideBody`, `GuideMethods`, `GuideWalkthrough` (+ CSS modules on the new typography system and existing design tokens). Kept out of `components/home/` to avoid colliding with the typography pass.
- `app/courses/page.tsx` — ONE added section, "Knowledge Base," listing published guides grouped by subject, reusing the existing authored-card styles. **Right-side column and CourseFolderCard / ProfileDashboard / FieldNotesSheet placement untouched** (verified in diff — additions only, no moved JSX).

## Review verdict

- `tsc --noEmit`: clean.
- /courses diff: additive only; layout constraint honored.
- Guide bodies reuse `CourseComponentRecord` adaptation rather than a new renderer — clean integration, one content pipeline.
- Auth mirrors VIP course routes; public can read published guides, must sign in to track progress.

## To activate

1. Run `db/migration-guides.sql`, then `db/seed-guides.sql`.
2. Visit `/courses` — Knowledge Base section appears once published guides exist.
3. Optional: run `db/cleanup-custom-courses.sql` to drop old custom courses.

## Follow-ups (later phases)

- Guide-authoring mode in course-builder (kept off it this wave; typography agent owned those files).
- Diamond/XP payout on level completion — hook point is `completeGuide`; wire to quests loop when Phase 3 verification makes completion trustworthy.
