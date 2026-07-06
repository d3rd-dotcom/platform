# Re-seed orphans user progress

## What happened

The `creative-healing` course was deleted and re-seeded (via `scripts/seed-creative-healing.ts`), which generated new UUIDs for every component in `course_components`. User progress in the `weeks` table still referenced the old UUIDs.

## The error

Sealing a week fails with: `This week has no sealable tasks.`

Server-side, `getRequiredSectionIds(weekNumber)` calls `getVipCourseFullBySlug('creative-healing')` which returns null — the course doesn't exist. Client-side, `useCourseSections` can't load sections either (but a stale JS cache may briefly hide this).

## What broke

| Table | Status |
|---|---|
| `vip_courses` | Dropped + re-seeded — new course UUID, component UUIDs |
| `course_weeks` | Dropped + re-seeded — new week UUIDs |
| `course_components` | Dropped + re-seeded — new component UUIDs |
| `weeks` (user progress) | Intact — but `progress_data.completedSections`, `sectionData` keys, `checklistStates` keys, `credited_sections` all hold stale UUIDs (or old hardcoded string IDs) |

## Why it's dangerous

`sectionData` is a `Record<string, unknown>` keyed by component UUID. If the course is ever deleted and re-inserted (even with identical content), every user's saved journal text becomes inaccessible because the keys no longer match any component.

## What's safe

- Adding/removing missions normally — UUIDs of existing components stay stable
- The `weeks` table schema (uses `is_sealed`, `credited_sections`, etc.) — those fields don't depend on component UUIDs
- Non-ID-keyed fields: `blurtEntries`, `enjoyListEntries`, `timeMapActivities`, `lifePieValues`
- Seal status (`is_sealed`) — pure boolean on the progress row

## Lesson

`sectionData[keyed by UUID]` is fragile. An alternative like `sectionData[weekNumber][positionalIndex]` would survive re-seeds (at the cost of breaking if task order changes). Not worth refactoring unless re-seeding becomes a regular operation.
