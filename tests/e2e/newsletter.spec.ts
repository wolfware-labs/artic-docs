import { test, expect } from '@playwright/test';

// The default build has no MailerLite action, so there is no form to render.
test('without a MailerLite action there is no newsletter form and the links remain', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#roadmap form')).toHaveCount(0);
  await expect(page.getByText('Follow artic as it grows.')).toHaveCount(0);
  await expect(page.locator('#roadmap .links a')).toHaveText([
    'Read the spec',
    'Good first issues',
    'Star on GitHub',
  ]);
});
