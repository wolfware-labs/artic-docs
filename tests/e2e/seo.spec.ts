import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Each tag must appear once: a duplicate would leave crawlers to pick one.
const meta = async (page: Page, attr: 'name' | 'property', key: string) => {
  const tag = page.locator(`head meta[${attr}="${key}"]`);
  await expect(tag, `${key} appears once`).toHaveCount(1);
  return tag.getAttribute('content');
};

// Cards are 1200x630, the size link previews show.
const expectCard = async (request: APIRequestContext, image: string) => {
  const url = new URL(image);
  const res = await request.get(url.pathname + url.search);
  expect(res.status(), `${url.pathname} is served`).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  const png = await res.body();
  expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({ width: 1200, height: 630 });
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

  expect(await meta(page, 'name', 'twitter:title')).toBe(await meta(page, 'property', 'og:title'));
  expect(await meta(page, 'name', 'twitter:description')).toBe(
    await meta(page, 'property', 'og:description'),
  );

  // The version hashes the card's text and design, so link previews fetch it again when it changes.
  const image = await meta(page, 'property', 'og:image');
  expect(image).toMatch(/^https:\/\/artic\.rs\/og\/index\.png\?v=[0-9a-f]{10}$/);
  expect(await meta(page, 'name', 'twitter:image')).toBe(image);
  const alt = await meta(page, 'property', 'og:image:alt');
  expect(alt).toBe('artic share card: Write the app. Run it everywhere.');
  expect(await meta(page, 'name', 'twitter:image:alt')).toBe(alt);
  await expectCard(request, image!);
  expect(await meta(page, 'property', 'og:image:width')).toBe('1200');
  expect(await meta(page, 'property', 'og:image:height')).toBe('630');

  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@type']).toBe('SoftwareSourceCode');
  expect(ld.codeRepository).toBe('https://github.com/wolfware-labs/artic');
  expect(ld.url).toBe('https://artic.rs/');
});

test('docs pages carry their own share card and the site name', async ({ page, request }) => {
  await page.goto('/docs/concepts/signals/');
  const image = await meta(page, 'property', 'og:image');
  expect(image).toMatch(/^https:\/\/artic\.rs\/og\/docs\/concepts\/signals\.png\?v=[0-9a-f]{10}$/);
  expect(await meta(page, 'name', 'twitter:image')).toBe(image);
  expect(await meta(page, 'property', 'og:image:alt')).toBe('artic share card: Signals');
  expect(await meta(page, 'name', 'twitter:image:alt')).toBe('artic share card: Signals');
  expect(await meta(page, 'property', 'og:image:width')).toBe('1200');
  expect(await meta(page, 'property', 'og:image:height')).toBe('630');
  expect(await meta(page, 'property', 'og:site_name')).toBe('artic');
  // The title comes from the page, never from a site-wide tag.
  expect(await meta(page, 'property', 'og:title')).toBe('Signals');
  await expectCard(request, image!);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://artic.rs/docs/concepts/signals/',
  );
});
