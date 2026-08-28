# Architecture

Promaly Core is a modular monolith: one deployable application boundary, one PostgreSQL source of truth, and explicit module APIs. A transactional outbox is the target architecture; its table and durable worker runtime arrive in Phase 1.

Architecture decisions are recorded in `docs/architecture/adr/`. They are intentionally short and should be amended only with a new ADR.
