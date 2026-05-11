import { expect, test } from '@playwright/test';

test('tracking page loads with a valid tracking token', async ({ page }) => {
  const token = process.env.E2E_TRACKING_TOKEN;

  test.skip(!token, 'Set E2E_TRACKING_TOKEN to a valid public tracking token before running this test.');

  await page.goto(`/suivi/${encodeURIComponent(token!)}`);

  await expect(page.getByRole('heading', { name: /votre commande/i })).toBeVisible();
  await expect(page.getByText(/statut actuel/i)).toBeVisible();
});
