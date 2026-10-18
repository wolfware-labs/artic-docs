import { test, expect, type Page } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

const island = (page: Page) => page.locator('#how-it-works .xs');

async function scrollTrackTo(page: Page, fraction: number) {
  await page.evaluate((f) => {
    const track = document.querySelector('#how-it-works .xs-track') as HTMLElement;
    const top = track.getBoundingClientRect().top + scrollY;
    scrollTo(0, top + (track.offsetHeight - innerHeight) * f);
  }, fraction);
}

async function goLive(page: Page) {
  await page.goto('/');
  await page.locator('#how-it-works').scrollIntoViewIfNeeded();
  await expect(island(page)).toHaveAttribute('data-live', 'true');
}

test.describe('exploded stack at 1600px', () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('renders the finished drawing before the island runs', async ({ page }) => {
    await page.goto('/');
    const root = island(page);
    await expect(root).toHaveAttribute('data-progress', '0.72');
    await expect(root.locator('svg[role="img"]').first()).toHaveAttribute(
      'aria-label',
      /View language.*Core.*Renderer.*Host/,
    );
  });

  test('the scroll track is 600vh tall', async ({ page }) => {
    await goLive(page);
    const { track, vh } = await page.evaluate(() => ({
      track: (document.querySelector('#how-it-works .xs-track') as HTMLElement).offsetHeight,
      vh: innerHeight,
    }));
    expect(track).toBe(vh * 6);
    const position = await page
      .locator('#how-it-works .xs-stage')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('swaps in the skia adapter at the end and undoes it on the way back', async ({ page }) => {
    await goLive(page);
    const root = island(page);

    await scrollTrackTo(page, 1);
    await expect(root).toHaveAttribute('data-swapped', 'true');
    await expect(root).toHaveAttribute('data-progress', '1');
    await expect(root.locator('.xs-wide').getByText('your skia adapter')).toBeVisible();

    await scrollTrackTo(page, 0);
    await expect(root).toHaveAttribute('data-swapped', 'false');
    await expect(root).toHaveAttribute('data-progress', '0');
    await expect(root.getByText('your skia adapter')).toHaveCount(0);
  });

  test('the drawing has nothing to focus', async ({ page }) => {
    await goLive(page);
    const focusable = await island(page)
      .locator('a, button, input, [tabindex]')
      .count();
    expect(focusable).toBe(0);
  });
});

test.describe('exploded stack with reduced motion', () => {
  test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });

  test('shows the alternatives without a sticky stage', async ({ page }) => {
    await page.goto('/');
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    const root = island(page);
    await expect(root).toHaveAttribute('data-live', 'false');
    await expect(root).toHaveAttribute('data-progress', '0.72');
    const position = await page
      .locator('#how-it-works .xs-stage')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).not.toBe('sticky');
    await expect(root.locator('.xs-wide').getByText('Rust builder')).toBeVisible();
    await expect(root.locator('.xs-wide').getByText('artic-vello')).toBeVisible();
  });
});

test.describe('exploded stack at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('lists the callouts under the drawing with no horizontal scroll', async ({ page }) => {
    await goLive(page);
    for (const f of [0, 0.4, 0.7, 1]) {
      await scrollTrackTo(page, f);
      await expectNoHorizontalScroll(page);
    }
    const root = island(page);
    await expect(root).toHaveAttribute('data-swapped', 'true');
    await expect(root.locator('.xs-callouts')).toContainText('your skia adapter');
    await expect(root.locator('.xs-wide')).toHaveCount(0);
  });
});

// A pinned stage on a short screen leaves the drawing whatever height is left over.
for (const [width, height] of [
  [812, 375],
  [375, 560],
  [375, 640],
  [900, 500],
]) {
  test.describe(`exploded stack on a short ${width}x${height} screen`, () => {
    test.use({ viewport: { width, height } });

    test('keeps the drawing and its labels readable', async ({ page }) => {
      await page.goto('/');
      await page.locator('#how-it-works').scrollIntoViewIfNeeded();
      await expect(page.locator('#how-it-works astro-island:not([ssr])')).toHaveCount(1);
      await scrollTrackTo(page, 0.72);
      await expect(island(page)).toHaveAttribute('data-progress', '0.72');

      const { drawing, smallest } = await page.evaluate(() => {
        const root = document.querySelector('#how-it-works .xs') as HTMLElement;
        const svg = [...root.querySelectorAll<SVGSVGElement>('svg.xs-drawing')].find(
          (s) => s.getBoundingClientRect().width > 0,
        )!;
        const shown = (el: Element) => {
          for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.display === 'none' || +cs.opacity < 0.3) return false;
          }
          return true;
        };
        const labels = [
          ...svg.querySelectorAll('text:not(.xs-face)'),
          ...[...root.querySelectorAll('.xs-callouts li *')].filter(
            (e) => e.children.length === 0 && e.textContent?.trim(),
          ),
        ].filter(shown);
        return {
          drawing: svg.getBoundingClientRect().height,
          smallest: Math.min(...labels.map((l) => l.getBoundingClientRect().height)),
        };
      });
      expect(drawing).toBeGreaterThanOrEqual(260);
      expect(smallest).toBeGreaterThanOrEqual(11);
      await expectNoHorizontalScroll(page);
    });
  });
}
