import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-none',
  {
    variants: {
      variant: {
        neutral: 'bg-secondary text-muted-foreground',
        outline: 'border border-border text-muted-foreground',
        accent: 'bg-primary/12 text-primary',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
