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

  const image = await meta(page, 'property', 'og:image');
  expect(image).toBe('https://artic.rs/og/artic.png');
  expect(await meta(page, 'name', 'twitter:image')).toBe(image);
  const res = await request.get(new URL(image!).pathname);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');

  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@type']).toBe('SoftwareSourceCode');
  expect(ld.codeRepository).toBe('https://github.com/wolfware-labs/artic');
  expect(ld.url).toBe('https://artic.rs/');
});

test('docs pages carry the share image and site name', async ({ page }) => {
  await page.goto('/docs/concepts/signals/');
  expect(await meta(page, 'property', 'og:image')).toBe('https://artic.rs/og/artic.png');
  expect(await meta(page, 'name', 'twitter:image')).toBe('https://artic.rs/og/artic.png');
  expect(await meta(page, 'property', 'og:site_name')).toBe('artic');
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://artic.rs/docs/concepts/signals/',
  );
});
