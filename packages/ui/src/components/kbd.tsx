import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-secondary px-1 font-mono text-[10px] text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
