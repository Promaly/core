import { expect, test } from '@playwright/test';

test('empty workspace shell opens the palette and navigates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByRole('button', { name: /search/i }).click();
  await expect(page.getByLabel('Command palette')).toBeVisible();
  await page.getByText('My work', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible();
});

test('theme toggle changes the document theme', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /theme:/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
});
