import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Checkbox,
  Combobox,
  EmptyState,
  Identifier,
  Input,
  Kbd,
  Label,
  LabelChip,
  PriorityIcon,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StateIcon,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  type Priority,
  type StateCategory,
} from '@promaly/ui';
import { useState } from 'react';
import { useTheme, type ThemePreference } from '../theme.js';

const STATES: StateCategory[] = ['backlog', 'unstarted', 'started', 'completed', 'cancelled'];
const PRIORITIES: Priority[] = [0, 1, 2, 3, 4];

const MEMBERS = [
  { value: 'alice', label: 'Alice' },
  { value: 'bob', label: 'Bob' },
  { value: 'carol', label: 'Carol' },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-4 border-b border-border py-3">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Dev-only visual reference for the UI kit. Routed at `/kitchen-sink`. */
export function KitchenSink() {
  const { preference, setPreference } = useTheme();
  const [assignee, setAssignee] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [scope, setScope] = useState('personal');
  return (
    <div className="mx-auto max-w-[880px] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[19px] font-semibold">UI kit</h1>
        <Select
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Row label="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Small</Button>
      </Row>
      <Row label="State icons">
        {STATES.map((category) => (
          <span
            key={category}
            className="flex items-center gap-1 text-[13px] text-muted-foreground"
          >
            <StateIcon category={category} /> {category}
          </span>
        ))}
      </Row>
      <Row label="Priority icons">
        {PRIORITIES.map((value) => (
          <PriorityIcon key={value} value={value} />
        ))}
      </Row>
      <Row label="Badges">
        <Badge>Neutral</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="accent">Accent</Badge>
        <Identifier value="PROJ-128" />
        <LabelChip name="bug" color="#e07c7c" />
        <Kbd>⌘K</Kbd>
      </Row>
      <Row label="Inputs">
        <Input placeholder="Text input" className="max-w-[220px]" />
        <div className="flex items-center gap-2">
          <Checkbox id="ks-check" defaultChecked />
          <Label htmlFor="ks-check">Checkbox</Label>
        </div>
        <Avatar>
          <AvatarFallback>DO</AvatarFallback>
        </Avatar>
      </Row>
      <Row label="Textarea">
        <Textarea placeholder="Multi-line" className="max-w-[320px]" />
      </Row>
      <Row label="Tabs">
        <Tabs defaultValue="a" className="w-full">
          <TabsList>
            <TabsTrigger value="a">Overview</TabsTrigger>
            <TabsTrigger value="b">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="pt-2 text-[13px] text-muted-foreground">
            Overview content.
          </TabsContent>
          <TabsContent value="b" className="pt-2 text-[13px] text-muted-foreground">
            Activity content.
          </TabsContent>
        </Tabs>
      </Row>
      <Row label="Toast">
        <Button
          variant="secondary"
          onClick={() => toast('Saved', { description: 'Issue updated.' })}
        >
          Fire toast
        </Button>
      </Row>
      <Row label="Skeleton">
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </Row>
      <Row label="Combobox">
        <Combobox
          options={MEMBERS}
          value={assignee}
          onChange={setAssignee}
          placeholder="Assign to…"
        />
      </Row>
      <Row label="Switch">
        <div className="flex items-center gap-2">
          <Switch id="ks-switch" checked={notifications} onCheckedChange={setNotifications} />
          <Label htmlFor="ks-switch">Email notifications {notifications ? 'on' : 'off'}</Label>
        </div>
      </Row>
      <Row label="RadioGroup">
        <RadioGroup value={scope} onValueChange={setScope} className="flex flex-row gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="personal" id="ks-personal" />
            <Label htmlFor="ks-personal">Personal</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="shared" id="ks-shared" />
            <Label htmlFor="ks-shared">Shared</Label>
          </div>
        </RadioGroup>
      </Row>
      <Row label="Table">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MEMBERS.map((m) => (
              <TableRow key={m.value}>
                <TableCell>{m.label}</TableCell>
                <TableCell className="text-muted-foreground">member</TableCell>
                <TableCell className="text-muted-foreground">Aug 2026</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Row>
      <div className="pt-8">
        <EmptyState
          title="Empty state"
          description="Used for zero-data screens and cleared filters."
          action={<Button size="sm">Primary action</Button>}
        />
      </div>
    </div>
  );
}
