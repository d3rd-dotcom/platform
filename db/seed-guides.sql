-- ============================================================================
-- Seed: starter guide DAG on mental-wealth foundations
-- ============================================================================
-- Run AFTER db/migration-guides.sql. Idempotent: uses stable slugs and
-- ON CONFLICT DO NOTHING so re-running does not duplicate rows.
--
-- Shape of the DAG (prereq → guide), 3 levels deep, 7 published guides:
--
--   Level 0 (primitives — no prereqs):
--     attention-basics
--     emotional-vocabulary
--
--   Level 1:
--     journaling-practice     (needs emotional-vocabulary)
--     cognitive-reframing     (needs attention-basics, emotional-vocabulary)
--     mindful-breathing       (needs attention-basics)
--
--   Level 2:
--     building-a-daily-practice (needs journaling-practice, mindful-breathing)
--     values-clarification      (needs cognitive-reframing, journaling-practice)
--
-- body JSONB is an array of components matching the course_components renderer
-- format ({ id, componentType, title, config }) — only 'rich_text' is used here
-- so the guide page renders cleanly with components/course-renderers.
-- Does NOT reference or modify shadow-work.
-- ============================================================================

-- ── Guides ──────────────────────────────────────────────────────────────────
INSERT INTO guides (slug, topic_title, status, body) VALUES
(
  'attention-basics',
  'Attention Basics',
  'published',
  '[
    {"id":"ab-1","componentType":"rich_text","title":"What attention is",
     "config":{"format":"markdown","content":"# Attention Basics\n\nAttention is the mental spotlight you point at one thing while letting the rest fade. Everything else in mental wealth is downstream of being able to notice where that spotlight is pointing.\n\n## Why it comes first\n\n- You cannot regulate what you never notice.\n- You cannot reflect on a feeling you did not catch.\n- Every later skill assumes you can hold focus for a minute or two.\n\n## A 60-second drill\n\nSit, pick one sensation (your breath, your feet on the floor), and rest your attention there. When it wanders, note it and return. That return IS the rep."}}
  ]'::jsonb
),
(
  'emotional-vocabulary',
  'Emotional Vocabulary',
  'published',
  '[
    {"id":"ev-1","componentType":"rich_text","title":"Naming what you feel",
     "config":{"format":"markdown","content":"# Emotional Vocabulary\n\nYou can only work with feelings you can name. ''Bad'' and ''stressed'' are low-resolution. Precision gives you leverage.\n\n## Widen your palette\n\n- Instead of ''bad'': disappointed, ashamed, resentful, drained.\n- Instead of ''good'': relieved, proud, curious, calm.\n\n## The practice\n\nOnce a day, catch one feeling and give it the most specific name you can. Accuracy beats intensity."}}
  ]'::jsonb
),
(
  'journaling-practice',
  'Journaling Practice',
  'published',
  '[
    {"id":"jp-1","componentType":"rich_text","title":"Getting it on the page",
     "config":{"format":"markdown","content":"# Journaling Practice\n\nJournaling externalizes the loop running in your head so you can look at it instead of being inside it. It builds directly on being able to name feelings.\n\n## A simple format\n\n- What happened (facts only).\n- What I felt (use your emotional vocabulary).\n- What I made it mean.\n\n## Keep it low-stakes\n\nThree lines counts. Consistency matters more than length."}}
  ]'::jsonb
),
(
  'cognitive-reframing',
  'Cognitive Reframing',
  'published',
  '[
    {"id":"cr-1","componentType":"rich_text","title":"Catching and re-testing thoughts",
     "config":{"format":"markdown","content":"# Cognitive Reframing\n\nReframing is noticing an automatic thought and asking whether it is actually true. It needs attention (to catch the thought) and emotional vocabulary (to see what it is doing to you).\n\n## The move\n\n1. Catch the thought: ''I always mess this up.''\n2. Name the distortion: over-generalization.\n3. Write a fairer version: ''I struggled this time; here is one thing I would change.''\n\nYou are not forcing positivity — you are restoring accuracy."}}
  ]'::jsonb
),
(
  'mindful-breathing',
  'Mindful Breathing',
  'published',
  '[
    {"id":"mb-1","componentType":"rich_text","title":"Using the breath as an anchor",
     "config":{"format":"markdown","content":"# Mindful Breathing\n\nThe breath is a portable anchor for attention. This guide turns the raw skill of focusing into something you can do to settle your nervous system on demand.\n\n## Box breathing\n\nInhale 4, hold 4, exhale 4, hold 4. Repeat for a minute. When your mind drifts, that is expected — return to the count."}}
  ]'::jsonb
),
(
  'building-a-daily-practice',
  'Building a Daily Practice',
  'published',
  '[
    {"id":"bdp-1","componentType":"rich_text","title":"Stacking small habits",
     "config":{"format":"markdown","content":"# Building a Daily Practice\n\nA daily practice is how the earlier skills stop being exercises and become defaults. It assumes you already journal and can settle yourself with the breath.\n\n## Design your stack\n\n- Anchor to something you already do (after coffee, before bed).\n- Start absurdly small: one breath drill + three journal lines.\n- Track completion, not perfection.\n\n## The point\n\nMomentum compounds. A tiny practice you keep beats a big one you abandon."}}
  ]'::jsonb
),
(
  'values-clarification',
  'Values Clarification',
  'published',
  '[
    {"id":"vc-1","componentType":"rich_text","title":"Deciding what matters",
     "config":{"format":"markdown","content":"# Values Clarification\n\nValues turn reflection into direction. Once you can reframe thoughts and journal honestly, you can ask the bigger question: what am I actually optimizing for?\n\n## An exercise\n\nList five things you would defend even when they cost you. Rank them. Where does your calendar disagree with your ranking?\n\nThat gap is your work."}}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ── Subjects ────────────────────────────────────────────────────────────────
INSERT INTO guide_subjects (guide_id, subject)
SELECT g.id, s.subject
FROM guides g
JOIN (VALUES
  ('attention-basics',          'Foundations'),
  ('attention-basics',          'Focus'),
  ('emotional-vocabulary',      'Foundations'),
  ('emotional-vocabulary',      'Emotional Regulation'),
  ('journaling-practice',       'Reflection'),
  ('journaling-practice',       'Emotional Regulation'),
  ('cognitive-reframing',       'Emotional Regulation'),
  ('mindful-breathing',         'Focus'),
  ('mindful-breathing',         'Foundations'),
  ('building-a-daily-practice', 'Habits'),
  ('values-clarification',      'Reflection'),
  ('values-clarification',      'Habits')
) AS s(slug, subject) ON s.slug = g.slug
ON CONFLICT (guide_id, subject) DO NOTHING;

-- ── Methods (nested inside a definitive guide) ──────────────────────────────
INSERT INTO guide_methods (parent_guide_id, title, sort_order, body)
SELECT g.id, m.title, m.sort_order, m.body::jsonb
FROM guides g
JOIN (VALUES
  ('building-a-daily-practice', 'The two-minute floor', 0,
   '[{"id":"m-2min","componentType":"rich_text","title":"","config":{"format":"markdown","content":"Set a floor so low you cannot fail: two minutes. On bad days you hit the floor and still keep the streak."}}]'),
  ('building-a-daily-practice', 'Habit stacking', 1,
   '[{"id":"m-stack","componentType":"rich_text","title":"","config":{"format":"markdown","content":"Attach the new practice to an existing anchor: ''After I pour my coffee, I do one breath drill.''"}}]'),
  ('journaling-practice', 'The three-line entry', 0,
   '[{"id":"m-3line","componentType":"rich_text","title":"","config":{"format":"markdown","content":"Facts, feeling, meaning — one line each. Enough to get the loop onto the page."}}]')
) AS m(slug, title, sort_order, body) ON m.slug = g.slug;

-- ── Edges (prereq -> guide). Trigger enforces acyclicity. ───────────────────
INSERT INTO guide_edges (prereq_id, guide_id)
SELECT p.id, c.id
FROM (VALUES
  ('emotional-vocabulary',  'journaling-practice'),
  ('attention-basics',      'cognitive-reframing'),
  ('emotional-vocabulary',  'cognitive-reframing'),
  ('attention-basics',      'mindful-breathing'),
  ('journaling-practice',   'building-a-daily-practice'),
  ('mindful-breathing',     'building-a-daily-practice'),
  ('cognitive-reframing',   'values-clarification'),
  ('journaling-practice',   'values-clarification')
) AS e(prereq_slug, guide_slug)
JOIN guides p ON p.slug = e.prereq_slug
JOIN guides c ON c.slug = e.guide_slug
ON CONFLICT (prereq_id, guide_id) DO NOTHING;

-- ============================================================================
-- SEED COMPLETE
-- ============================================================================
