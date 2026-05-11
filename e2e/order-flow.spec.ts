import { expect, test } from '@playwright/test';

test('public order flow reaches checkout page', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /des pâtes/i })).toBeVisible();

  await page.getByRole('link', { name: /commander maintenant/i }).first().click();
  await expect(page).toHaveURL(/\/commander/);

  await page.getByRole('button', { name: /ajouter/i }).first().click();

  await page.getByRole('button', { name: /voir le panier/i }).click();

  const cartDialog = page.getByRole('dialog', { name: /votre panier/i });
  await expect(cartDialog).toBeVisible();

  await cartDialog.getByRole('button', { name: /^retrait$/i }).click();
  await cartDialog.getByRole('button', { name: /commander/i }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole('heading', { name: /finaliser/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /payer/i })).toBeVisible();
});
