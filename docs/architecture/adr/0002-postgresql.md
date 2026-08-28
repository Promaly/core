# ADR 0002: PostgreSQL is the Core source of truth

- Status: accepted
- Date: 2026-08-28

## Decision

Use PostgreSQL for transactional data, full-text search, similarity search and the transactional outbox. Files live in S3-compatible object storage.

## Consequences

Core does not require a broker or dedicated search cluster. Database migrations, backups and restore verification are first-class release work.
