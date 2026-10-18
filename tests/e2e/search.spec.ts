import { test, expect } from '@playwright/test';

test('docs pages are tagged with the latest version', async ({ page }) => {
  await page.goto('/docs/start-here/install/');
  await expect(page.locator('meta[name="docsearch:version"]')).toHaveAttribute('content', 'latest');
});

test('the built-in search button opens a dialog', async ({ page }) => {
  await page.goto('/docs/start-here/install/');
  await page.locator('button[data-open-modal]').click();
  await expect(page.locator('dialog[open]')).toBeVisible();
});
