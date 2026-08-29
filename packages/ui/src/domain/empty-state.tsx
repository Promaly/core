import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="text-faint [&_svg]:size-8">{icon}</div>}
      <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
      {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
