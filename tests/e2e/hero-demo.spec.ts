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

  test('the editor card shows every line in full', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const fits = await page.locator(code).evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
  });
});

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
