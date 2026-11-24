import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.ts', 'server/**/*.ts', 'client/src/**/*.{ts,tsx}'],
      // Excluded: tests, the two bootstrap entry files (a few lines that only call listen/render),
      // and files that contain TypeScript types only (no runtime code).
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/fixtures.ts',
        'server/index.ts',
        'server/e2e.ts',
        'server/ai/aiService.ts',
        'shared/impact/types.ts',
        'client/src/main.tsx',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 100 },
    },
  },
});
