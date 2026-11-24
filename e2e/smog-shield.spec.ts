import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(({ page }) => {
  page.on('console', (message) => {
    if (message.type() === 'error') throw new Error(`Console error (CSP or runtime): ${message.text()}`);
  });
});

test('a household gets a plan, a forecast and the maths, with no accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Smog Shield');
  await page.getByRole('button', { name: 'Get my smog plan' }).click();
  await expect(page.getByRole('heading', { name: /Air today in Delhi/ })).toBeVisible();
  await expect(page.getByText('Cleanest hour:')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Show the maths' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('a community group gets group advice', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/community group/).check();
  await page.getByRole('button', { name: 'Get my smog plan' }).click();
  await expect(page.getByText(/Group exposure risk/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('the whole flow works with the keyboard alone', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('City or PIN code').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Air today/ })).toBeVisible();
});

test('security headers are set', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});
