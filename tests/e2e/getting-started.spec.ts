import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

const COMMANDS = [
  "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  'cargo install artic-cli',
  'cargo artic new hello && cd hello',
  'cargo run --features hot-reload',
];

test.describe('getting started', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#get-started').scrollIntoViewIfNeeded();
    // Wait for every island to hydrate so key presses reach the handlers.
    await expect(page.locator('#get-started astro-island[ssr]')).toHaveCount(0);
  });

  test('tab labels name the two files', async ({ page }) => {
    const tabs = page.locator('#get-started').getByRole('tab');
    await expect(tabs).toHaveText(['src/views/main.xaml', 'src/vm.rs']);
  });

  test('the Rust tab swaps the panel and the hint', async ({ page }) => {
    const gs = page.locator('#get-started');
    const xamlHint = 'Change this text and save. The window updates while it runs.';
    const rustHint = "A binding to a name that doesn't exist fails the build.";
    await expect(gs.getByText(xamlHint)).toBeVisible();
    await expect(gs.getByText(rustHint)).toBeHidden();
    await gs.getByRole('tab', { name: 'src/vm.rs' }).click();
    await expect(gs.getByRole('tabpanel')).toContainText('pub struct MainVm');
    await expect(gs.getByText(rustHint)).toBeVisible();
    await expect(gs.getByText(xamlHint)).toBeHidden();
  });

  test('arrow keys move between tabs', async ({ page }) => {
    const gs = page.locator('#get-started');
    const first = gs.getByRole('tab', { name: 'src/views/main.xaml' });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    const second = gs.getByRole('tab', { name: 'src/vm.rs' });
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(first).toBeFocused();
  });

  test('every command is plain text in order', async ({ page }) => {
    const texts = await page.locator('#get-started .cmd code').allTextContents();
    expect(texts).toEqual(COMMANDS);
  });

  test('copy buttons write the exact command', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const rows = page.locator('#get-started .cmd');
    for (let i = 0; i < COMMANDS.length; i++) {
      await rows.nth(i).getByRole('button', { name: /copy/i }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(COMMANDS[i]);
    }
  });

  test('notes the CLI is pre-release and links Windows to rustup', async ({ page }) => {
    const gs = page.locator('#get-started');
    await expect(gs).toContainText('Pre-release');
    await expect(gs.getByRole('link', { name: 'Windows' })).toHaveAttribute(
      'href',
      'https://rustup.rs',
    );
  });

  test('closing links go to the tutorial and examples', async ({ page }) => {
    const gs = page.locator('#get-started');
    await expect(gs.getByRole('link', { name: 'Read the tutorial' })).toHaveAttribute(
      'href',
      '/docs/tutorial/',
    );
    await expect(gs.getByRole('link', { name: 'Browse examples' })).toHaveAttribute(
      'href',
      '/docs/start-here/examples/',
    );
  });
});

test.describe('getting started layout', () => {
  for (const width of [1600, 1100, 1024, 920, 375]) {
    test(`holds at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expectNoHorizontalScroll(page);
      const gs = page.locator('#get-started');
      const fits = await gs
        .locator('.container')
        .evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(fits).toBe(true);
      const steps = (await gs.locator('ol').boundingBox())?.width ?? 0;
      expect(steps).toBeGreaterThan(280);
      if (width === 1600) {
        const panels = gs.locator('[role="tabpanel"]');
        for (let i = 0; i < 2; i++) {
          await gs.getByRole('tab').nth(i).click();
          const ok = await panels
            .nth(i)
            .evaluate((el) => el.scrollWidth <= el.clientWidth);
          expect(ok, `panel ${i} fits at 1600`).toBe(true);
        }
      }
    });
  }
});
