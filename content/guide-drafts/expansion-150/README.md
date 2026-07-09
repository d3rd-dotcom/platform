# 150-guide expansion catalog

This collection adds 130 guide records to the 41-guide production graph,
bringing the catalog to 171 published guides. The
catalog is grouped into twelve lanes so a contributor can scan one discipline,
edit a lesson, or add a prerequisite without searching through SQL.

The seed script writes in three passes:

1. Create every guide with published status, metadata, evidence criteria, and a
   three-part learner body.
2. Resolve canonical subject IDs from the subject migration.
3. Insert prerequisite edges. The database cycle trigger validates every edge.

Run a dry run first:

`npx tsx --env-file=.env.local scripts/seed-guide-expansion-150.ts --dry-run`

Apply the collection with:

`npx tsx --env-file=.env.local scripts/seed-guide-expansion-150.ts`

The catalog is original MWA educational synthesis. Each lane records the
source family used for fact checking in the guide source metadata. Contributors
should keep examples age-appropriate, preserve evidence limits, and add a new
topic title instead of creating a duplicate.
