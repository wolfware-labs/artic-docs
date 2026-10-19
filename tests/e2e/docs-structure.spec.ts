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
        // mermaid draws its parse errors as an SVG too, so require drawn nodes.
        await expect(d.locator('svg[aria-roledescription="error"]')).toHaveCount(0);
        await expect(d.locator('svg .node').first()).toBeVisible();
      }
    });
  }

  for (const [path, heading] of [
    ['/docs/contributing/design/host/', null],
    ['/docs/contributing/design/border/', '2-the-inner-shape-and-the-ring'],
  ] as const) {
  test(`rustdoc-style fences are highlighted as Rust on ${path}`, async ({ page }) => {
    await page.goto(path);
    // Starlight wraps each heading in a div, so the code blocks are siblings of the wrapper.
    const scope = heading ? page.locator(`.sl-heading-wrapper:has([id="${heading}"]) ~ .expressive-code`) : page;
    const block = scope.locator('pre').first();
    await expect(block).toHaveAttribute('data-language', 'rust');
    const colors = await block.evaluate(
      (pre) => new Set([...pre.querySelectorAll('span[style]')].map((s) => getComputedStyle(s).color)).size,
    );
    expect(colors).toBeGreaterThan(2);
  });
  }
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
  test.describe(`docs layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });

    const measure = (page: import('@playwright/test').Page) =>
      page.evaluate(() => {
        const box = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
        const sidebar = box('.sidebar-pane')!;
        const text = box('main .sl-container')!;
        const toc = box('.right-sidebar');
        // Collapsed nested entries have empty boxes; only measure the links on screen.
        const links = [...document.querySelectorAll('starlight-toc a')]
          .map((a) => a.getBoundingClientRect())
          .filter((l) => l.width > 0);
        const para = box('.sl-markdown-content > p');
        const heading = box('.sl-markdown-content > .sl-heading-wrapper');
        const search = box('div.header > :nth-child(2) button');
        return {
          sidebarWidth: sidebar.width,
          left: text.left - sidebar.right,
          // Space between the text column and what follows it: the table of contents, or the window edge.
          right: (toc ? toc.left : innerWidth) - text.right,
          tocWidth: toc ? toc.width : null,
          tocInView: toc ? links.length > 0 && links.every((l) => l.left >= toc.left && l.right <= innerWidth) : null,
          paraWidth: para ? para.width : null,
          headingWidth: heading ? heading.width : null,
          textWidth: text.width,
          searchOffCenter: search ? Math.abs(search.left + search.width / 2 - innerWidth / 2) : null,
          noSideScroll: document.documentElement.scrollWidth <= innerWidth,
        };
      });

    test('a page without sections fills the width beside the sidebar', async ({ page }) => {
      await page.goto('/docs/start-here/install/');
      const m = await measure(page);
      expect(m.sidebarWidth).toBe(320);
      expect(m.left).toBeLessThanOrEqual(32);
      expect(m.right).toBeLessThanOrEqual(32);
      expect(m.noSideScroll).toBe(true);
    });

    test('a page with sections fills the width up to a table of contents on the right edge', async ({ page }) => {
      await page.goto('/docs/contributing/architecture/');
      const m = await measure(page);
      expect(m.left).toBeLessThanOrEqual(32);
      expect(m.right).toBeLessThanOrEqual(32);
      expect(m.tocWidth).toBe(256);
      expect(m.tocInView).toBe(true);
      expect(m.noSideScroll).toBe(true);
      // Prose uses the whole column, like code blocks do.
      expect(m.paraWidth).toBe(m.textWidth);
      expect(m.headingWidth).toBe(m.textWidth);
    });

    test('the header search sits in the middle of the window', async ({ page }) => {
      await page.goto('/docs/contributing/architecture/');
      expect((await measure(page)).searchOffCenter).toBeLessThanOrEqual(8);
    });
  });
}

test.describe('table of contents', () => {
  test.use({ viewport: { width: 1920, height: 1000 } });

  test('uses a readable font size', async ({ page }) => {
    await page.goto('/docs/contributing/architecture/');
    const size = await page.locator('.right-sidebar starlight-toc a').first().evaluate((a) => parseFloat(getComputedStyle(a).fontSize));
    expect(size).toBeGreaterThanOrEqual(15);
  });
});

test.describe('pre-release banner', () => {
  test.use({ viewport: { width: 1920, height: 1000 } });

  test('lines up with the text and keeps clear of the header', async ({ page }) => {
    await page.goto('/docs/contributing/architecture/');
    const m = await page.evaluate(() => {
      const banner = document.querySelector('.prerelease-banner')!.getBoundingClientRect();
      const header = document.querySelector('header.header')!.getBoundingClientRect();
      const text = document.querySelector('main .sl-container')!.getBoundingClientRect();
      return { top: banner.top - header.bottom, left: banner.left - text.left, right: text.right - banner.right };
    });
    expect(m.top).toBeGreaterThanOrEqual(12);
    expect(Math.abs(m.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.right)).toBeLessThanOrEqual(1);
  });

  test('uses light colors in the light theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/docs/contributing/architecture/');
    const bg = await page.locator('.prerelease-banner').evaluate((b) => getComputedStyle(b).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect((r + g + b) / 3).toBeGreaterThan(200);
  });
});

test.describe('mermaid diagram placement', () => {
  test.use({ viewport: { width: 1920, height: 1000 } });

  test('every diagram is centered in the text column', async ({ page }) => {
    await page.goto('/docs/contributing/spec/technical-spec/');
    const diagrams = page.locator('.sl-markdown-content pre.mermaid');
    for (const d of await diagrams.all()) await expect(d.locator('svg .node').first()).toBeAttached({ timeout: 15000 });
    const offsets = await diagrams.evaluateAll((pres) =>
      pres.map((pre) => {
        const box = pre.getBoundingClientRect();
        const svg = pre.querySelector('svg')!.getBoundingClientRect();
        return Math.abs((svg.left + svg.right) / 2 - (box.left + box.right) / 2);
      }),
    );
    expect(offsets.length).toBeGreaterThan(0);
    for (const o of offsets) expect(o).toBeLessThanOrEqual(2);
  });
});

test.describe('previous and next links', () => {
  test.use({ viewport: { width: 1920, height: 1000 } });

  test('sit at the two edges of the text column, at a compact size', async ({ page }) => {
    await page.goto('/docs/concepts/signals/');
    const m = await page.evaluate(() => {
      const text = document.querySelector('main .sl-container')!.getBoundingClientRect();
      const box = (rel: string) => document.querySelector(`.pagination-links a[rel="${rel}"]`)!.getBoundingClientRect();
      const prev = box('prev');
      const next = box('next');
      return { prevLeft: prev.left - text.left, nextRight: text.right - next.right, prevWidth: prev.width, nextWidth: next.width };
    });
    expect(Math.abs(m.prevLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.nextRight)).toBeLessThanOrEqual(1);
    expect(m.prevWidth).toBeLessThanOrEqual(420);
    expect(m.nextWidth).toBeLessThanOrEqual(420);
  });

  test('keep a lone next link on the right', async ({ page }) => {
    // The first page has no previous link.
    await page.goto('/docs/start-here/install/');
    await expect(page.locator('.pagination-links a[rel="prev"]')).toHaveCount(0);
    const gap = await page.evaluate(() => {
      const text = document.querySelector('main .sl-container')!.getBoundingClientRect();
      const next = document.querySelector('.pagination-links a[rel="next"]')!.getBoundingClientRect();
      return text.right - next.right;
    });
    expect(Math.abs(gap)).toBeLessThanOrEqual(1);
  });

  test('use body-size titles, not heading-size ones', async ({ page }) => {
    await page.goto('/docs/concepts/signals/');
    const size = await page.locator('.pagination-links .link-title').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeLessThanOrEqual(16);
  });
});

test.describe('previous and next links on a laptop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('stay on one row beside the table of contents', async ({ page }) => {
    await page.goto('/docs/contributing/design/border/');
    const tops = await page
      .locator('.pagination-links a')
      .evaluateAll((links) => links.map((a) => Math.round(a.getBoundingClientRect().top)));
    expect(tops).toHaveLength(2);
    expect(tops[0]).toBe(tops[1]);
  });
});

test.describe('previous and next links on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('stack at the full width of the text', async ({ page }) => {
    await page.goto('/docs/contributing/design/border/');
    const m = await page.evaluate(() => {
      const text = document.querySelector('main .sl-container')!.getBoundingClientRect();
      return [...document.querySelectorAll('.pagination-links a')].map((a) => {
        const r = a.getBoundingClientRect();
        return { left: Math.round(r.left - text.left), right: Math.round(text.right - r.right), top: Math.round(r.top) };
      });
    });
    expect(m).toHaveLength(2);
    expect(m[1].top).toBeGreaterThan(m[0].top);
    for (const card of m) {
      expect(Math.abs(card.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.right)).toBeLessThanOrEqual(1);
    }
  });
});
