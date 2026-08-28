# ADR 0005: Keep upstream source use auditable

- Status: accepted
- Date: 2026-08-28

## Decision

Do not copy upstream production code by default. Any deliberately imported source must retain its licence notice and be entered in `docs/licence/upstream-register.md` with source URL, commit, licence, changes and tests.

## Consequences

Promaly's schema, tenancy, authentication, API, eventing and deployment infrastructure are written independently.
