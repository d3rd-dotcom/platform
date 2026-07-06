import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Test-only config. Mirrors the tsconfig.json path alias (@/* -> ./*) so tests
// can import lib modules by their app-style specifier (e.g. '@/lib/guides-db').
// Unit suites are pure and run with no environment. Integration suites are gated
// on TEST_DATABASE_URL and self-skip when it is unset (see tests/integration/*).
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests open a real pg pool; give them room and run serially so
    // fixtures in a shared schema never race each other.
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
