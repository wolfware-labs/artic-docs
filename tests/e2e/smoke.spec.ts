import { test, expect } from '@playwright/test';

test('landing page responds', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('artic');
});

test('docs home responds', async ({ page }) => {
  const res = await page.goto('/docs/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/artic docs/);
});

test('reserved namespace paths are not pages', async ({ request }) => {
  expect((await request.get('/ui')).status()).toBe(404);
  expect((await request.get('/markup')).status()).toBe(404);
});

for (const path of ['/', '/docs/start-here/install/']) {
  test(`${path} links a favicon that exists`, async ({ page, request }) => {
    await page.goto(path);
    const href = await page.locator('link[rel~="icon"]').first().getAttribute('href');
    expect(href).toBe('/brand/artic-logo.png');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });
}
