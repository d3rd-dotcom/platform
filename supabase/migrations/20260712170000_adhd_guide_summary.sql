-- Add the missing card description for the published ADHD guide.
UPDATE guides
SET
  summary = 'Study how ADHD shapes attention, activity, and impulse control across school, work, and daily life.',
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'adhd-and-focus'
  AND (summary IS NULL OR btrim(summary) = '');
