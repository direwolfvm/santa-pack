import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of the Firebase frontend (app/) against the Auth and
// Firestore emulators. Run with `npm run test:e2e:firebase`, which starts the
// emulators and builds the app first.
const PORT = 4274;
export const TENANT_ID = 'santa-e2e';

export default defineConfig({
  testDir: './tests/e2e-firebase',
  outputDir: './output/playwright-firebase/results',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'output/playwright-firebase/report' }]]
    : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'node server/index.js',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    env: {
      BACKEND: 'firebase',
      PORT: String(PORT),
      GOOGLE_CLOUD_PROJECT: 'demo-santa-pack',
      FIRESTORE_DATABASE: 'santa-pack',
      FIREBASE_TENANT_ID: TENANT_ID,
      FIREBASE_API_KEY: 'fake-api-key',
      FIREBASE_AUTH_DOMAIN: 'localhost',
      APP_BASE_URL: `http://127.0.0.1:${PORT}`,
    },
  },
});
