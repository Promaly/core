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

test('empty workspace shell opens the palette and navigates', async ({ page }) => {
  await mockSession(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByRole('button', { name: /search/i }).click();
  await expect(page.getByLabel('Command palette')).toBeVisible();
  await page.getByText('My work', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible();
});

test('theme toggle changes the document theme', async ({ page }) => {
  await mockSession(page);
  await page.goto('/');
  await page.getByRole('button', { name: /theme:/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
});
