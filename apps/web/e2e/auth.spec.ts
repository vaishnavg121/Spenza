import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  // Simple check to ensure the dev server is responding
  await page.goto('/');
  await expect(page).toHaveTitle(/Spenza/);
});

test('redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/dashboard');
  // It should bounce to clerk or /login
  // Assuming default clerk redirect
  await page.waitForURL('**/sign-in*');
});
