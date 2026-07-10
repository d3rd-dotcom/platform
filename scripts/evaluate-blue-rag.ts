import dotenv from 'dotenv';
import { runBlueRagGraph } from '../lib/blue-rag-graph';
import { isDbConfigured, sqlQuery } from '../lib/db';
import { ensureBlueRagSchema } from '../lib/ensureBlueRagSchema';
import { ensureBlueRagReady } from '../lib/blue-rag-index';

dotenv.config({ path: '.env.local' });

interface Fixture {
  name: string;
  message: string;
  pathname?: string;
  shouldTrust: boolean;
  expectedTopIds?: string[];
  minCoverage?: number;
}

const fixtures: Fixture[] = [
  {
    name: 'vip membership facts',
    message: 'how much is vip membership and what does it unlock?',
    pathname: '/shop',
    shouldTrust: true,
    expectedTopIds: ['vip-membership'],
    minCoverage: 0.7,
  },
  {
    name: 'field notes navigation',
    message: 'where do i find field notes?',
    pathname: '/home',
    shouldTrust: true,
    expectedTopIds: ['page-quests', 'feature-field-notes'],
    minCoverage: 0.7,
  },
  {
    name: 'kalshi markets',
    message: 'what markets can the treasury trade?',
    pathname: '/markets',
    shouldTrust: true,
    expectedTopIds: ['page-markets'],
    minCoverage: 0.6,
  },
  {
    name: 'feature rails',
    message: 'what are gem credits tickets membership and usdc for?',
    pathname: '/rewards',
    shouldTrust: true,
    expectedTopIds: ['company-economy'],
    minCoverage: 0.7,
  },
  {
    name: 'academic angel unlocks',
    message: 'what does Academic Angel unlock?',
    pathname: '/shop',
    shouldTrust: true,
    expectedTopIds: ['academic-angel-membership'],
    minCoverage: 0.7,
  },
  {
    name: 'academic angel treasury proposal access',
    message: 'do Academic Angels get voting rights and treasury proposal access?',
    pathname: '/community',
    shouldTrust: true,
    expectedTopIds: ['academic-angel-membership', 'community-treasury'],
    minCoverage: 0.7,
  },
  {
    name: 'course foundation',
    message: 'what is the course based on?',
    pathname: '/shadow-work',
    shouldTrust: true,
    expectedTopIds: ['page-course'],
    minCoverage: 0.6,
  },
  {
    name: 'inner artist shadow work',
    message: 'is the course about awakening the inner artist and shadow work?',
    pathname: '/shadow-work',
    shouldTrust: true,
    expectedTopIds: ['page-course'],
    minCoverage: 0.7,
  },
  {
    name: 'prompts library use',
    message: 'what is the prompts library for?',
    pathname: '/prompts',
    shouldTrust: true,
    expectedTopIds: ['page-prompts'],
    minCoverage: 0.6,
  },
  {
    name: 'surveys badges certificates',
    message: 'can surveys earn badges or certificates?',
    pathname: '/surveys',
    shouldTrust: true,
    expectedTopIds: ['page-surveys'],
    minCoverage: 0.7,
  },
  {
    name: 'events refresh reset',
    message: 'what are events for and are they free?',
    pathname: '/events',
    shouldTrust: true,
    expectedTopIds: ['page-events'],
    minCoverage: 0.6,
  },
  {
    name: 'pro features staff vip',
    message: 'who gets pro features and staff VIP cards?',
    pathname: '/profile',
    shouldTrust: true,
    expectedTopIds: ['pro-features-staff-vip', 'vip-membership'],
    minCoverage: 0.7,
  },
  {
    name: 'quests community reinvestment',
    message: 'what are quests supposed to promote?',
    pathname: '/quests',
    shouldTrust: true,
    expectedTopIds: ['page-quests'],
    minCoverage: 0.5,
  },
  {
    name: 'community treasury reinvestment',
    message: 'what does the community treasury do with profit?',
    pathname: '/community',
    shouldTrust: true,
    expectedTopIds: ['community-treasury'],
    minCoverage: 0.7,
  },
  {
    name: 'community size membership caps',
    message: 'how big can the community get if anyone can join?',
    pathname: '/community',
    shouldTrust: true,
    expectedTopIds: ['community-size-and-membership-caps'],
    minCoverage: 0.6,
  },
  {
    name: 'safety anonymity async',
    message: 'how does MWA protect anonymity and let people participate async?',
    pathname: '/profile',
    shouldTrust: true,
    expectedTopIds: ['safety-anonymity-and-async-work'],
    minCoverage: 0.7,
  },
  {
    name: 'why seasons',
    message: 'why does MWA use 12 week seasons?',
    pathname: '/shadow-work',
    shouldTrust: true,
    expectedTopIds: ['page-course'],
    minCoverage: 0.6,
  },
  {
    name: 'shop swag credits',
    message: 'what is the shop for and can credits reduce prices?',
    pathname: '/shop',
    shouldTrust: true,
    expectedTopIds: ['page-shop'],
    minCoverage: 0.6,
  },
  {
    name: 'blue headset backstory',
    message: 'is Blue the avatar or inside the headset?',
    pathname: '/home',
    shouldTrust: true,
    expectedTopIds: ['feature-blue-persona'],
    minCoverage: 0.7,
  },
  {
    name: 'unsupported company officer claim',
    message: 'tell me the exact CFO of MWA',
    pathname: '/home',
    shouldTrust: false,
    minCoverage: 0,
  },
];

async function main() {
  const dbEnabled = isDbConfigured() && process.env.BLUE_RAG_EVAL_FORCE_LOCAL !== '1';
  let runId: string | null = null;

  if (dbEnabled) {
    await ensureBlueRagSchema();
    await ensureBlueRagReady();
    await upsertEvalCases();
    const runRows = await sqlQuery<Array<{ id: string }>>(
      `INSERT INTO blue_rag_eval_runs (suite, retrieval_mode, metadata)
       VALUES (:suite, :retrievalMode, :metadata::jsonb)
       RETURNING id`,
      {
        suite: 'default',
        retrievalMode: 'database',
        metadata: JSON.stringify({ fixtureCount: fixtures.length }),
      }
    );
    runId = runRows[0]?.id ?? null;
  }

  let failures = 0;

  for (const fixture of fixtures) {
    const result = await runBlueRagGraph({
      message: fixture.message,
      pathname: fixture.pathname,
      limit: 4,
      forceLocal: !dbEnabled,
      persistTrace: dbEnabled,
    });

    const topId = result.entries[0]?.sourceId || result.entries[0]?.id || 'none';
    const trustOk = result.quality.trusted === fixture.shouldTrust;
    const topOk = !fixture.expectedTopIds || fixture.expectedTopIds.includes(topId);
    const coverageOk = result.quality.coverage >= (fixture.minCoverage ?? 0);
    const ok = trustOk && topOk && coverageOk;

    if (!ok) failures += 1;

    console.log(JSON.stringify({
      ok,
      name: fixture.name,
      trusted: result.quality.trusted,
      expectedTrusted: fixture.shouldTrust,
      label: result.quality.label,
      coverage: result.quality.coverage,
      retrievalMode: result.retrievalMode,
      topId,
      expectedTopIds: fixture.expectedTopIds ?? [],
      reasons: result.quality.reasons,
    }));

    if (dbEnabled && runId) {
      await sqlQuery(
        `INSERT INTO blue_rag_eval_results (
           run_id,
           case_id,
           passed,
           top_source_id,
           quality,
           selected_chunk_ids,
           reasons
         )
         VALUES (
           :runId,
           :caseId,
           :passed,
           :topSourceId,
           :quality::jsonb,
           :selectedChunkIds::text[],
           :reasons::text[]
         )`,
        {
          runId,
          caseId: slug(fixture.name),
          passed: ok,
          topSourceId: topId === 'none' ? null : topId,
          quality: JSON.stringify(result.quality),
          selectedChunkIds: result.entries.map((entry) => entry.chunkId || entry.id).filter(Boolean),
          reasons: result.quality.reasons,
        }
      );
    }
  }

  if (dbEnabled && runId) {
    await sqlQuery(
      `UPDATE blue_rag_eval_runs
       SET passed = :passed, failed = :failed
       WHERE id = :runId`,
      {
        runId,
        passed: fixtures.length - failures,
        failed: failures,
      }
    );
  }

  if (failures > 0) {
    console.error(`Blue RAG eval failed: ${failures}/${fixtures.length}`);
    process.exit(1);
  }

  console.log(`Blue RAG eval passed: ${fixtures.length}/${fixtures.length}`);
  process.exit(0);
}

async function upsertEvalCases() {
  for (const fixture of fixtures) {
    await sqlQuery(
      `INSERT INTO blue_rag_eval_cases (
         id,
         suite,
         query,
         pathname,
         expected_source_ids,
         expected_chunk_ids,
         should_trust,
         min_coverage,
         metadata,
         enabled
       )
       VALUES (
         :id,
         'default',
         :query,
         :pathname,
         :expectedSourceIds::text[],
         ARRAY[]::text[],
         :shouldTrust,
         :minCoverage,
         :metadata::jsonb,
         TRUE
       )
       ON CONFLICT (id)
       DO UPDATE SET
         query = EXCLUDED.query,
         pathname = EXCLUDED.pathname,
         expected_source_ids = EXCLUDED.expected_source_ids,
         should_trust = EXCLUDED.should_trust,
         min_coverage = EXCLUDED.min_coverage,
         metadata = EXCLUDED.metadata,
         enabled = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      {
        id: slug(fixture.name),
        query: fixture.message,
        pathname: fixture.pathname ?? null,
        expectedSourceIds: fixture.expectedTopIds ?? [],
        shouldTrust: fixture.shouldTrust,
        minCoverage: fixture.minCoverage ?? 0,
        metadata: JSON.stringify({ name: fixture.name }),
      }
    );
  }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
