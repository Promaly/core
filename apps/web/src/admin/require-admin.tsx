import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { EmptyState } from '@promaly/ui';
import { useSession } from '../session.js';

/** Renders children only for owners and admins. Members see an empty state and are redirected. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  const role = session?.workspaces[0]?.role;
  const canAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    if (!isPending && !canAdmin) {
      void navigate({ to: '/' });
    }
  }, [isPending, canAdmin, navigate]);

  if (isPending) return null;
  if (!canAdmin) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          title="Access restricted"
          description="Only workspace owners and admins can access this section."
        />
      </div>
    );
  }
  return <>{children}</>;
}
