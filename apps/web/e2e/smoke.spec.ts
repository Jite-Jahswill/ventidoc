import { expect, test } from '@playwright/test';

test('home page loads and shows Ventidoc', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ventidoc' })).toBeVisible();
});

test('health endpoint returns ok', async ({ request }) => {
  const response = await request.get('/api/v1/health');
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(typeof body.version).toBe('string');
});
