import createClient from 'openapi-fetch';
import type { paths } from './generated.js';
export type { paths } from './generated.js';
export function createPromalyClient(baseUrl = '') {
  return createClient<paths>({ baseUrl, credentials: 'include' });
}
