import { Dialog, DialogContent, DialogHeader, DialogTitle, Kbd } from '@promaly/ui';

type ShortcutRow = { keys: string[]; label: string };

const SHORTCUTS: { section: string; rows: ShortcutRow[] }[] = [
  {
    section: 'Global',
    rows: [
      { keys: ['⌘', 'K'], label: 'Open command palette' },
      { keys: ['C'], label: 'New issue' },
      { keys: ['['], label: 'Toggle sidebar' },
      { keys: ['?'], label: 'Keyboard shortcuts' },
    ],
  },
  {
    section: 'Issue list',
    rows: [
      { keys: ['J'], label: 'Move down' },
      { keys: ['K'], label: 'Move up' },
      { keys: ['Enter'], label: 'Open issue' },
      { keys: ['X'], label: 'Select / deselect' },
      { keys: ['Esc'], label: 'Clear selection' },
    ],
  },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {SHORTCUTS.map(({ section, rows }) => (
            <div key={section}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {section}
              </p>
              <div className="flex flex-col gap-1">
                {rows.map(({ keys, label }) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span>{label}</span>
                    <span className="flex items-center gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
