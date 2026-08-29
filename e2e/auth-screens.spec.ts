import { expect, test } from '@playwright/test';

test('authentication screens expose secure form controls', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Work email' })).toBeVisible();
  await expect(page.getByLabel('Workspace name')).toBeVisible();

  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

  await page.goto('/invites/example-token');
  await expect(page.getByRole('heading', { name: 'Join workspace' })).toBeVisible();
});
