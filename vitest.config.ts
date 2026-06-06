import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: false,
    pool: 'threads',
    /* Packer.toBuffer (cold-import sharp shim) + ImapFlow setup can
     * exceed the 5 s default. 30 s on Windows gives ample margin. */
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
