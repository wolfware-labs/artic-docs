import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectNoHorizontalScroll } from './helpers';

const snapshot = JSON.parse(
  readFileSync('src/data/milestones.snapshot.json', 'utf8'),
) as { number: number; title: string; url: string; open: number; closed: number }[];

test.describe('roadmap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders nine milestones, each title linking to its milestone', async ({ page }) => {
    const items = page.locator('#roadmap [data-milestone]');
    await expect(items).toHaveCount(9);
    for (const m of snapshot) {
      const link = page.locator(`#roadmap [data-milestone="${m.number}"] h3 a`);
      await expect(link).toHaveAttribute(
        'href',
        `https://github.com/wolfware-labs/artic/milestone/${m.number}`,
      );
    }
  });

  test('splits the code from the title', async ({ page }) => {
    const m = page.locator('#roadmap [data-milestone="8"]');
    await expect(m.locator('.code')).toHaveText('M7');
    await expect(m.locator('h3 a')).toHaveText('Accessibility and polish');
  });

  test('statuses follow the issue counts', async ({ page }) => {
    await expect(page.locator('#roadmap [data-milestone="1"]')).toHaveAttribute('data-status', 'done');
    await expect(page.locator('#roadmap [data-milestone="2"]')).toHaveAttribute('data-status', 'in-progress');
    await expect(page.locator('#roadmap [data-milestone="3"] .state')).toHaveText('Next');
    await expect(page.locator('#roadmap [data-milestone="4"] .state')).toHaveText('Planned');
  });

  test('the in-progress milestone shows its counts', async ({ page }) => {
    const m = snapshot.find((x) => x.closed > 0 && x.open > 0)!;
    const el = page.locator(`#roadmap [data-milestone="${m.number}"]`);
    await expect(el).toContainText(`${m.closed} of ${m.open + m.closed} issues`);
    await expect(el.getByRole('img', { name: /issues closed/ })).toBeVisible();
  });

  test('links to the spec, good first issues and the repo', async ({ page }) => {
    const links = page.locator('#roadmap .links a');
    await expect(links).toHaveText(['Read the spec', 'Good first issues', 'Star on GitHub']);
    await expect(links.nth(1)).toHaveAttribute('href', /good%20first%20issue|good-first-issue/);
  });

  test('keeps at least 32px between adjacent milestone columns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const boxes = await page.locator('#roadmap [data-milestone]').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { left: r.left, right: r.right };
      }),
    );
    expect(boxes).toHaveLength(9);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].left - boxes[i - 1].right).toBeGreaterThanOrEqual(32);
    }
  });

  for (const width of [1024, 768, 375]) {
    test(`no horizontal scroll and readable titles at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.locator('#roadmap').scrollIntoViewIfNeeded();
      await expectNoHorizontalScroll(page);
      const clipped = await page.locator('#roadmap [data-milestone] h3').evaluateAll((els) =>
        els.filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      );
      expect(clipped).toBe(0);
    });
  }
});
