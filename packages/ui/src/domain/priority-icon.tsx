import { cn } from '../lib/cn.js';

export const PRIORITY_LABELS = ['No priority', 'Urgent', 'High', 'Medium', 'Low'] as const;
export type Priority = 0 | 1 | 2 | 3 | 4;

/** Priority glyph (interaction-spec §3). Greyscale-legible; label via title/aria. */
export function PriorityIcon({ value, className }: { value: Priority; className?: string }) {
  const label = PRIORITY_LABELS[value] ?? PRIORITY_LABELS[0];
  const bar = (x: number, h: number, on: boolean) => (
    <rect
      x={x}
      y={14 - h}
      width="3"
      height={h}
      rx="1"
      fill="currentColor"
      opacity={on ? 1 : 0.28}
    />
  );
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label={label}
      className={cn('shrink-0', value === 1 ? 'text-warning' : 'text-muted-foreground', className)}
    >
      {value === 0 && (
        <rect x="3" y="7.25" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.6" />
      )}
      {value === 1 && (
        <>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" fill="currentColor" />
          <rect x="7.25" y="4.75" width="1.5" height="4.5" rx="0.75" fill="var(--background)" />
          <rect x="7.25" y="10.5" width="1.5" height="1.5" rx="0.75" fill="var(--background)" />
        </>
      )}
      {value >= 2 && (
        <>
          {bar(2.5, 5, true)}
          {bar(6.5, 9, value <= 3)}
          {bar(10.5, 13, value === 2)}
        </>
      )}
    </svg>
  );
}
