-- ============================================================================
-- Guide expansion subject catalog
-- ============================================================================
-- Adds stable lanes for the next guide collection. Existing guide subjects and
-- graph level computation remain unchanged.

INSERT INTO guide_subject_catalog (id, label, description, aliases, sort_order)
VALUES
  ('mindfulness', 'Mindfulness and Meditation', 'Attention practices, meditation, and compassionate awareness.', ARRAY['Meditation', 'Mindfulness'], 70),
  ('wellness-science', 'Wellness Science', 'Everyday systems for rest, movement, recovery, and well-being.', ARRAY['Wellness', 'Wellbeing'], 80),
  ('research-statistics', 'Research and Statistics', 'How to ask questions, read evidence, and reason with data.', ARRAY['Research', 'Statistics', 'Scientific Method'], 90),
  ('social-psychology', 'Social Psychology', 'How groups, relationships, and social settings shape behavior.', ARRAY['Social Science', 'Groups'], 100),
  ('decision-making', 'Decision Making', 'Judgment, uncertainty, cognitive biases, and practical choices.', ARRAY['Decision Science', 'Judgment'], 110)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
