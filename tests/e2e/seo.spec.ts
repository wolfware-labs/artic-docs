import { test, expect, type Page } from '@playwright/test';

// Each tag must appear once: a duplicate would leave crawlers to pick one.
const meta = async (page: Page, attr: 'name' | 'property', key: string) => {
  const tag = page.locator(`head meta[${attr}="${key}"]`);
  await expect(tag, `${key} appears once`).toHaveCount(1);
  return tag.getAttribute('content');
};

test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/^User-agent: \*$/m);
  expect(body).toMatch(/^Allow: \/$/m);
  expect(body).toContain('Sitemap: https://artic.rs/sitemap-index.xml');
});

test('the sitemap lists the landing page and the docs', async ({ request }) => {
  const index = await (await request.get('/sitemap-index.xml')).text();
  const first = /<loc>https:\/\/artic\.rs(\/sitemap-\d+\.xml)<\/loc>/.exec(index)![1];
  const urls = await (await request.get(first)).text();
  expect(urls).toContain('<loc>https://artic.rs/</loc>');
  expect(urls).toContain('<loc>https://artic.rs/docs/concepts/signals/</loc>');
});

test('the landing page carries canonical, social and structured data', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://artic.rs/');
  await expect(page.locator('head link[rel="sitemap"]')).toHaveAttribute('href', '/sitemap-index.xml');
  expect(await meta(page, 'property', 'og:type')).toBe('website');
  expect(await meta(page, 'property', 'og:url')).toBe('https://artic.rs/');
  expect(await meta(page, 'property', 'og:site_name')).toBe('artic');
  expect(await meta(page, 'property', 'og:title')).toBeTruthy();
  expect(await meta(page, 'property', 'og:description')).toBeTruthy();
  expect(await meta(page, 'name', 'twitter:card')).toBe('summary_large_image');

  // The version is a hash of the file, so link previews fetch the card again whenever it changes.
  const image = await meta(page, 'property', 'og:image');
  expect(image).toMatch(/^https:\/\/artic\.rs\/og\/artic\.png\?v=[0-9a-f]{10}$/);
  expect(await meta(page, 'name', 'twitter:image')).toBe(image);
  const url = new URL(image!);
  const res = await request.get(url.pathname + url.search);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  // Rendered at twice the 1200x630 card size so it stays sharp after link previews recompress it.
  const png = await res.body();
  const size = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  expect(size).toEqual({ width: 2400, height: 1260 });
  expect(await meta(page, 'property', 'og:image:width')).toBe(String(size.width));
  expect(await meta(page, 'property', 'og:image:height')).toBe(String(size.height));

  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@type']).toBe('SoftwareSourceCode');
  expect(ld.codeRepository).toBe('https://github.com/wolfware-labs/artic');
  expect(ld.url).toBe('https://artic.rs/');
});

test('docs pages carry the share image and site name', async ({ page }) => {
  await page.goto('/');
  const landingImage = await meta(page, 'property', 'og:image');
  await page.goto('/docs/concepts/signals/');
  expect(await meta(page, 'property', 'og:image')).toBe(landingImage);
  expect(await meta(page, 'name', 'twitter:image')).toBe(landingImage);
  expect(await meta(page, 'property', 'og:site_name')).toBe('artic');
  // The docs set these in Starlight's head config, apart from the landing page.
  expect(await meta(page, 'property', 'og:image:width')).toBe('2400');
  expect(await meta(page, 'property', 'og:image:height')).toBe('1260');
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://artic.rs/docs/concepts/signals/',
  );
});
