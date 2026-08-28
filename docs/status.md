# Delivery status

| Phase   | Status      | Scope                                                                 |
| ------- | ----------- | --------------------------------------------------------------------- |
| Phase 0 | Complete    | Monorepo, deployment, migrations, security, observability, operations |
| Phase 1 | ~12%        | Identity slice only                                                   |
| Phase 2 | Not started | —                                                                     |
| Phase 3 | Not started | —                                                                     |
| Phase 4 | Not started | —                                                                     |
| Phase 5 | Not started | —                                                                     |

## Known limitations

- The worker is a liveness placeholder; durable outbox processing arrives in Phase 1.
- Identity has landed, but tenancy, projects, issues, labels, and the web application have not.
- IDs remain text columns until the Phase 1 identifier migration.
