import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function isValidAdminSecret(secret: string | null): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!secret || !expected) return false;
  return timingSafeStringEqual(secret, expected);
}
