# ADR 0006: Record identifiers

## Decision

New records will use application-generated UUIDv7 values (via the `uuidv7` package) stored in native PostgreSQL `uuid` columns.

## Rationale

UUIDv7 is time-sortable while preserving distributed ID generation. Native `uuid` types prevent invalid values and improve index locality compared with text columns. PostgreSQL 18 native `uuidv7()` remains a future option.

## Consequences

Existing text ID columns remain unchanged in Phase 0. Their conversion to native UUID columns is a Phase 1 D-workstream migration with compatibility and backfill planning.
