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
    // Google Search reads the icon links and wants a square icon, ideally
    // 48 px or more; many clients ask for /favicon.ico without reading the page.
    // Starlight writes its own icon link after the custom head tags, so the
    // order differs between the landing page and the docs.
    await expect(page.locator('link[rel~="icon"][href="/favicon.ico"]')).toHaveCount(1);
    const ico = await request.get('/favicon.ico');
    expect(ico.status()).toBe(200);
    expect(ico.headers()['content-type']).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/);
    // The ICO directory: an image count at byte 4, then 16 bytes per image
    // starting at byte 6, with the width and height in its first two bytes.
    const body = await ico.body();
    const sizes = Array.from({ length: body.readUInt16LE(4) }, (_, i) => [
      body[6 + 16 * i],
      body[7 + 16 * i],
    ]);
    expect(sizes).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
    ]);
    const png = page.locator('link[rel~="icon"][type="image/png"][sizes="32x32"]');
    expect(await png.getAttribute('href')).toBe('/brand/favicon-32.png');
    const res = await request.get('/brand/favicon-32.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });
}
