import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

test.describe('proofs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the three claims are present', async ({ page }) => {
    const proofs = page.locator('#proofs');
    await expect(proofs.getByRole('heading', { level: 2 })).toHaveText('Fewer surprises at runtime.');
    await expect(proofs.getByRole('heading', { level: 3 })).toHaveText([
      'A typo in a binding fails the build.',
      'Every platform draws the same pixels.',
      'Screen readers work out of the box.',
    ]);
  });

  test('carets sit exactly under the typo', async ({ page }) => {
    const term = page.locator('#proofs [data-testid="compiler-error"]');
    await term.scrollIntoViewIfNeeded();
    const lefts = await term.evaluate((el) => {
      const left = (node: Element) => {
        const r = document.createRange();
        r.selectNodeContents(node);
        return r.getBoundingClientRect().left;
      };
      const src = el.querySelector('.src')!;
      const text = src.firstChild as Text;
      const i = text.data.indexOf('Emial');
      const r = document.createRange();
      r.setStart(text, i);
      r.setEnd(text, i + 'Emial'.length);
      return { typo: r.getBoundingClientRect().left, carets: left(el.querySelector('.carets')!) };
    });
    expect(Math.abs(lefts.typo - lefts.carets)).toBeLessThanOrEqual(1);
  });

  test('the error is labeled as a sketch', async ({ page }) => {
    await expect(
      page.locator('#proofs').getByText('Error format is a sketch until the XAML compiler ships.'),
    ).toBeVisible();
  });

  test('every platform is shown', async ({ page }) => {
    await expect(page.locator('#proofs .dev small')).toHaveText([
      'Windows',
      'macOS',
      'Linux',
      'iOS',
      'Android',
    ]);
  });

  test('the accessibility tree keeps its indentation and the bubble reads aloud', async ({ page }) => {
    const row = page.locator('#proofs .tree .nodes > div').nth(3);
    await expect(row).toHaveCSS('white-space', 'pre');
    await expect(page.locator('#proofs .speech')).toHaveText('"Sign in, button"');
  });

  test('makes no zero-pixel claim', async ({ page }) => {
    await expect(page.locator('#proofs')).not.toContainText(/\b0\s?px\b/i);
  });

  for (const width of [375, 900, 1024, 1100, 1600]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expectNoHorizontalScroll(page);
    });
  }

  test('claim stacks over evidence when narrow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    const first = page.locator('#proofs .proof').first();
    const claim = await first.locator('.claim').boundingBox();
    const evidence = await first.locator('.evidence').boundingBox();
    expect(evidence!.y).toBeGreaterThanOrEqual(claim!.y + claim!.height);
  });
});
