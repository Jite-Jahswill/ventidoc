# Progress

## Stage 0 — Repo & tooling

**Status:** done. Full suite green (lint, typecheck, unit tests, build, e2e).

### What was built

- pnpm workspace + Turborepo monorepo, Node 20 LTS pinned (`.nvmrc`, `engines`), TypeScript
  strict mode everywhere, all dependency versions pinned to an exact version (no `latest`,
  no caret/tilde ranges).
- `apps/web`: Next.js 16 (App Router, TypeScript, Tailwind CSS v4).
  - `/` renders "Ventidoc" (inside the `(marketing)` route group).
  - `GET /api/v1/health` returns `{ status: "ok", version }` as JSON.
  - Route groups `(marketing)`, `(app)`, `(admin)`, `(jobs)`, `(market)` each exist with one
    placeholder page (`/`, `/app`, `/admin`, `/jobs`, `/market` respectively — a route group
    alone doesn't add a URL segment, so each non-marketing group owns one real path so it's
    reachable and doesn't collide with the others on `/`).
- 8 shared packages, each with `package.json`, `src/index.ts` and a passing test:
  `db`, `core`, `auth`, `permissions`, `validation`, `emails`, `ui`, `config`.
  - `packages/config` also holds the shared strict `tsconfig` base
    (`packages/config/tsconfig/base.json`) and the shared ESLint flat config base
    (`packages/config/eslint/base.mjs`), both re-used by every other package and by `apps/web`.
  - `packages/config` implements real env validation with Zod (`parseEnv()`): fails fast with
    a readable error message listing every invalid/missing variable, including conditional
    rules (`SMTP_HOST` required when `EMAIL_PROVIDER=smtp`, `RESEND_API_KEY` required when
    `EMAIL_PROVIDER=resend`).
  - The other 7 packages are intentionally empty placeholders — their real contents land in
    the stage that needs them (noted in each package's `src/index.ts`).
- `docker-compose.yml`: Postgres 16.15 (port 5432) with an init script that also creates a
  separate `ventidoc_test` database, and Mailpit v1.33.0 (SMTP on 1025, web UI on 8025).
- `.env.example` with every variable from the spec; validated at startup via
  `@ventidoc/config`'s `parseEnv()`.
- ESLint (flat config, ESLint 9), Prettier, Vitest, Playwright all wired up. Root scripts:
  `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format`, `format:check`, `db:up`,
  `db:down` — each one fans out to every workspace package via Turborepo.
- Playwright smoke test (`apps/web/e2e/smoke.spec.ts`): home page shows "Ventidoc", and
  `/api/v1/health` returns `{ status: "ok" }`. It builds the app and boots a real
  `next start` server on a dedicated port (3100) rather than reusing the dev server.
- GitHub Actions CI (`.github/workflows/ci.yml`): runs on push to `main` and on pull
  requests, with a Postgres 16.15 service container, pnpm dependency caching, and the
  sequence install → lint → typecheck → unit tests → build → Playwright.
- `CLAUDE.md` with the permanent working rules for every future stage.

### Decisions

- **TypeScript 5.9.3, not 7.0.2.** `npm`'s `latest` tag for `typescript` currently points at
  7.0.2 (the new Go-ported compiler), but `typescript-eslint@8.72.1` only supports
  `typescript@>=4.8.4 <6.1.0`. Pinned to the newest 5.x release instead to keep linting and
  typechecking on supported, compatible versions.
- **ESLint 9.39.5, not 10.14.0.** `eslint-config-next@16.4.3`'s own transitive dependencies
  (`eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`) only declare
  peer support up to ESLint 9, and running against ESLint 10 produced a hard crash
  (`TypeError: Converting circular structure to JSON`) when the legacy-to-flat compat layer
  tried to serialize `eslint-plugin-react`'s config object for an error message. ESLint
  9.39.5 is fully compatible with everything else that's pinned.
- **Vitest 4.1.12, not 5.0.5.** Vitest 5 requires `@types/node@^22 || >=24`; since the spec
  pins Node 20 LTS, `@types/node` is pinned to the matching `20.x` line, so Vitest is pinned
  to the newest 4.x release that explicitly supports `@types/node@^20`.
- **No `FlatCompat`/`eslint-config-next` legacy bridging.** `eslint-config-next@16.4.3`
  ships a native ESLint flat config (`eslint-config-next/core-web-vitals`) directly — no
  `@eslint/eslintrc` shim needed. The root `eslint.config.mjs` imports it and explicitly
  scopes its `files` glob to `apps/web/**`, since several of its config blocks otherwise
  default to matching every `.ts`/`.tsx` file in the repo, which would pull Next/React/JSX
  rules (and their "pages directory not found" warnings) into the backend packages that
  have no React or pages at all.
- **No build step for shared packages.** Each package exports its TypeScript source
  directly (`main`/`types` point at `src/index.ts`); `apps/web/next.config.ts` lists them
  all under `transpilePackages` so Next compiles them itself. This avoids a `tsc` build step
  and a `dist/` output for every package during Stage 0 — can be revisited if a package ever
  needs to be consumed outside of Next's bundler.
- **Playwright boots `next start` on port 3100**, not the dev server on 3000, so `pnpm dev`
  and `pnpm test:e2e` never fight over a port, and e2e exercises an actual production build.

### Known issues / TODOs

- Docker Compose was validated with `docker compose config` (parses and resolves cleanly)
  but **not run end-to-end** in this environment — no Docker daemon was available here. Run
  `pnpm db:up` and confirm Postgres accepts connections and Mailpit's UI loads at
  `localhost:8025` before relying on it in Stage 1.
- `pnpm install` on this machine runs Node 24, not Node 20, which prints a
  `WARN Unsupported engine` notice on every command. Harmless (CI pins Node 20 exactly via
  `actions/setup-node`), but contributors should use `nvm use` (reads `.nvmrc`) locally.
- ESLint 9.39.5 is past its own support window per eslint.org's version-support policy
  (pnpm prints a deprecation notice on install). It's the newest version compatible with the
  rest of the pinned toolchain today; revisit the whole ESLint/typescript-eslint/
  eslint-config-next chain together once they all support a newer major in lockstep.
- No `packages/db` schema yet — this is expected; it's Stage 1 scope.

### Running it locally

```bash
nvm use                 # Node 24
corepack enable          # gives you the pinned pnpm version
pnpm install

cp .env.example .env     # edit if needed; defaults match docker-compose.yml

pnpm db:up               # Postgres on :5432, Mailpit on :1025 / UI on :8025

pnpm dev                 # http://localhost:3000

pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e            # builds the app and runs Playwright against a prod server on :3100

pnpm format               # or: pnpm format:check

pnpm db:down              # stop the local services
```

## Stage 0.1 — Node 24 LTS, dependency re-check, git remote, repo hygiene

**Status:** done. Full suite re-run green (lint, typecheck, unit tests, build, e2e).

### What changed

- **Node 20 → Node 24 LTS.** Node 20 is end-of-life; Node 24 is the current Active LTS line.
  Updated `.nvmrc` (`24`), `package.json#engines.node` (`24.x`), and
  `.github/workflows/ci.yml`'s `actions/setup-node` `node-version` (`24`).
- **`@types/node` 20.19.43 → 24.19.2** in every package, to match the new Node target.
- **Vitest 4.1.12 → 5.0.5.** Vitest 5 requires `@types/node@^22.0.0 || >=24.0.0`; that's now
  satisfied by the `@types/node` bump above, so upgraded to the newest Vitest release across
  every package. All 13 unit tests still pass unchanged.
- **TypeScript stays at 5.9.3** (did not upgrade to 7.0.2). `typescript-eslint@8.72.1` — still
  the newest release — only supports `typescript@>=4.8.4 <6.1.0`; this is independent of the
  Node version, so the constraint from Stage 0 still applies. Re-checked `npm view
typescript-eslint versions` and there is no newer major that supports TS 7 yet.
- **ESLint stays at 9.39.5** (did not upgrade to 10.14.0), for the same reason recorded in
  Stage 0: `eslint-config-next@16.4.3`'s transitive deps (`eslint-plugin-import`,
  `eslint-plugin-react`, `eslint-plugin-jsx-a11y`) still only declare peer support up to
  ESLint 9; no new release of any of them has shipped since Stage 0.
- **Git remote added**: `origin` → `https://github.com/Jite-Jahswill/ventidoc.git`. Branch
  `stage-0-tooling` pushed. `main` was **not** touched — no merge, no tag, nothing pushed to
  `main`, per the standing rule in `CLAUDE.md`.
- **Repo hygiene**: removed `apps/web/tsconfig.tsbuildinfo`, a TypeScript incremental-build
  cache file that had been accidentally committed in Stage 0 (harmless content — no secrets
  — but it's a build artifact, not source). Added `*.tsbuildinfo` to `.gitignore` so it can't
  happen again.
- **`.gitignore` audit**: confirmed `.env`, `.env.local`, `.env.*.local`, `node_modules/`,
  `.next/`, `playwright-report/`, `test-results/` and `coverage/` are all ignored, at both
  the repo root and inside `apps/web` (verified with `git check-ignore -v` against real
  paths in each package).
- **Secret scan**: `git log --all -p` across every commit and every file ever committed,
  grepped for API keys, passwords, tokens and private-key headers. No findings — the only
  hits are the literal variable names (`RESEND_API_KEY`, etc.) in source/docs and the
  intentionally-hardcoded local-only `ventidoc`/`ventidoc` Postgres dev credentials in
  `docker-compose.yml` and `.github/workflows/ci.yml`, which are not real secrets (local
  Docker container only, never used outside this machine/CI run).

### Final versions

| Tool         | Version    |
| ------------ | ---------- |
| Node         | 24.x (LTS) |
| TypeScript   | 5.9.3      |
| Vitest       | 5.0.5      |
| ESLint       | 9.39.5     |
| Next.js      | 16.4.3     |
| React        | 19.3.1     |
| Tailwind CSS | 4.3.3      |
| Playwright   | 1.64.1     |
| Turborepo    | 2.11.10    |
| pnpm         | 10.34.6    |

### Check results (re-run after all of the above)

- `pnpm lint` → **9/9 packages pass**, 0 errors/warnings
- `pnpm typecheck` → **9/9 pass**
- `pnpm test` → **9/9 suites pass, 13/13 tests pass**
- `pnpm build` → **pass** (7 static routes + 1 dynamic API route)
- `pnpm test:e2e` → **2/2 Playwright tests pass**

### Known issues / TODOs (carried over or new)

- ESLint 9.39.5 remains past its own upstream support window; still the newest version
  compatible with the rest of the pinned chain. Revisit once `eslint-config-next`'s
  transitive deps catch up to ESLint 10+.
- CI has not run on GitHub yet for the pushed branch — confirm it's green there before
  merging to `main`.

## Stage 0.1 follow-up — local Docker verification

**Status:** done. `pnpm db:up` verified end-to-end on the developer's machine.

### What was found and fixed

- `pnpm db:up` initially failed: `ports are not available: exposing port TCP
0.0.0.0:5432 -> 127.0.0.1:0: ... address already in use`. Root cause: a **native**
  PostgreSQL 18 install (`/Library/PostgreSQL/18/bin/postgres`, not Docker) was already
  bound to host port 5432. Rather than touching that unrelated, already-running service,
  remapped this project's Postgres container to host port **5433** instead (container-internal
  port stays 5432, unaffected). Updated `docker-compose.yml`'s port mapping and
  `DATABASE_URL`/`DATABASE_URL_TEST` in `.env.example` to point at `localhost:5433`. The CI
  workflow's own Postgres service container is unaffected — it runs in an isolated GitHub
  Actions VM on port 5432 with no such conflict.
- **Heads up, not fixed**: `docker compose up` reported orphan containers
  `ventidoc-objectstore-1`, `ventidoc-clamav-1`, `ventidoc-redis-1` — an unrelated, already-running
  Compose project on this machine also uses the project name `ventidoc` (Docker Compose
  derives the project name from the directory name by default, so a different, unrelated
  `ventidoc` folder or an older project is colliding on the name). Left untouched since they
  looked like separate, active infrastructure (seaweedfs/clamav/redis) that may still be in
  use; if this project should run its own isolated Compose namespace, add a `name:` key to
  `docker-compose.yml` (e.g. `name: ventidoc-stage0`) in a later stage.

### Verified locally

- `pnpm db:up` → Postgres and Mailpit containers both report `healthy`.
- Postgres accepts connections on `localhost:5433` (`psql`/`SELECT 1` succeeded inside the
  container); the `ventidoc_test` database was created automatically by the init script.
- Mailpit's web UI responds `HTTP 200` at `http://localhost:8025` (API reports
  `"Version":"v1.33.0"`, matching the pinned image, 0 messages as expected with no emails
  sent yet).

## Stage 1 — Database foundation & tenant isolation

**Status:** done. Full suite green (lint, typecheck, unit tests including the isolation
suite, build, e2e).

### Summary

Drizzle ORM + `postgres` (postgres.js) in `packages/db`, with migrations tracked by
drizzle-kit. Two Postgres roles — `ventidoc_owner` (owns every table, bypasses RLS, used only
for migrations/seeds/tests) and `ventidoc_app` (no DDL rights, not a table owner, cannot
bypass RLS, used at runtime) — are created once by `docker/init/00-bootstrap.sh`, which runs
automatically in local dev (via `docker-entrypoint-initdb.d`) and as an explicit CI step. Four
tables (`tenants`, `shops`, `tenant_members`, `audit_logs`) have Postgres Row-Level Security
**enabled and forced**, so even a query that forgets a `WHERE tenant_id = ...` clause gets zero
rows back from the database itself, not just from application code. `users` has no RLS yet —
documented below.

The public API is two functions: `withTenant(tenantId, fn)` opens a transaction on the app
role and sets `app.tenant_id` for its duration; `withSystem(fn)` opens a transaction on the
owner role (bypasses RLS) for seeds, migrations and tests only. Neither the raw Drizzle client
nor the connection pools are exported from the package.

### Schema overview

| Table            | Columns (beyond id/timestamps)                                                                                                                                                        | Notes                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `users`          | `email` (unique), `name`, `status`                                                                                                                                                    | Global identity, no `tenant_id`, no RLS — access goes only through the auth layer built in Stage 3 |
| `tenants`        | `name`, `slug` (unique), `status`, `owner_user_id` → `users.id`                                                                                                                       | Tenant-scoped rows match on the tenant's own `id`                                                  |
| `shops`          | `tenant_id` → `tenants.id`, `name`, `address`, `timezone`, `status`                                                                                                                   | Soft-deletable (`deleted_at`)                                                                      |
| `tenant_members` | `tenant_id` → `tenants.id`, `user_id` → `users.id`, `status`                                                                                                                          | Unique on `(tenant_id, user_id)`; soft-deletable                                                   |
| `audit_logs`     | `tenant_id` (nullable, for Stage 5+ platform events) → `tenants.id`, `actor_user_id` → `users.id`, `action`, `entity_type`, `entity_id`, `before`/`after` (jsonb), `ip`, `user_agent` | Append-only — `ventidoc_app` gets INSERT + SELECT only, never UPDATE/DELETE                        |

All primary keys are UUIDv7, generated in the app via the `uuidv7` package (`generateId()`),
never by the database.

### RLS policies

One `FOR ALL` policy per table (`USING` + `WITH CHECK`, so a row can't be read, updated,
deleted, _or inserted_ for another tenant):

- `tenants_isolation` — `id = NULLIF(current_setting('app.tenant_id', true), '')::uuid`
- `shops_isolation` — `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid`
- `tenant_members_isolation` — same predicate as `shops_isolation`
- `audit_logs_isolation` — same predicate; a `NULL` `tenant_id` (platform event) never equals
  a set tenant id, so platform events stay invisible to every tenant-scoped session

All four tables have both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` — FORCE
matters because `ventidoc_owner` owns every table, and ENABLE alone would exempt the owner.
(`withSystem()`'s owner-role connection still bypasses RLS entirely, because the role itself
has the `BYPASSRLS` attribute — that's deliberate, so seeds/tests can set up cross-tenant
fixtures.)

### Decisions

- **postgres.js over node-postgres.** Its `sql.begin()`/Drizzle's `db.transaction()` API maps
  directly onto "open a transaction, run one `set_config` call, run the caller's queries,
  commit" with no extra ceremony, and it's a common pairing with Drizzle for exactly this
  pooled-connection-with-per-transaction-context pattern (the blueprint's own "serverless +
  Postgres needs pooling" caveat).
- **RLS policies and grants are a hand-written custom migration (`0001_rls_and_grants.sql`),
  not Drizzle's native `pgPolicy()`/`.enableRLS()` schema API.** Drizzle-kit's generated
  `ENABLE ROW LEVEL SECURITY` doesn't include `FORCE`, which this stage requires, so a custom
  migration was needed regardless; keeping the whole security-critical surface (RLS + grants)
  as one reviewable SQL file was preferred over splitting it between TypeScript decorators and
  raw SQL.
- **`ventidoc_owner` owns the _database_, not just the `public` schema.** Postgres 15+ doesn't
  grant `CREATE` on `public` to new roles by default; schema ownership alone lets
  `ventidoc_owner` create tables, but drizzle-kit's migrator also needs to create its own
  `drizzle` schema for migration tracking, which needs database-level `CREATE`. (This is also
  why `drizzle-kit migrate` failed silently with no error message the first time — the
  underlying "permission denied for database" error wasn't being surfaced by its spinner UI;
  confirmed by reproducing the failure with a raw `psql` command.)
- **Scripts invoke the installed packages' actual entry files directly**
  (`node_modules/drizzle-kit/bin.cjs`, `node_modules/vitest/vitest.mjs`,
  `node_modules/tsx/dist/cli.mjs`) instead of their `node_modules/.bin/*` shims, combined with
  `node --env-file-if-exists=../../.env`. The `.bin` shims are POSIX shell scripts, not
  JavaScript, so `node <shim>` fails with a syntax error; the package's own declared `bin`
  entry point is always plain JS and works with this pattern. `--env-file-if-exists` (not
  `--env-file`) so the same script works locally (loads `.env` if present) and in CI (no
  `.env` file; env vars are already injected by the workflow).
- **Vitest setup remaps `DATABASE_URL`/`DATABASE_MIGRATION_URL` to the `_TEST` variants**
  (`packages/db/vitest.setup.ts`) rather than giving `withTenant`/`withSystem` a
  test-specific entry point, so the exact same functions under test are what the rest of the
  app will use. `fileParallelism: false` for this package only, since its tests share one real
  Postgres database and a `globalSetup` (`vitest.global-setup.ts`) resets and re-migrates it
  from scratch once before the whole suite, per the stage's "migrated fresh before the suite"
  requirement.
- **The pooled-connection leak test uses its own dedicated `{ max: 1 }` postgres.js client**,
  independent of the package's shared pool, so "same physical connection reused" is
  deterministic regardless of what other tests in the suite have done to the shared pool's
  size. It also demonstrates something worth knowing: `current_setting(name, true)` returns
  `NULL` for a custom GUC that's never been touched in the session, but `''` (empty string)
  once it has been set transaction-locally and that transaction has ended — never back to
  `NULL`. That's exactly why the RLS policies normalise with `NULLIF(..., '')` rather than
  comparing to `NULL` directly.
- **Permission-denial tests assert on Postgres SQLSTATE `42501`** (`insufficient_privilege`)
  via the driver error's `.cause.code`, not on message text — Postgres phrases ownership
  violations ("must be owner of table ...") differently from missing-grant violations
  ("permission denied for table ..."), but both carry the same SQLSTATE.

### Isolation test names (`packages/db`, `src/__tests__/`)

- `tenant-isolation.test.ts`
  - returns 0 rows when no tenant context is set
  - sees only its own tenant, shops, members and audit logs under tenant A's context
  - rejects inserting a shop stamped with tenant B's id under tenant A's context
  - affects 0 rows updating tenant B's shop under tenant A's context
  - affects 0 rows deleting tenant B's shop under tenant A's context
  - never leaks rows across 20+ concurrent withTenant calls for two tenants
- `pooled-connection.test.ts`
  - resets to unset between transactions on the same connection (asserts same `pg_backend_pid()` throughout)
- `grants.test.ts`
  - cannot ALTER TABLE / cannot DISABLE ROW LEVEL SECURITY / cannot UPDATE audit_logs / cannot DELETE from audit_logs
  - can INSERT and SELECT on audit_logs (append-only, not locked out)
  - is not the owner of any table
- `id.test.ts` — UUIDv7 format, uniqueness, monotonic ordering

### Check results

- `pnpm lint` → **9/9 packages pass**
- `pnpm typecheck` → **9/9 pass**
- `pnpm test` → **9/9 suites pass, 29/29 tests pass** (13 from Stage 0 + 16 new: 6 isolation + 1
  pooled-connection + 6 grants + 3 id)
- `pnpm build` → **pass**
- `pnpm test:e2e` → **2/2 pass**

### Deviations

- Added `DATABASE_MIGRATION_URL` **and** `DATABASE_MIGRATION_URL_TEST` (the spec only
  mentioned `DATABASE_MIGRATION_URL`) — the test suite needs an owner-role connection to the
  _test_ database for `withSystem()`/migrations/reset, exactly parallel to the existing
  `DATABASE_URL`/`DATABASE_URL_TEST` pair.
- `db:reset` refuses to run against any host other than `localhost`/`127.0.0.1` (reads the
  target URL's hostname) rather than branching on a "dev vs test" flag — simpler, and it's the
  actual safety property the requirement cares about.
- Local dev's Postgres container had to be recreated (`docker compose down -v`) for the new
  init script to run, since `docker-entrypoint-initdb.d` only runs against a fresh data
  volume. The Stage 0.1 volume only ever held an empty dev database, so this was safe.

### Known issues / TODOs

- `drizzle-kit migrate`'s CLI swallows errors silently (spinner UI exits with code 1 and no
  message) — worth remembering if a future migration fails for a different reason; reproduce
  with a raw `psql`/`postgres.js` call against the same URL to see the real error.
- No tests yet exercise `packages/db` from `apps/web` — that wiring is Stage-later scope, not
  Stage 1 (the web app's health endpoint still doesn't touch the database).
- CI's Postgres service container runs on port 5432 inside the isolated runner (no conflict
  there); the local port-5433 workaround from Stage 0.1 only applies to this developer's
  machine.
