# Web deployment

Promaly uses one production container: the API serves the Vite build from `apps/web/dist` as static assets. This avoids a second origin and keeps session cookies and CSP scope simple. During local development, run `pnpm --filter @promaly/web dev` on port 3101; mutations obtain `/v1/auth/csrf` and use `x-csrf-token`.
