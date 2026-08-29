import { createPromalyClient } from '@promaly/sdk';

const client = createPromalyClient('/v1');
let csrfToken: string | undefined;
export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await client.GET('/v1/auth/csrf');
  csrfToken = (response.data as { csrfToken?: string } | undefined)?.csrfToken;
  return csrfToken;
}
export async function mutate<T>(
  operation: (headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  const token = await getCsrfToken();
  return operation(token ? { 'x-csrf-token': token } : {});
}
export { client };
