import { expect, test } from '@playwright/test';

test('the API health endpoint is available', async ({ request }) => {
  const response = await request.get('/healthz');

  await expect(response).toBeOK();
  expect(await response.json()).toEqual({
    status: 'ok',
    service: 'api',
    timestamp: expect.any(String),
  });
});
