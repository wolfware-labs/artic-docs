import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

const device = '.hero .hd';
const button = '.hero .hd-btn';
const code = '.hero .hd-code';

test.describe('hero demo', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('edits the XAML and the window follows, then moves to a phone', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(device)).toHaveAttribute('data-device', 'desktop');
    await expect(page.locator(button)).toHaveText('Sign in');

    await expect(page.locator(code)).toContainText('Content="Log in"', { timeout: 6000 });
    await expect(page.locator(button)).toHaveText('Log in');
    await expect(page.locator(device)).toHaveAttribute('data-device', 'phone', { timeout: 4000 });
  });

  test('the device switch highlights the current frame', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero .hd-switch .on')).toHaveText('Desktop');
    await expect(page.locator(device)).toHaveAttribute('data-device', 'phone', { timeout: 8000 });
    await expect(page.locator('.hero .hd-switch .on')).toHaveText('Phone');
  });

  test('the switch lists web as coming soon and never lands on it', async ({ page }) => {
    await page.goto('/');
    const web = page.locator('.hero .hd-switch .hd-soon');
    await expect(web).toContainText('Web');
    await expect(web.locator('.hd-pill')).toHaveText('SOON');
    // Through a full pass: desktop, phone, tablet and back to desktop.
    for (const frame of ['phone', 'tablet', 'desktop']) {
      await expect(page.locator(device)).toHaveAttribute('data-device', frame, { timeout: 15000 });
      await expect(web).not.toHaveClass(/\bon\b/);
    }
  });

  test('the editor card shows every line in full', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const fits = await page.locator(code).evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
  });
});

for (const width of [1920, 1600, 1536, 1366, 1280, 1120]) {
  test.describe(`hero demo at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the editor card never covers the hero copy, in any frame', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      for (const frame of ['desktop', 'phone', 'tablet']) {
        await expect(page.locator(device)).toHaveAttribute('data-device', frame, { timeout: 15000 });
        // Let the frame finish its morph before measuring.
        await page.waitForTimeout(900);
        const gap = await page.evaluate(() => {
          const sub = document.querySelector('.hero .sub')!;
          const range = document.createRange();
          range.selectNodeContents(sub);
          const textRight = Math.max(...[...range.getClientRects()].map((r) => r.right));
          return document.querySelector('.hero .hd-code')!.getBoundingClientRect().left - textRight;
        });
        expect(gap, `gap in the ${frame} frame`).toBeGreaterThanOrEqual(8);
      }
    });
  });
}

test.describe('hero demo with reduced motion', () => {
  test.use({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });

  test('stays on the first frame', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    await expect(page.locator(device)).toHaveAttribute('data-device', 'desktop');
    await expect(page.locator(button)).toHaveText('Sign in');
  });
});

test.describe('hero demo on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('never scrolls the page sideways, even as a phone frame', async ({ page }) => {
    await page.goto('/');
    await expectNoHorizontalScroll(page);
    await expect(page.locator(device)).toHaveAttribute('data-device', 'phone', { timeout: 8000 });
    await expectNoHorizontalScroll(page);
  });
});
