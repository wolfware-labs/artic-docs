import { test, expect } from '@playwright/test';

test.describe('sticky bar and back-to-top', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('stays hidden and out of the tab order at the top of the page', async ({ page }) => {
    const toTop = page.locator('a.to-top');
    await expect(toTop).toHaveAttribute('data-shown', 'false');
    expect(await toTop.evaluate((el: HTMLElement) => el.inert)).toBe(true);
  });

  test('appears with the bar once the hero nav scrolls away', async ({ page }) => {
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await expect(page.locator('header.bar')).toHaveAttribute('data-shown', 'true');
    const toTop = page.locator('a.to-top');
    await expect(toTop).toHaveAttribute('data-shown', 'true');
    await expect(toTop).toHaveAccessibleName('Back to top');
    expect(await toTop.evaluate((el: HTMLElement) => el.inert)).toBe(false);
  });

  test('takes the reader back to the top', async ({ page }) => {
    await page.locator('#roadmap').scrollIntoViewIfNeeded();
    await page.locator('a.to-top').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('a.to-top')).toHaveAttribute('data-shown', 'false');
  });
});
