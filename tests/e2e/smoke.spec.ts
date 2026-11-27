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
  test(`${path} links the favicon set`, async ({ page, request }) => {
    await page.goto(path);
    // Search engines pick a square icon whose size is a multiple of 48 px,
    // and many clients ask for /favicon.ico without reading the page.
    // Starlight writes its own icon link after the custom head tags, so the
    // order differs between the landing page and the docs.
    await expect(page.locator('link[rel~="icon"][href="/favicon.ico"]')).toHaveCount(1);
    const ico = await request.get('/favicon.ico');
    expect(ico.status()).toBe(200);
    expect(ico.headers()['content-type']).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/);
    const png = page.locator('link[rel~="icon"][type="image/png"][sizes="32x32"]');
    expect(await png.getAttribute('href')).toBe('/brand/favicon-32.png');
    const res = await request.get('/brand/favicon-32.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });
}
