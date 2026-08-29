import { Command as CommandPrimitive } from 'cmdk';
import type { HTMLAttributes, ReactNode } from 'react';
import { Search } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../lib/cn.js';
import { Dialog, DialogContent, type DialogProps } from './dialog.js';

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(function Command({ className, ...props }, ref) {
  return (
    <CommandPrimitive
      ref={ref}
      className={cn(
        'flex size-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
});

export function CommandDialog({ children, ...props }: DialogProps & { children: ReactNode }) {
  return (
    <Dialog {...props}>
      <DialogContent
        showClose={false}
        className="overflow-hidden p-0 shadow-[var(--shadow-dialog)] sm:max-w-[560px]"
      >
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(function CommandInput({ className, ...props }, ref) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3" cmdk-input-wrapper="">
      <Search className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          'flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-faint disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
});

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(function CommandList({ className, ...props }, ref) {
  return (
    <CommandPrimitive.List
      ref={ref}
      className={cn('max-h-[360px] overflow-y-auto overflow-x-hidden p-1', className)}
      {...props}
    />
  );
});

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(function CommandEmpty(props, ref) {
  return (
    <CommandPrimitive.Empty
      ref={ref}
      className="py-6 text-center text-[13px] text-faint"
      {...props}
    />
  );
});

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(function CommandGroup({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      className={cn('overflow-hidden p-1 text-foreground', className)}
      {...props}
    />
  );
});

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(function CommandItem({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-2 text-[13px] outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-secondary [&_svg]:size-4 [&_svg]:opacity-70',
        className,
      )}
      {...props}
    />
  );
});

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
});

export function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('ml-auto text-xs tracking-widest text-faint', className)} {...props} />
  );
}
