import { getCurrentUserFromRequestCookie } from './auth';
import { getVipCourseById } from './vip-course-db';
import { walletHasMembershipAccess } from './membership-access';

/**
 * Returns the authenticated user's ID.
 *
 * In development the auth check can be skipped by setting:
 *   DEV_BYPASS_AUTH=true    (no mock — just passes through)
 */
export async function assertCourseUser(): Promise<string> {
  const bypass = process.env.DEV_BYPASS_AUTH;
  if (process.env.NODE_ENV !== 'production' && bypass && bypass !== '0' && bypass !== 'false' && bypass !== 'no') {
    return 'dev-bypass-user';
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw Object.assign(new Error('Sign in to access courses.'), { status: 401 });
  }

  const isVip = await walletHasMembershipAccess(user.walletAddress);
  if (!isVip) {
    throw Object.assign(new Error('A VIP membership is required to create courses.'), { status: 403 });
  }

  return user.id;
}

/**
 * Asserts the authenticated user owns the course with the given ID.
 * Returns the user ID on success, throws 404/403 otherwise.
 */
export async function assertCourseOwner(courseId: string): Promise<string> {
  const userId = await assertCourseUser();
  const course = await getVipCourseById(courseId);
  if (!course) {
    throw Object.assign(new Error('Course not found'), { status: 404 });
  }
  if (course.userId !== userId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return userId;
}
