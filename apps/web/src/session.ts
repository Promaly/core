import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type Session } from './api.js';

export const SESSION_KEY = ['session'] as const;

/**
 * Current session, or `null` when unauthenticated. Never throws: the shell reads
 * `data === null` to decide the login redirect, so a failed `/auth/me` resolves
 * to `null` rather than an error state.
 */
export function useSession() {
  return useQuery<Session | null>({
    queryKey: SESSION_KEY,
    queryFn: () => authApi.session().catch(() => null),
    staleTime: 60_000,
  });
}

export function useSessionActions() {
  const client = useQueryClient();
  return {
    set: (session: Session | null) => client.setQueryData(SESSION_KEY, session),
    invalidate: () => client.invalidateQueries({ queryKey: SESSION_KEY }),
  };
}
