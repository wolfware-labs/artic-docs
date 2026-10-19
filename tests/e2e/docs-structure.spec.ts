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
  '/docs/contributing/architecture/',
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
  expect(labels.map((l) => l.trim()).slice(0, 6)).toEqual([
    'Start here',
    'Tutorial',
    'Guides',
    'Concepts',
    'Reference',
    'Contributing',
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

test('an outline with no headings leaves out the lead and the list', async ({ page }) => {
  await page.goto('/docs/start-here/examples/');
  await expect(page.locator('.outline')).toContainText('Coming with artic 0.1');
  await expect(page.locator('.outline .outline-lead')).toHaveCount(0);
  await expect(page.locator('.outline ul')).toHaveCount(0);
});

test('an outline with headings keeps the lead and the list', async ({ page }) => {
  await page.goto('/docs/guides/bind-a-list/');
  await expect(page.locator('.outline .outline-lead')).toHaveText('This page will cover:');
  await expect(page.locator('.outline ul li').first()).toBeVisible();
});

test('reference links to the Rust API repository', async ({ page }) => {
  await page.goto('/docs/reference/controls/');
  await expect(
    page.locator('main a[href="https://github.com/wolfware-labs/artic"]').first(),
  ).toBeVisible();
});

test.describe('docs layout at 1920px', () => {
  test.use({ viewport: { width: 1920, height: 1000 } });

  test('a page with no sections drops the table of contents and widens the text', async ({ page }) => {
    await page.goto('/docs/start-here/install/');
    await expect(page.locator('.right-sidebar')).toHaveCount(0);
    const width = await page
      .locator('main .sl-container')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThanOrEqual(820);
  });

  test('a page with sections keeps its table of contents', async ({ page }) => {
    await page.goto('/docs/contributing/architecture/');
    await expect(page.locator('.right-sidebar starlight-toc')).toBeVisible();
  });

  test('the next-page link follows the content without an empty row', async ({ page }) => {
    await page.goto('/docs/start-here/install/');
    const gap = await page.evaluate(() => {
      const content = document.querySelector('.sl-markdown-content')!.getBoundingClientRect();
      const next = document.querySelector('.pagination-links')!.getBoundingClientRect();
      return next.top - content.bottom;
    });
    expect(gap).toBeLessThanOrEqual(56);
  });
});

test.describe('code blocks', () => {
  for (const path of ['/docs/contributing/architecture/', '/docs/contributing/spec/technical-spec/']) {
    test(`mermaid fences render as diagrams on ${path}`, async ({ page }) => {
      await page.goto(path);
      const diagrams = page.locator('.sl-markdown-content pre.mermaid');
      await expect(diagrams.first().locator('svg')).toBeVisible({ timeout: 15000 });
      for (const d of await diagrams.all()) {
        await expect(d.locator('svg')).toBeVisible({ timeout: 15000 });
        // mermaid draws its parse errors as an SVG too.
        await expect(d.locator('svg[aria-roledescription="error"]')).toHaveCount(0);
      }
    });
  }

  test('rustdoc-style fences are highlighted as Rust', async ({ page }) => {
    await page.goto('/docs/contributing/design/host/');
    const block = page.locator('.expressive-code pre').first();
    await expect(block).toHaveAttribute('data-language', 'rust');
    const colors = await block.evaluate(
      (pre) => new Set([...pre.querySelectorAll('span[style]')].map((s) => getComputedStyle(s).color)).size,
    );
    expect(colors).toBeGreaterThan(2);
  });
});
