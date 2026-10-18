import { defineConfig, devices } from '@playwright/test';

// The form only exists in a build made with PUBLIC_MAILERLITE_ACTION set, so the
// newsletter project runs against a second build served on its own port. It is
// opt-in (E2E_NEWSLETTER=1, set by `pnpm test:e2e:newsletter`) to keep the default
// run to a single prebuilt site.
const withNewsletter = process.env.E2E_NEWSLETTER === '1';
const formBuild = {
  ARTIC_OUT_DIR: 'dist-newsletter',
  PUBLIC_MAILERLITE_ACTION: 'https://assets.mailerlite.com/test',
};
const formEnv = Object.entries(formBuild)
  .map(([k, v]) => `${k}=${v}`)
  .join(' ');

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
        command: 'pnpm preview --ignore-lock',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
      },
});
