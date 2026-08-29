# ADR 0008: Issue ordering

- Status: accepted
- Date: 2026-08-29

## Decision

Issue board order uses fixed-width base-36 fractional ranks. A move chooses a rank strictly
between its neighbours. When no rank remains between two adjacent issues, the affected state
column is rebalanced transactionally to evenly spaced ranks before the move is retried.

## Consequences

The rank is opaque to clients, stable for cursor and board ordering, and does not need a schema
change. The API never accepts a client-provided `sort_key`.
