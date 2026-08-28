# ADR 0003: Start with a modular monolith

- Status: accepted
- Date: 2026-08-28

## Decision

Use a TypeScript pnpm workspace and deploy API and worker processes from one codebase. Modules communicate through domain services and durable outbox events, never direct cross-module table access.

## Consequences

The initial system is operationally small while retaining boundaries that can be extracted after evidence demands it.
