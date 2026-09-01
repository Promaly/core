import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@promaly/ui';
import { CircleUser, FolderKanban, Hash, LogOut, Plus, Search, Sun } from 'lucide-react';
import { authApi } from './api.js';
import { useIssueSearch } from './issues/data.js';
import { useSessionActions } from './session.js';
import { useTheme } from './theme.js';

/** ⌘K palette (interaction-spec §6). Sections: Jump to · Create · Go to · Account. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const session = useSessionActions();
  const { preference, setPreference } = useTheme();
  const [query, setQuery] = useState('');

  const searchResults = useIssueSearch(query);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const hasResults = query.trim().length > 1 && searchResults.data && searchResults.data.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search issues or type a command…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.trim().length > 1 && !searchResults.isPending ? 'No results.' : 'Type to search…'}
        </CommandEmpty>

        {hasResults && (
          <>
            <CommandGroup heading="Jump to">
              {searchResults.data!.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`${hit.number} ${hit.title}`}
                  onSelect={() =>
                    run(
                      () => void navigate({ to: '/issues/$issueId', params: { issueId: hit.id } }),
                    )
                  }
                >
                  <Hash className="size-3.5 shrink-0 text-faint" />
                  <span className="mr-2 font-mono text-[12px] text-faint">{hit.number}</span>
                  <span className="truncate">{hit.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Create">
          <CommandItem onSelect={() => run(() => void navigate({ to: '/projects/new' }))}>
            <Plus /> New project
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => void navigate({ to: '/' }))}>
            <FolderKanban /> Projects
          </CommandItem>
          <CommandItem onSelect={() => run(() => void navigate({ to: '/my-work' }))}>
            <CircleUser /> My work
          </CommandItem>
          <CommandItem onSelect={() => run(() => void navigate({ to: '/search' }))}>
            <Search /> Search
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => run(() => setPreference(preference === 'dark' ? 'light' : 'dark'))}
          >
            <Sun /> Toggle theme
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                void authApi.logout().finally(() => {
                  session.set(null);
                  void navigate({ to: '/login' });
                });
              })
            }
          >
            <LogOut /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Global ⌘K / Ctrl-K listener; ignores keystrokes originating in a text field. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return { open, setOpen };
}
