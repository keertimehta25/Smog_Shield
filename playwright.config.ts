import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npx tsx server/e2e.ts',
    url: 'http://localhost:4173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
