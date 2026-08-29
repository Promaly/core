import { cn } from '../lib/cn.js';

export type StateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

/**
 * Workflow-state icon. Shape carries the meaning (interaction-spec §3); `color`
 * only tints it, so every state stays legible in greyscale.
 */
export function StateIcon({
  category,
  color,
  className,
}: {
  category: StateCategory;
  color?: string | undefined;
  className?: string | undefined;
}) {
  const stroke = color ?? 'currentColor';
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      style={{ color: stroke }}
    >
      {category === 'backlog' && (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2.5 2.5"
        />
      )}
      {category === 'unstarted' && (
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
      {category === 'started' && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 8 L8 2 A6 6 0 0 1 14 8 Z" fill="currentColor" />
        </>
      )}
      {category === 'completed' && (
        <>
          <circle cx="8" cy="8" r="6" fill="currentColor" />
          <path
            d="M5 8.2 L7 10.2 L11 5.8"
            fill="none"
            stroke="var(--background)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {category === 'cancelled' && (
        <>
          <circle cx="8" cy="8" r="6" fill="currentColor" />
          <path
            d="M5.6 5.6 L10.4 10.4 M10.4 5.6 L5.6 10.4"
            fill="none"
            stroke="var(--background)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
