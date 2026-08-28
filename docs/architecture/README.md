# Architecture

Promaly Core is a modular monolith: one deployable application boundary, one PostgreSQL source of truth, and explicit module APIs. Background work is persisted through a transactional outbox before a worker processes it.

Architecture decisions are recorded in `docs/architecture/adr/`. They are intentionally short and should be amended only with a new ADR.
