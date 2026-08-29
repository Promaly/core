import type { ComponentProps } from 'react';
import { Toaster as Sonner } from 'sonner';

export function Toaster(props: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast flex items-center gap-3 rounded-md border border-border bg-popover p-3 text-[13px] text-popover-foreground shadow-[var(--shadow-popover)]',
          description: 'text-muted-foreground',
          actionButton: 'rounded bg-primary px-2 py-1 text-xs text-primary-foreground',
          cancelButton: 'rounded bg-secondary px-2 py-1 text-xs',
        },
      }}
      {...props}
    />
  );
}
