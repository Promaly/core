# Promaly interaction spec

A clean-room behavioural specification for the Promaly web client, informed by
studying mature issue trackers (Huly, Linear) as **reference for interaction
patterns only**. No upstream source, markup, CSS values, or copy is reproduced
here. Every token value and component decision below is Promaly's own.

Build S5–S6 UI against this document. Keep it in sync with `packages/ui` and the
issue-surface screens; amend with a PR when a decision changes.

Related: roadmap §9 (design direction), roadmap §6 ("Safe product references"),
`docs/architecture/adr/0008-issue-ordering.md`.

---

## 1. Principles

1. **Calm and compact, not a clone.** Dense enough that a board with hundreds of
   issues stays usable; quiet enough that nothing competes for attention.
2. **Keyboard-first, pointer-complete.** Every action has a keyboard path; every
   action also works with pointer/touch. Neither is a second-class citizen.
3. **The list is the product.** Optimise the issue list and board for scanning
   and fast mutation. Detail views are secondary.
4. **Status without colour.** Every state and priority is legible in greyscale.
   Colour is reinforcement, never the only signal.
5. **Optimistic, honestly.** Apply changes immediately, reconcile against the
   server's `revision`, and surface a non-destructive recovery when they diverge.
6. **Progressive disclosure.** Advanced filters, fields, and settings stay out of
   the way until asked for.

---

## 2. Design tokens

Defined in `packages/ui` as CSS custom properties on `:root`, redefined for dark.
Components read tokens only — never literals.

### Spacing — 4px base

| token        | px  | use                                   |
| ------------ | --- | ------------------------------------- |
| `--space-1`  | 4   | icon/text gap, chip padding-y         |
| `--space-2`  | 8   | control padding-y, tight stacks       |
| `--space-3`  | 12  | control padding-x, list row padding-x |
| `--space-4`  | 16  | card padding, form field gap          |
| `--space-6`  | 24  | section gap                           |
| `--space-8`  | 32  | page padding, panel gap               |
| `--space-12` | 48  | empty-state vertical rhythm           |

### Radius

`--radius-sm` 4 (chips, inputs) · `--radius-md` 6 (cards, popovers, buttons) ·
`--radius-lg` 10 (dialogs).

### Type scale

Body face: a neutral grotesque (system stack fallback). Mono for identifiers and
`kbd`.

| token         | px / line-height | use                                      |
| ------------- | ---------------- | ---------------------------------------- |
| `--text-xs`   | 11 / 16          | uppercase labels (letter-spacing 0.04em) |
| `--text-sm`   | 12 / 16          | metadata, chips, table secondary         |
| `--text-base` | 13 / 20          | list rows, form controls, body           |
| `--text-md`   | 15 / 22          | issue title in detail, section headings  |
| `--text-lg`   | 19 / 26          | page titles                              |
| `--text-xl`   | 24 / 30          | empty-state headline                     |

Running prose (descriptions, docs) sits at `--text-base` with a ~68ch measure.

### Neutrals and accent

Cool grey with a slight blue bias (reads as chosen, not default). One accent —
teal — used for the focus ring, primary buttons, links, selection, and the "in
progress" state. Semantic colours (success / warning / danger) are separate from
the accent and never used decoratively.

| role                | light     | dark      |
| ------------------- | --------- | --------- |
| `--bg`              | `#ffffff` | `#0f1319` |
| `--bg-sunk`         | `#f5f6f8` | `#161b22` |
| `--bg-raised`       | `#ffffff` | `#1b212b` |
| `--border`          | `#e4e7eb` | `#2b323c` |
| `--border-strong`   | `#cfd4da` | `#3a424d` |
| `--text`            | `#1a1f27` | `#d6dae1` |
| `--text-muted`      | `#5b6472` | `#98a1ad` |
| `--text-faint`      | `#8a929e` | `#6b7480` |
| `--accent`          | `#0f7d8c` | `#3bb6c4` |
| `--accent-contrast` | `#ffffff` | `#06262b` |
| `--success`         | `#1a7f4b` | `#3fbf7f` |
| `--warning`         | `#a5680f` | `#d79a4e` |
| `--danger`          | `#b23b3b` | `#e07c7c` |

Contrast: body text ≥ 7:1 on `--bg`, muted text ≥ 4.5:1, all interactive states ≥ 3:1.

### Elevation

Flat by default. `--shadow-popover` for popovers/menus, `--shadow-dialog` for
modals. No shadows on cards or rows — separation is the 1px `--border`.

### Motion

`--ease` `cubic-bezier(0.2, 0, 0, 1)`. `--dur-fast` 120ms (hovers, chips,
selection), `--dur-panel` 180ms (popovers, drawers, dialog). Drag has no
transition on the dragged element. Everything inside `@media (prefers-reduced-motion: reduce)`
drops to 0ms and disables transform-based transitions.

---

## 3. Iconography and status semantics

A single icon set (outline, 16px default, 1.5px stroke, inherits `currentColor`).

### Workflow-state category icons

Rendered by category, tinted by the state's colour but **shape carries the meaning**:

| category    | icon                           | meaning              |
| ----------- | ------------------------------ | -------------------- |
| `backlog`   | dashed circle                  | not yet triaged      |
| `unstarted` | hollow circle                  | triaged, not started |
| `started`   | circle with a filled pie wedge | in progress          |
| `completed` | circle with a check            | done                 |
| `cancelled` | circle with a cross            | won't do             |

### Priority icons (`0`–`4`)

| value | label       | icon                              |
| ----- | ----------- | --------------------------------- |
| 0     | No priority | dash                              |
| 1     | Urgent      | filled square with an exclamation |
| 2     | High        | three ascending bars              |
| 3     | Medium      | two bars                          |
| 4     | Low         | one bar                           |

### Labels

A 8px filled dot in the label's colour + the label text. Never colour-only.

### Assignee

`Avatar` — initials fallback, deterministic muted background from the account id.
"Unassigned" renders a dashed-outline circle, not an empty space.

---

## 4. Layout and density

### App shell

```
┌──────────┬─────────────────────────────────────────┐
│ sidebar  │ topbar (context title · view controls)  │
│  240px   ├─────────────────────────────────────────┤
│          │ content                                 │
│          │                                         │
└──────────┴─────────────────────────────────────────┘
```

- **Sidebar** 240px. Sections: workspace switcher (top), primary nav (Projects,
  My work, Search, Notifications), Projects list (favourites + all), Admin
  (bottom, capability-gated). Collapses to a 48px icon rail (`[` toggles), then
  to an overlay drawer below 768px.
- **Topbar** 44px: context title / breadcrumb on the left; view controls
  (grouping, filter, sort, saved-view menu, "New issue") on the right.
- **Content** is full-bleed for list and board. Detail and settings pages cap at
  a readable width and centre.

### List row

34px tall. Columns, left to right: selection checkbox (appears on row hover or
when any row is selected) · state icon · identifier (`PROJ-123`, mono, muted) ·
title (truncates) · spacer · priority icon · label dots · assignee avatar ·
updated-at (relative, faint, hidden < 900px). Row hover raises `--bg-sunk`;
keyboard-active row shows a 2px accent left-border and `--bg-sunk`.

### Board card

Auto height, `--space-3` padding, `--radius-md`, 1px `--border`. Line 1:
identifier + priority icon. Line 2: title (2-line clamp). Line 3: label dots +
assignee avatar. Dragging: `--shadow-popover`, 2° tilt, 0.9 opacity; the origin
shows a dashed placeholder of the same height.

---

## 5. Navigation and keyboard model

### Global shortcuts (work anywhere except inside a text field)

| keys         | action                                                 |
| ------------ | ------------------------------------------------------ |
| `⌘/Ctrl K`   | open command palette                                   |
| `C`          | create issue (in the current project context)          |
| `G` then `P` | go to Projects · `G I` My issues · `G N` Notifications |
| `[`          | toggle sidebar rail                                    |
| `?`          | keyboard-shortcut sheet                                |

### List / board shortcuts (when the list has focus)

| keys                   | action                                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| `J` / `K` or `↓` / `↑` | move active row/card                                                    |
| `X`                    | toggle selection of the active item                                     |
| `⇧ J/K`                | extend selection                                                        |
| `Enter`                | open the active item                                                    |
| `E`                    | inline-edit the active item's title                                     |
| `S` / `A` / `P` / `L`  | open the state / assignee / priority / label picker for the active item |
| `⌘/Ctrl ↵`             | submit an open inline editor                                            |
| `Esc`                  | clear selection, close picker, or leave inline edit                     |

### Board move (keyboard)

`Space` picks up the active card → arrows move it between positions and columns →
`Space` drops → `Esc` cancels and returns it. Announced via an `aria-live`
region ("Picked up PROJ-123", "Moved to In progress, position 2").

### Focus

Every interactive element has a visible `--accent` focus ring (2px, 2px offset).
Focus is never removed, only restyled. Popovers trap focus and restore it to the
trigger on close. Route changes move focus to the new page's `<h1>`.

---

## 6. Command palette

A single `Dialog` + list. Opens centred-top, ~560px wide, max 60vh.

- **Input** with a context prefix chip ("Core" when inside a project).
- **Sections**, in order: _Jump to_ (recent + matching issues/projects, matched
  by identifier or title), _Create_, _This view_ (grouping / filter / sort
  actions when a list is open), _Go to_ (nav destinations), _Account_.
- Fuzzy match; results re-rank as you type. `↑/↓` move, `↵` runs, `⌘↵` runs in a
  new tab where meaningful, `Esc` closes.
- Typing `PROJ-42` jumps straight to that issue; typing `#` scopes to labels,
  `>` to commands only.
- No network call on open — it renders from cached recents, then hydrates
  search results as you type (debounced 150ms) against `GET /v1/search/issues`.

---

## 7. Issue list view

### Data

`GET /v1/issues` with query params for `projectId`, `stateId[]`,
`stateCategory[]`, `assigneeId[]`, `labelId[]`, `priority[]`, `parentId`, `q`,
`updatedSince`, `groupBy`, `sort`, `cursor`, `limit`. The response carries
`items`, `groupCounts`, `nextCursor` (opaque keyset cursor — never construct one
client-side).

### Rendering

- **Virtualised** rows (TanStack Virtual), 34px estimate, overscan 8. The scroll
  container is the only vertical scroller on the page.
- **Grouping** by state / assignee / priority / label / none. Each group is a
  sticky header (`--text-xs` uppercase label + count from `groupCounts` + a
  chevron). Collapsed groups persist per (view, groupBy) in `localStorage`.
- Sorting `manual` (fractional rank), `priority`, `updated`, `created`.
  `manual` also enables drag-reorder within a group.
- `nextCursor` triggers the next page when the sentinel row is ~600px from the
  viewport bottom. Show a 3-row skeleton while loading.

### Inline editing

Clicking a property cell (state icon, assignee, priority, labels) opens that
property's picker as a popover anchored to the cell — **no navigation**. The
mutation is `PATCH /v1/issues/:id` with `If-Match: <revision>`. On `409` the row
flashes and refetches; the picker stays open with the fresh value.

Title edit (`E` or click-into-title): the title becomes an input in place;
`⌘↵` / blur saves, `Esc` reverts.

### Multi-select and bulk

Selecting one or more rows (`X`, checkbox, or `⇧`-click) shows a bulk bar
docked at the bottom of the list: "_n_ selected · Set state · Assign · Priority ·
Labels · Archive · Clear". Bulk actions call `POST /v1/issues/bulk` and render a
per-item result — successes update in place, conflicts get a "_k_ items changed
elsewhere — review" toast with a link that filters the list to those ids.

### Saved views

The view menu holds: current grouping/filter/sort as an unsaved draft, the
user's personal saved views, and shared views. "Save view" opens a small dialog
(name + personal/shared). Shared views require `project.manage`.

---

## 8. Board view

- Columns are the project workflow's states, in `position` order. A column
  header shows the state icon, name, and count.
- Cards are ordered by `sort_key` within a column.
- **Pointer drag** (dnd-kit): 6px activation distance; drop between cards or into
  an empty column. On drop, call `POST /v1/issues/:id/move` with
  `{ beforeId?, afterId?, stateId }` and `If-Match`. Optimistically place the
  card; on `409` snap it back and toast "Board changed — refreshed".
- **Keyboard drag** as in §5.
- Moving into a `completed` state stamps `completed_at`; moving out clears it
  (server-side, reflected on refetch). No WIP limits.
- A column with > ~200 cards virtualises internally and shows "Showing 200 of
  _n_ — filter to narrow".

---

## 9. Issue detail

Route: `/issues/:id` (also reachable as `/PROJ-123`). Layout is two panes above
900px, stacked below.

```
┌─────────────────────────────┬───────────────┐
│ breadcrumb (project / parent)│  properties   │
│ identifier · title (h1)      │  ┌───────────┐│
│                              │  │ state     ││
│ description (write | preview)│  │ assignee  ││
│                              │  │ priority  ││
│ sub-issues                   │  │ labels    ││
│ relations                    │  │ project   ││
│ ──────────────               │  │ parent    ││
│ activity + comments (feed)   │  └───────────┘│
└─────────────────────────────┴───────────────┘
```

### Description

Source-based markdown (roadmap keeps TipTap for Phase 3). `Write` / `Preview`
tabs. Preview renders with `markdown-it` + `DOMPurify` (allow-list: standard
block/inline marks, links `rel="noopener"`, no raw HTML, no images in Phase 1).
Save is explicit (`Save` button or `⌘↵`); `If-Match` on `revision`; a diverged
revision shows the "This issue changed elsewhere — Refresh to latest" bar
without discarding the draft.

### Properties panel

Each row is a label + current value + inline picker (the §11 pattern). Editing
any property is one `PATCH` with `If-Match`. The panel is a collapsible section
in the stacked layout.

### Sub-issues

An inline list (state icon · identifier · title · assignee), each row navigable.
A quick-create input at the bottom: title only, inherits the parent's project;
`POST /v1/issues/:id/subissues`. Server rejects a parent cycle → show the message
inline.

### Relations

Grouped by type (blocks / blocked by / relates to / duplicates). "Add relation"
opens an issue picker (search by identifier/title). Removing a relation is
immediate with an undo toast (5s).

### Activity feed

Merged, chronological (oldest→newest, newest pinned in view): `activity_events`
rendered as terse system lines ("changed state to In progress", "assigned to
Ada") and `comments` as full blocks with author, relative time, and an edited
marker. Comment composer at the bottom with `@`-mention autocomplete
(workspace members). `⌘↵` submits.

---

## 10. Property pickers — the shared pattern

State, assignee, priority, label, project, and parent pickers are all the same
component with different option sources.

- Trigger: the current value shown as a chip/icon; opens a `Popover`.
- Header: a filter input (auto-focused). Typing narrows options.
- Body: a virtualised option list. Current value(s) marked. Multi-select
  (labels) keeps the popover open; single-select closes on choice.
- Keyboard: `↑/↓` move, `↵` select, `Space` toggle (multi), `Esc` close.
- Empty query + no options → "No _things_ yet" with a create affordance where the
  user has the capability (labels, states).
- Every picker is a controlled component; the mutation happens in the parent so
  optimism and `If-Match` handling live in one place.

---

## 11. Feedback, motion, optimistic updates

- **Optimistic** for every single-field mutation and board/list move. The helper:
  apply locally → fire the request → on success replace with the server row
  (authoritative `revision`, timestamps) → on `409` revert and surface recovery →
  on network error keep the optimistic value, mark the row "syncing", retry once.
- **Toasts** (`Toaster`, bottom-right, max 3, 5s, dismissible) for: async batch
  results, undo affordances, background failures. Never for routine single
  edits — those are silent when they succeed.
- **Skeletons** for first paint of lists, board, and the detail panes. A spinner
  only inside a button during an explicit action.
- Selection, hover, and chip changes animate at `--dur-fast`; panels at
  `--dur-panel`. Nothing else animates. Reduced-motion removes all of it.

---

## 12. Empty, loading, and error states

Every collection view defines all four:

| state                           | contains                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Loading**                     | skeleton matching the real layout (rows / columns / panes)                                       |
| **Empty (no data yet)**         | one line naming what this is + the primary create action + a keyboard hint                       |
| **Empty (filtered to nothing)** | "No issues match these filters" + "Clear filters"                                                |
| **Error**                       | what failed, in plain language, + a "Retry" and (if useful) what to check — no apology, no stack |

The first-run workspace: Projects list is empty → "Create your first project to
start tracking work" + `New project`. After a project exists, its issue list is
empty → "No issues yet — press `C` to create one".

---

## 13. Responsive behaviour

| breakpoint | change                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 1200     | full: sidebar + two-pane detail + updated-at column                                                                                    |
| 900–1199   | detail collapses to single column (properties as a section); hide updated-at                                                           |
| 768–899    | sidebar → icon rail                                                                                                                    |
| < 768      | sidebar → overlay drawer; topbar controls collapse into a "View" menu; board scrolls horizontally with snap; bulk bar spans full width |

Touch: drag uses a long-press (250ms) to start; all hover-only affordances (row
checkbox, row actions) also appear on tap-focus. Targets ≥ 44px.

PWA: installable manifest, app-shell cached offline (not data). An offline banner
when requests fail with no connection; queued optimistic mutations flush on
reconnect.

---

## 14. Accessibility checklist (enforced)

- `axe-core` runs in CI against every route; fails the build on serious/critical.
- All icon-only controls have `aria-label`. State and priority always pair the
  icon with a text label in the accessible name.
- List is a `grid`/`listbox` with roving `tabindex`; board columns are labelled
  regions; the keyboard-drag announces via `aria-live="assertive"`.
- Colour is never the sole carrier of state, priority, or validity.
- Focus visible everywhere; focus trapped in dialogs/popovers; restored on close.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`.
- Forms: every field labelled, errors linked with `aria-describedby`, error
  summary focusable.
- Minimum target size 24px (44px on touch).

---

## 15. Component inventory → `packages/ui`

Primitives (Radix-backed where noted): `Button`, `IconButton`, `Input`,
`Textarea`, `Select`(Radix), `Combobox`, `Popover`(Radix), `Menu`(Radix
dropdown), `Dialog`(Radix), `Tooltip`(Radix), `Toaster`(Radix toast),
`Checkbox`(Radix), `Tabs`(Radix), `Avatar`(Radix), `ScrollArea`(Radix), `Kbd`,
`Skeleton`, `Badge`/`Chip`, `Separator`.

Domain components: `StateIcon`, `PriorityIcon`, `LabelDot`, `Identifier`,
`RelativeTime`, `Breadcrumbs`, `EmptyState`, `CommandPalette`, `PropertyRow` +
`PropertyPicker` (the §10 pattern), `IssueRow`, `IssueCard`, `GroupHeader`,
`BulkBar`, `ActivityItem`.

Each component ships: prop table, every visual state, keyboard behaviour, and
a11y notes. A `/kitchen-sink` route in `apps/web` renders them all in both themes
for visual review; it is excluded from the production build.

---

## 16. Open questions

- Board grouping by something other than state (assignee swimlanes) — defer to
  post-Phase-1 unless the pilot asks.
- Whether `manual` sort is per-view or a single global order per project — spec
  assumes per-project global order (matches `sort_key` on `issues`).
- Comment editing window and threading — Phase 1 is flat comments with a short
  edit window; revisit with the pilot.
- Mention notifications vs. subscription model — owned by S7.
