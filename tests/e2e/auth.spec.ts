import { test, expect } from '@playwright/test';

test('has title and login links', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/KAI-OS/);

  await expect(page.getByRole('button', { name: /Access Portal/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Initialize Session/i })).toBeVisible();
});
