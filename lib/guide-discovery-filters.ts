export const EDUCATION_LEVELS = [
  'College',
  'High School',
  'Adult Education',
  'Graduate & Post-Graduate',
  'Professional Development',
] as const;

export const GUIDE_GOALS = [
  'Transferable Credit',
  'Test Prep',
  'Certificates',
  'Teacher Resources',
  'College Research',
  'Study',
  'Professional Licensure',
  'Homeschool',
  'Career',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type GuideGoal = (typeof GUIDE_GOALS)[number];

export function isEducationLevel(value: string): value is EducationLevel {
  return (EDUCATION_LEVELS as readonly string[]).includes(value);
}

export function isGuideGoal(value: string): value is GuideGoal {
  return (GUIDE_GOALS as readonly string[]).includes(value);
}

export function cleanDiscoveryTags<T extends string>(
  values: readonly string[] | undefined,
  isValid: (value: string) => value is T,
): T[] {
  if (!values) return [];
  return Array.from(new Set(values.filter(isValid)));
}
