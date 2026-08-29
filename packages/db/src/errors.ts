/**
 * True when `error`, or anything in its `cause` chain, is a PostgreSQL
 * unique-violation (SQLSTATE 23505). Drizzle wraps driver errors in a
 * `DrizzleQueryError` whose own `code` is undefined — the SQLSTATE sits on the
 * wrapped `PostgresError` at `.cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current != null && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ('code' in current && (current as { code?: unknown }).code === '23505') {
      return true;
    }
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}
