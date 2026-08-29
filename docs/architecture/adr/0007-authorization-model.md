# ADR 0007: Workspace capability authorization

- Status: accepted
- Date: 2026-08-29

## Decision

Authorization is workspace-scoped and capability-based. A membership role grants a fixed set of capabilities; request handlers ask the domain authorization service for a capability rather than branching directly on role names. The initial role matrix is deliberately small:

| Capability                             | Owner | Admin | Member | Guest |
| -------------------------------------- | :---: | :---: | :----: | :---: |
| View workspace, projects, and issues   |   ✓   |   ✓   |   ✓    |   ✓   |
| Create and edit issues                 |   ✓   |   ✓   |   ✓    |   —   |
| Create and manage projects             |   ✓   |   ✓   |   —    |   —   |
| Invite, remove, and change members     |   ✓   |   ✓   |   —    |   —   |
| Manage workspace settings              |   ✓   |   —   |   —    |   —   |
| Transfer ownership or delete workspace |   ✓   |   —   |   —    |   —   |

Capabilities are evaluated against the active workspace membership, never from a client-supplied role or global account state. An account may have different roles in different workspaces.

## Consequences

Phase 1 introduces the authorization service, middleware, and tests alongside each protected route. New roles or exceptions must add capabilities explicitly and update this table; direct role checks outside the authorization module are not permitted.
