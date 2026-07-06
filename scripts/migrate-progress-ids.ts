/**
 * Migration: remap orphaned component IDs in weeks.progress_data
 * and weeks.credited_sections to match the re-seeded course.
 *
 * The creative-healing course was deleted and re-seeded, so all component
 * UUIDs changed. User progress_data stores old IDs (both UUIDs and legacy
 * string IDs from the hardcoded era). This script maps them positionally
 * (same order, same week) to the new component IDs.
 *
 * Usage: npx tsx -r dotenv/config scripts/migrate-progress-ids.ts dotenv_config_path=.env.local
 */
import { sqlQuery } from '../lib/db';
import { getVipCourseFullBySlug } from '../lib/vip-course-db';

async function main() {
  const course = await getVipCourseFullBySlug('creative-healing');
  if (!course) {
    console.error('Course creative-healing not found in DB.');
    process.exit(1);
  }

  // Build per-week list of new task component IDs (excluding reading/file-upload)
  const weekNewIds: Record<number, string[]> = {};
  for (const w of course.weeks) {
    weekNewIds[w.weekNumber] = w.components
      .filter((comp) => {
        const c = comp.config as Record<string, unknown>;
        return !(typeof c.url === 'string' && typeof c.imageUrl === 'string' && typeof c.originalName === 'string');
      })
      .map((comp) => comp.id);
    console.log(`  Week ${w.weekNumber}: ${weekNewIds[w.weekNumber].length} task components`);
  }

  const rows = await sqlQuery<Array<{
    id: string; user_id: string; week_number: number;
    progress_data: any; credited_sections: string[] | null;
  }>>('SELECT id, user_id, week_number, progress_data, credited_sections FROM weeks ORDER BY week_number');

  console.log(`\nProcessing ${rows.length} user-progress rows...\n`);

  for (const row of rows) {
    const wn = row.week_number;
    const newIds = weekNewIds[wn];
    if (!newIds || newIds.length === 0) {
      console.log(`  Week ${wn}: no task components, clearing progress`);
      await sqlQuery(
        `UPDATE weeks SET progress_data = '{}'::jsonb, credited_sections = '[]'::jsonb WHERE id = :id`,
        { id: row.id }
      );
      continue;
    }

    const pd = row.progress_data || {};

    // ── sectionData: remap keys positionally ──
    const newSectionData: Record<string, unknown> = {};
    if (pd.sectionData && typeof pd.sectionData === 'object') {
      const oldKeys = Object.keys(pd.sectionData);
      const oldValues = Object.values(pd.sectionData);
      for (let i = 0; i < Math.min(oldKeys.length, newIds.length); i++) {
        newSectionData[newIds[i]] = oldValues[i];
      }
    }

    // ── checklistStates: remap keys positionally ──
    const newChecklistStates: Record<string, boolean[]> = {};
    if (pd.checklistStates && typeof pd.checklistStates === 'object') {
      const oldKeys = Object.keys(pd.checklistStates);
      const oldValues = Object.values(pd.checklistStates) as boolean[][];
      for (let i = 0; i < Math.min(oldKeys.length, newIds.length); i++) {
        newChecklistStates[newIds[i]] = oldValues[i];
      }
    }

    // ── completedSections: remap array items positionally ──
    const oldCompleted: string[] = Array.isArray(pd.completedSections) ? pd.completedSections : [];
    const newCompleted: string[] = [];
    for (let i = 0; i < Math.min(oldCompleted.length, newIds.length); i++) {
      newCompleted.push(newIds[i]);
    }

    // ── credited_sections: remap array items positionally ──
    const oldCredited = Array.isArray(row.credited_sections) ? row.credited_sections : [];
    const newCredited: string[] = [];
    for (let i = 0; i < Math.min(oldCredited.length, newIds.length); i++) {
      newCredited.push(newIds[i]);
    }

    const newPd: Record<string, unknown> = {};
    newPd.sectionData = newSectionData;
    newPd.checklistStates = newChecklistStates;
    newPd.completedSections = newCompleted;
    // Copy passthrough fields verbatim (not keyed by component ID)
    if (pd.blurtEntries) newPd.blurtEntries = pd.blurtEntries;
    if (pd.enjoyListEntries) newPd.enjoyListEntries = pd.enjoyListEntries;
    if (pd.timeMapActivities) newPd.timeMapActivities = pd.timeMapActivities;
    if (pd.lifePieValues) newPd.lifePieValues = pd.lifePieValues;

    console.log(
      `  Week ${wn}: completed=${newCompleted.length} credited=${newCredited.length} sectionData=${Object.keys(newSectionData).length}`
    );

    await sqlQuery(
      `UPDATE weeks SET progress_data = :pd::jsonb, credited_sections = :cred::jsonb WHERE id = :id`,
      { pd: JSON.stringify(newPd), cred: JSON.stringify(newCredited), id: row.id }
    );
  }

  console.log('\n✓ Migration complete.\n');
  console.log('Note: positional mapping assumes users completed tasks top-to-bottom.');
  console.log('      Seal status is preserved as-is and was not modified.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
