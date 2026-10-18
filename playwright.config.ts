import { defineConfig, devices } from '@playwright/test';

// Both projects build the site they test. ROADMAP_OFFLINE=1 makes the roadmap read the
// committed milestone snapshot instead of GitHub, so the roadmap specs can compare the
// page against that file. The builds go to their own out dirs and leave `dist` alone.
//
// The form only exists in a build made with PUBLIC_MAILERLITE_ACTION set, so the
// newsletter project runs against a second build served on its own port. It is
// opt-in (E2E_NEWSLETTER=1, set by `pnpm test:e2e:newsletter`) to keep the default
// run to a single site.
const withNewsletter = process.env.E2E_NEWSLETTER === '1';
const toEnv = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
const siteEnv = toEnv({ ARTIC_OUT_DIR: 'dist-e2e', ROADMAP_OFFLINE: '1' });
const formEnv = toEnv({
  ARTIC_OUT_DIR: 'dist-newsletter',
  ROADMAP_OFFLINE: '1',
  PUBLIC_MAILERLITE_ACTION: 'https://assets.mailerlite.com/test',
});

export default defineConfig({
  testDir: './tests/e2e',
  projects: withNewsletter
    ? [
        {
          name: 'newsletter',
          testMatch: 'newsletter-form.spec.ts',
          use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4322' },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: 'newsletter-form.spec.ts',
          use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4321' },
        },
      ],
  webServer: withNewsletter
    ? {
        command: `${formEnv} pnpm exec astro build && ${formEnv} pnpm exec astro preview --ignore-lock --port 4322`,
        url: 'http://localhost:4322',
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      }
    : {
        command: `${siteEnv} pnpm exec astro build && ${siteEnv} pnpm exec astro preview --ignore-lock --port 4321`,
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
});
