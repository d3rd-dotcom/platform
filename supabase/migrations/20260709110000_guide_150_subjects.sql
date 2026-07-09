-- ============================================================================
-- Subject lanes for the 150-guide knowledge map
-- ============================================================================
-- The guide graph remains the source of progress levels. These rows only add
-- canonical discovery lanes for the next content collection.

INSERT INTO guide_subject_catalog (id, label, description, aliases, sort_order)
VALUES
  ('learning-science', 'Learning Science', 'Memory, practice, feedback, and the design of learning.', ARRAY['Learning', 'Study Skills'], 120),
  ('neuroscience', 'Neuroscience', 'Brain, body, attention, sleep, and behavior explained carefully.', ARRAY['Brain Science'], 130),
  ('communication', 'Communication', 'Listening, feedback, conflict, groups, and shared understanding.', ARRAY['Interpersonal Skills'], 140),
  ('public-health', 'Public Health', 'Health patterns across people, places, systems, and communities.', ARRAY['Community Health'], 150),
  ('creativity', 'Creativity', 'Idea generation, creative practice, feedback, and contribution.', ARRAY['Creative Practice'], 160),
  ('lifespan-development', 'Lifespan Development', 'How people, contexts, and learning change across life stages.', ARRAY['Development', 'Life Stages'], 170),
  ('ethics-society', 'Ethics and Society', 'Consent, privacy, fairness, power, and responsible choices.', ARRAY['Ethics', 'Society'], 180),
  ('media-literacy', 'Media Literacy', 'Sources, platforms, persuasion, data displays, and public claims.', ARRAY['Information Literacy'], 190)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
