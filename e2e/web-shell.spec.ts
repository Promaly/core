import { expect, test, type Page } from '@playwright/test';

async function mockSession(page: Page) {
  await page.route('**/v1/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        account: {
          id: 'account-1',
          email: 'owner@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        workspaces: [{ id: 'workspace-1', name: 'Acme', slug: 'acme', role: 'owner' }],
      }),
    }),
  );
}

test('the shell renders, opens the command palette, and navigates', async ({ page }) => {
  await mockSession(page);
  await page.goto('/');
  const topbar = page.locator('header');
  await expect(topbar.getByRole('heading', { name: 'Projects' })).toBeVisible();

  await page.getByRole('button', { name: /search/i }).click();
  await expect(page.getByPlaceholder(/type a command or search/i)).toBeVisible();

  await page.getByRole('option', { name: /my work/i }).click();
  await expect(topbar.getByRole('heading', { name: 'My work' })).toBeVisible();
});

test('the command palette toggles the document theme', async ({ page }) => {
  await mockSession(page);
  await page.goto('/');

  await page.getByRole('button', { name: /search/i }).click();
  await page.getByRole('option', { name: /toggle theme/i }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
});
