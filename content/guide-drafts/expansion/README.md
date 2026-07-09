# Guide expansion drafts

These drafts are original Mental Wealth Academy educational syntheses written
for learners from middle school through college. Each file includes a source
trail in its metadata header. The source trail supports fact checking; the body
is newly written and should still receive contributor review before publication.

The collection adds five subject lanes:

- Mindfulness and Meditation
- Wellness Science
- Research and Statistics
- Social Psychology
- Decision Making

Run `npx tsx --env-file=.env.local scripts/seed-guide-expansion.ts --dry-run`
to inspect the graph plan. The seed script inserts guides first, then canonical
subjects, then prerequisite edges. The database cycle trigger remains the final
check on every edge.

Use `--refresh` after editing one of these seed-owned drafts to update its body
and metadata while preserving the guide identity and prerequisite edges.
