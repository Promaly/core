# ADR 0001: Promaly is an independent work-management product

- Status: accepted
- Date: 2026-08-28

## Context

Promaly needs to be a maintainable, self-hosted alternative to Linear and Jira without inheriting a large all-in-one suite.

## Decision

Build an independent Promaly monorepo. Core permanently includes workspaces, identity, projects, issues, planning, search, notifications, integrations, APIs and operational tooling. Docs, chat, calendar, AI and calls are optional modules.

## Consequences

We can keep deployment small and evolve the product model intentionally. Huly may be studied as a product reference but is not a source dependency.
