import { cn } from '../lib/cn.js';

/** Issue identifier like `PROJ-123` — mono, muted (spec §4). */
export function Identifier({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('font-mono text-xs tabular-nums text-muted-foreground', className)}>
      {value}
    </span>
  );
}
