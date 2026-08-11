const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  outputDir: './output/playwright/results',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4273',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
  ],
  webServer: {
    command: 'node src/index.js',
    url: 'http://127.0.0.1:4273/api/health',
    env: { PORT: '4273', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test-key' },
    reuseExistingServer: false
  }
});
