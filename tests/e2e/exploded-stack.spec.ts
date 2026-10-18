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

  test('names the layers and says to scroll before the stack opens', async ({ page }) => {
    await goLive(page);
    const root = island(page);
    await scrollTrackTo(page, 0);
    await expect(root).toHaveAttribute('data-progress', '0');
    // The drawing paints the bottom layer first.
    await expect(root.locator('.xs-wide .xs-tag')).toHaveText([
      'Host',
      'Renderer',
      'Core',
      'View language',
    ]);
    await expect(root.locator('.xs-steps .on')).toContainText('Assembled');
    await expect(root.locator('.xs-steps')).toContainText('Scroll to take it apart');

    await scrollTrackTo(page, 1);
    await expect(root).toHaveAttribute('data-progress', '1');
    await expect(root.locator('.xs-wide .xs-tag')).toHaveCount(0);
    await expect(root.locator('.xs-steps .on')).toContainText('Swapped');
    await expect(root.locator('.xs-steps')).toContainText('New renderer, same app');
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
    await expect(root.locator('.xs-steps')).toHaveCount(0);
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

  test('keeps the layer names inside the drawing', async ({ page }) => {
    await goLive(page);
    await scrollTrackTo(page, 0);
    await expect(island(page)).toHaveAttribute('data-progress', '0');
    const { tags, clipped } = await page.evaluate(() => {
      const svg = document.querySelector('#how-it-works .xs-narrow')!.getBoundingClientRect();
      const boxes = [...document.querySelectorAll('#how-it-works .xs-narrow .xs-tag text')].map(
        (t) => t.getBoundingClientRect(),
      );
      return {
        tags: boxes.length,
        clipped: boxes.filter((r) => r.left < svg.left || r.right > svg.right).length,
      };
    });
    expect(tags).toBe(4);
    expect(clipped).toBe(0);
  });
});

// Mobile URL bars change the viewport height mid-scroll. Crossing the short-screen line
// that way must not add or remove the tall track, or the page jumps.
test.describe('exploded stack when only the height changes', () => {
  test('stays live when the height drops below 660px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await goLive(page);
    await scrollTrackTo(page, 0.3);
    await page.setViewportSize({ width: 375, height: 620 });
    await page.waitForTimeout(300);
    await expect(island(page)).toHaveAttribute('data-live', 'true');
  });

  test('stays static when the height grows past 660px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 620 });
    await page.goto('/');
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await expect(page.locator('#how-it-works astro-island:not([ssr])')).toHaveCount(1);
    await expect(island(page)).toHaveAttribute('data-live', 'false');
    await page.setViewportSize({ width: 375, height: 700 });
    await page.waitForTimeout(300);
    await expect(island(page)).toHaveAttribute('data-live', 'false');
  });

  test('decides again when the width changes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await goLive(page);
    await page.setViewportSize({ width: 1200, height: 600 });
    await expect(island(page)).toHaveAttribute('data-live', 'false');
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
