import { test, expect } from '@playwright/test';

const pages = [
  '/docs/start-here/install/',
  '/docs/start-here/first-app/',
  '/docs/start-here/project-tour/',
  '/docs/start-here/examples/',
  '/docs/tutorial/',
  '/docs/guides/style-a-button/',
  '/docs/guides/bind-a-list/',
  '/docs/guides/add-a-screen/',
  '/docs/guides/ship-to-ios/',
  '/docs/concepts/signals/',
  '/docs/concepts/compiled-bindings/',
  '/docs/concepts/layout/',
  '/docs/concepts/styling/',
  '/docs/concepts/host-and-renderer/',
  '/docs/reference/controls/',
  '/docs/reference/markup-extensions/',
  '/docs/reference/cli/',
];

for (const path of pages) {
  test(`${path} responds with the pre-release banner`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    const banner = page.locator('.prerelease-banner');
    await expect(banner).toContainText('artic is pre-release');
    await expect(banner.getByRole('link')).toHaveAttribute('href', '/#roadmap');
  });
}

test('sidebar groups appear in order', async ({ page }) => {
  await page.goto('/docs/start-here/install/');
  const labels = await page
    .locator('nav.sidebar ul.top-level > li > details > summary .large')
    .allTextContents();
  expect(labels.map((l) => l.trim()).slice(0, 5)).toEqual([
    'Start here',
    'Tutorial',
    'Guides',
    'Concepts',
    'Reference',
  ]);
});

test('examples page lists the three sample apps', async ({ page }) => {
  await page.goto('/docs/start-here/examples/');
  for (const name of ['todo', 'settings', 'master-detail']) {
    await expect(page.locator('main').getByText(name, { exact: true }).first()).toBeVisible();
  }
});

test('outline pages are marked as coming with artic 0.1', async ({ page }) => {
  await page.goto('/docs/guides/bind-a-list/');
  await expect(page.locator('.outline')).toContainText('Coming with artic 0.1');
});

test('reference links to the Rust API repository', async ({ page }) => {
  await page.goto('/docs/reference/controls/');
  await expect(
    page.locator('main a[href="https://github.com/wolfware-labs/artic"]').first(),
  ).toBeVisible();
});
