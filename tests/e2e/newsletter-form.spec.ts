import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

// Runs against a second build made with PUBLIC_MAILERLITE_ACTION set (see playwright.config.ts).
const endpoint = 'https://assets.mailerlite.com/test';

test.describe('newsletter form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#roadmap .follow').scrollIntoViewIfNeeded();
    // The form is hydrated once it carries data-ready; before that it posts natively.
    await expect(page.locator('#roadmap form[data-ready]')).toHaveCount(1);
  });

  test('renders a labelled form that posts to the configured action', async ({ page }) => {
    const form = page.locator('#roadmap form');
    await expect(form).toHaveAttribute('action', endpoint);
    await expect(form).toHaveAttribute('method', 'post');
    await expect(page.getByText('Follow artic as it grows.')).toBeVisible();
    await expect(
      page.getByText("One email a month on what shipped and what's next. Unsubscribe anytime."),
    ).toBeVisible();
    const input = page.getByLabel(/follow artic/i);
    await expect(input).toHaveAttribute('name', 'fields[email]');
    await expect(input).toHaveAttribute('type', 'email');
    await expect(input).toHaveAttribute('required', '');
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible();
    await expect(page.locator('#roadmap .links a')).toHaveCount(3);
  });

  test('keeps a polite live region rendered before any submit', async ({ page }) => {
    const live = page.locator('#roadmap form [aria-live="polite"]');
    await expect(live).toHaveCount(1);
    const display = await live.evaluate((el) => getComputedStyle(el).display);
    expect(display).not.toBe('none');
    await expect(live).toBeEmpty();
  });

  test('the browser blocks an invalid email', async ({ page }) => {
    let posted = false;
    await page.route(endpoint, (route) => {
      posted = true;
      return route.fulfill({ json: { success: true } });
    });
    await page.getByLabel(/follow artic/i).fill('not-an-email');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    const valid = await page.getByLabel(/follow artic/i).evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
    expect(posted).toBe(false);
  });

  test('a valid email shows the success message', async ({ page }) => {
    let body = '';
    await page.route(endpoint, (route) => {
      body = route.request().postData() ?? '';
      return route.fulfill({
        json: { success: true },
        headers: { 'access-control-allow-origin': '*' },
      });
    });
    await page.getByLabel(/follow artic/i).fill('reader@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText('Check your inbox to confirm your subscription.')).toBeVisible();
    expect(decodeURIComponent(body)).toContain('reader@example.com');
    expect(decodeURIComponent(body)).toContain('ml-submit');
    await expect(page.locator('#roadmap [aria-live="polite"]')).toContainText('Check your inbox');
  });

  test('a server error shows the error message and keeps the typed email', async ({ page }) => {
    await page.route(endpoint, (route) => route.fulfill({ status: 500, body: 'nope' }));
    const input = page.getByLabel(/follow artic/i);
    await input.fill('reader@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText("That didn't go through. Try again in a minute.")).toBeVisible();
    await expect(input).toHaveValue('reader@example.com');
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
  });

  test('a network error falls back to a plain form submit', async ({ page }) => {
    const seen: { type: string; method: string }[] = [];
    await page.route(endpoint, (route) => {
      const request = route.request();
      seen.push({ type: request.resourceType(), method: request.method() });
      if (request.resourceType() === 'document') {
        return route.fulfill({ contentType: 'text/html', body: '<p>ok</p>' });
      }
      return route.abort();
    });
    await page.getByLabel(/follow artic/i).fill('reader@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await page.waitForURL(endpoint);
    expect(seen).toContainEqual({ type: 'document', method: 'POST' });
  });

  test('an unreadable success response falls back to a plain form submit', async ({ page }) => {
    const seen: string[] = [];
    await page.route(endpoint, (route) => {
      const request = route.request();
      seen.push(request.resourceType());
      return route.fulfill({
        contentType: 'text/html',
        body: request.resourceType() === 'document' ? '<p>ok</p>' : 'not json',
      });
    });
    await page.getByLabel(/follow artic/i).fill('reader@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await page.waitForURL(endpoint);
    expect(seen).toContain('document');
  });

  test('a rejected signup (success false) also shows the error', async ({ page }) => {
    await page.route(endpoint, (route) => route.fulfill({ json: { success: false } }));
    await page.getByLabel(/follow artic/i).fill('reader@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText("That didn't go through. Try again in a minute.")).toBeVisible();
  });

  for (const width of [1600, 1024, 375]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalScroll(page);
    });
  }
});
