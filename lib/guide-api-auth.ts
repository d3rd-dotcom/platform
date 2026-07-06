/**
 * Unified auth helpers for the guides API family (app/api/guides/**).
 *
 * These are THIN wrappers over the existing auth primitives — they do NOT
 * reimplement token verification. The guides routes historically used two
 * primitives interchangeably:
 *
 *   - getCurrentUserFromRequestCookie() (lib/auth.ts) — resolves the user from
 *     a Privy JWT (Authorization: Bearer header) OR the Privy cookie
 *     (privy-token). Both paths are handled inside getWalletAddressFromRequest;
 *     the request is read from Next.js's ambient headers()/cookies(), so no
 *     Request argument is threaded through. This is why the helpers below accept
 *     `request` for signature uniformity but do not forward it — the underlying
 *     primitive intentionally ignores it, exactly as today's routes rely on.
 *
 *   - assertCourseUser() (lib/assert-course-auth.ts) — the SAME cookie/Bearer
 *     resolution, PLUS a VIP-membership gate (403) and a DEV_BYPASS_AUTH escape
 *     hatch. Used by the guide-authoring / verification-submit routes.
 *
 * Wrapping them here changes NO client behavior: the cookie and Bearer paths are
 * accepted exactly as the current routes collectively accept them.
 */
import { getCurrentUserFromRequestCookie } from './auth';
import { assertCourseUser } from './assert-course-auth';

/** Thrown by requireUser / requireVip. Carries the HTTP status routes surface. */
export type GuideAuthError = Error & { status: number };

function authError(message: string, status: number): GuideAuthError {
  return Object.assign(new Error(message), { status });
}

/**
 * Require an authenticated user. Resolves via the Privy cookie OR Bearer token
 * (whichever the request carries), mirroring the routes that used
 * getCurrentUserFromRequestCookie directly.
 *
 * In development the auth check can be skipped by setting:
 *   DEV_BYPASS_AUTH=true
 *
 * Throws { status: 401 } with the same message the routes surfaced
 * ('Not authenticated.') when no user is resolved.
 *
 * The `request` parameter is accepted for a uniform helper signature; the
 * underlying primitive reads Next.js ambient headers/cookies and ignores it,
 * exactly as the current routes do.
 */
export async function requireUser(_request?: Request): Promise<{ userId: string }> {
  const bypass = process.env.DEV_BYPASS_AUTH;
  if (bypass && bypass !== '0' && bypass !== 'false' && bypass !== 'no') {
    return { userId: 'dev-bypass-user' };
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw authError('Not authenticated.', 401);
  }
  return { userId: user.id };
}

/**
 * Optional auth: resolve the user if the request carries valid cookie/Bearer
 * credentials, otherwise return null. Never throws for the unauthenticated case
 * (mirrors the walkthrough route's `.catch(() => null)` enrichment pattern).
 */
export async function optionalUser(_request?: Request): Promise<{ userId: string } | null> {
  const user = await getCurrentUserFromRequestCookie().catch(() => null);
  return user ? { userId: user.id } : null;
}

/**
 * Require an authenticated VIP user (the create-guide POST and
 * verification-submit POST gate on this). Delegates to the existing
 * assertCourseUser primitive, which:
 *   - honours DEV_BYPASS_AUTH,
 *   - resolves the user via the same cookie/Bearer path,
 *   - throws { status: 401 } ('Sign in to access courses.') when unauthenticated,
 *   - throws { status: 403 } ('A VIP membership is required to create courses.')
 *     when the wallet holds no VIP membership card.
 *
 * All error messages and statuses are preserved byte-for-byte.
 */
export async function requireVip(_request?: Request): Promise<{ userId: string }> {
  const userId = await assertCourseUser();
  return { userId };
}
