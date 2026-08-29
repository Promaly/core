import { cn } from '../lib/cn.js';

/** 8px filled dot in the label colour + text — never colour-only (spec §3). */
export function LabelDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      <LabelDot color={color} />
      {name}
    </span>
  );
}
