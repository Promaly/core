/**
 * Promaly UI kit. shadcn/ui primitives on Radix, styled with the design tokens
 * in `theme.css` (interaction-spec §2–§3). Import `@promaly/ui/theme.css` once
 * at the app entry, after `@import "tailwindcss"`.
 */
export { cn } from './lib/cn.js';

export { Avatar, AvatarImage, AvatarFallback } from './components/avatar.js';
export { Badge, badgeVariants } from './components/badge.js';
export { Button, buttonVariants } from './components/button.js';
export { Checkbox } from './components/checkbox.js';
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from './components/command.js';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog.js';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './components/dropdown-menu.js';
export { Input } from './components/input.js';
export { Kbd } from './components/kbd.js';
export { Label } from './components/label.js';
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from './components/popover.js';
export { ScrollArea } from './components/scroll-area.js';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from './components/select.js';
export { Separator } from './components/separator.js';
export { Skeleton } from './components/skeleton.js';
export { Toaster } from './components/sonner.js';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs.js';
export { Textarea } from './components/textarea.js';
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/tooltip.js';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './components/table.js';
export { Switch } from './components/switch.js';
export { RadioGroup, RadioGroupItem } from './components/radio-group.js';
export { Combobox, type ComboboxOption, type ComboboxProps } from './components/combobox.js';

export { StateIcon, type StateCategory } from './domain/state-icon.js';
export { PriorityIcon, PRIORITY_LABELS, type Priority } from './domain/priority-icon.js';
export { LabelDot, LabelChip } from './domain/label-dot.js';
export { Identifier } from './domain/identifier.js';
export { EmptyState } from './domain/empty-state.js';

export { toast } from 'sonner';
