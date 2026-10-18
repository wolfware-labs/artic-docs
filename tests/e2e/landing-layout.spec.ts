import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

for (const width of [1600, 375]) {
  test.describe(`landing at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('has no horizontal scroll', async ({ page }) => {
      await expectNoHorizontalScroll(page);
    });

    test('content columns stay within 1120px', async ({ page }) => {
      const widths = await page
        .locator('.container')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
      expect(widths.length).toBeGreaterThan(0);
      for (const w of widths) expect(w).toBeLessThanOrEqual(1120);
    });

    test('nav links point to the right places', async ({ page }) => {
      const nav = page.getByRole('navigation', { name: 'Main' });
      await expect(nav.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs/');
      await expect(nav.getByRole('link', { name: 'Examples' })).toHaveAttribute(
        'href',
        '/docs/start-here/examples/',
      );
      await expect(nav.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
        'href',
        'https://github.com/wolfware-labs/artic',
      );
    });

    test('hero buttons anchor to later sections', async ({ page }) => {
      const hero = page.locator('.hero');
      await expect(hero.getByRole('link', { name: 'Get started' })).toHaveAttribute(
        'href',
        '#get-started',
      );
      await expect(hero.getByRole('link', { name: 'How it works' })).toHaveAttribute(
        'href',
        '#how-it-works',
      );
    });

    test('headline is a single color', async ({ page }) => {
      const colors = await page.locator('.hero h1').evaluate((h1) => {
        const own = getComputedStyle(h1).color;
        return [...h1.querySelectorAll('*')]
          .map((el) => getComputedStyle(el).color)
          .filter((c) => c !== own);
      });
      expect(colors).toEqual([]);
    });

    test('footer states the license', async ({ page }) => {
      await expect(page.locator('footer')).toContainText('MIT or Apache-2.0, at your option.');
    });

    test('keyboard reaches nav links and hero buttons with a visible outline', async ({ page }) => {
      const targets = ['Docs', 'Examples', 'GitHub', 'Get started', 'How it works'];
      const seen = new Set<string>();
      for (let i = 0; i < 20 && seen.size < targets.length; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const cs = getComputedStyle(el);
          return {
            text: el.textContent?.trim() ?? '',
            outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
          };
        });
        const hit = targets.find((t) => info?.text.startsWith(t));
        if (hit) {
          expect(info?.outline, `${hit} focus outline`).toBe(true);
          seen.add(hit);
        }
      }
      expect([...seen].sort()).toEqual([...targets].sort());
    });
  });
}
