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

test.describe('docs header title', () => {
  test('shows the artic wordmark linking home and a Docs link', async ({ page }) => {
    await page.goto('/docs/concepts/signals/');
    const title = page.locator('header .site-title');
    const home = title.getByRole('link', { name: 'artic', exact: true });
    await expect(home).toHaveAttribute('href', '/');
    await expect(home.locator('img')).toHaveAttribute('src', '/brand/artic-logo.png');
    expect(await home.evaluate((a) => getComputedStyle(a).fontFamily)).toMatch(/Barlow Condensed/);
    await expect(title.getByRole('link', { name: 'Docs', exact: true })).toHaveAttribute('href', '/docs/');
  });

  test('fits a phone header next to the search and menu buttons', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/docs/concepts/signals/');
    const box = await page.locator('header .site-title').boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(375 - 96);
  });
});

for (const width of [1280, 1920, 2560]) {
  test.describe(`docs text placement at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });

    const measure = (page: import('@playwright/test').Page) =>
      page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar-pane')!.getBoundingClientRect();
        const text = document.querySelector('main .sl-container')!.getBoundingClientRect();
        const toc = document.querySelector('.right-sidebar')?.getBoundingClientRect();
        // The .right-sidebar box itself is fixed and as wide as the viewport (Starlight's
        // own styles), so check the links a reader sees and the page width instead.
        const links = [...document.querySelectorAll('starlight-toc a')].map((a) => a.getBoundingClientRect());
        return {
          left: text.left - sidebar.right,
          right: toc ? toc.left - text.right : null,
          tocInView: toc ? links.length > 0 && links.every((l) => l.left >= toc.left && l.right <= innerWidth) : null,
          noSideScroll: document.documentElement.scrollWidth <= innerWidth,
        };
      });

    test('a page without sections starts the text next to the sidebar', async ({ page }) => {
      await page.goto('/docs/start-here/install/');
      const m = await measure(page);
      expect(m.left).toBeLessThanOrEqual(32);
      expect(m.noSideScroll).toBe(true);
    });

    test('a page with sections keeps text, then its table of contents, beside the sidebar', async ({ page }) => {
      await page.goto('/docs/contributing/architecture/');
      const m = await measure(page);
      expect(m.left).toBeLessThanOrEqual(32);
      expect(m.right).toBeLessThanOrEqual(32);
      expect(m.tocInView).toBe(true);
      expect(m.noSideScroll).toBe(true);
    });
  });
}
