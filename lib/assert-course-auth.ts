import { getCurrentUserFromRequestCookie } from './auth';

/**
 * Returns the authenticated user's ID.
 *
 * In development the auth check can be skipped by setting:
 *   DEV_BYPASS_AUTH=true    (no mock — just passes through)
 *
 * The VIP membership card check was removed in a prior commit
 * so all authenticated users can create courses for A/B testing.
 */
export async function assertCourseUser(): Promise<string> {
  const bypass = process.env.DEV_BYPASS_AUTH;
  if (bypass && bypass !== '0' && bypass !== 'false' && bypass !== 'no') {
    return 'dev-bypass-user';
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw Object.assign(new Error('Sign in to access courses.'), { status: 401 });
  }
  return user.id;
}
