import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 300000,
  use: {
    headless: false,
    slowMo: 500,
    screenshot: 'on',
    video: 'retain-on-failure',
    // Allow cross-domain cookies so MP sandbox session replication works
    // (prevents the /login/ redirect loop caused by requestStorageAccessFor blocks)
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
        '--disable-blink-features=AutomationControlled',
      ],
    },
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
