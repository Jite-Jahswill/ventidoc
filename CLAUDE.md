# Working rules for Ventidoc

These rules are permanent and apply to every stage of this project.

1. Build only the current stage. Never start features, tables, routes or UI that
   belong to a later stage, even if they look small or convenient to add now.
2. Every feature ships with tests in the same change (unit + integration; end-to-end
   where there is UI). Tests are not a follow-up task.
3. The full suite — lint, typecheck, unit tests and end-to-end tests — must pass
   before a stage is considered done. Not just the new tests.
4. From Stage 1 on, every tenant-owned table has a `tenant_id` column. Tenant data
   is never queried outside the scoped repository layer — no raw queries that skip
   the tenant filter, even for "quick" debugging code.
5. Money is always stored as integer minor units (e.g. kobo, cents) plus a currency
   code. Never store money as a float.
6. Use UUIDv7 for all primary keys. Never expose sequential integer IDs in URLs.
7. Keep commits small with clear messages. Work on a branch named `stage-N-name`.
