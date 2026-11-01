# Ventidoc

Multi-tenant inventory & business-operations SaaS. See `docs/BLUEPRINT.md` for the full
product and technical blueprint, and `docs/PROGRESS.md` for what's been built stage by stage.

## Stack

- pnpm workspaces + Turborepo monorepo, Node 24 LTS, TypeScript strict mode.
- `apps/web`: Next.js (App Router) + Tailwind CSS.
- `packages/*`: shared `db`, `core`, `auth`, `permissions`, `validation`, `emails`, `ui` and
  `config` packages.
- Postgres (Drizzle ORM, Row-Level Security) + Mailpit for local development, via Docker
  Compose.
- ESLint, Prettier, Vitest, Playwright, GitHub Actions CI.

## Prerequisites

- Node 24 (`nvm use` picks it up from `.nvmrc`)
- pnpm, via Corepack: `corepack enable`
- Docker (for local Postgres + Mailpit)

## Setup

```bash
git clone <this-repo>
cd ventidoc

nvm use
corepack enable
pnpm install

cp .env.example .env
```

`.env` defaults already match `docker-compose.yml`: a `ventidoc_app` role (no DDL rights, used
by the app at runtime) and a `ventidoc_owner` role (owns every table, used only for migrations
and seeds), a `ventidoc` database plus a separate `ventidoc_test` one, Postgres on port 5433
(5432 is a common default for an already-running local Postgres, so this avoids colliding with
it) and Mailpit on port 1025. Edit `.env` if you're pointing at something else.

## Running the app

```bash
pnpm db:up        # starts Postgres (:5433) and Mailpit (SMTP :1025, UI http://localhost:8025)
pnpm db:migrate   # applies every migration (tables, then Row-Level Security + grants)
pnpm db:seed      # optional: 2 sample tenants, each with 2 shops and 2 members
pnpm dev          # starts the Next.js app at http://localhost:3000
```

`GET http://localhost:3000/api/v1/health` returns `{ "status": "ok", "version": "..." }`.

Stop the local services when you're done:

```bash
pnpm db:down
```

## Database

```bash
pnpm db:generate   # diff packages/db/src/schema.ts into a new migration file
pnpm db:migrate    # apply every migration against DATABASE_MIGRATION_URL
pnpm db:seed       # seed 2 tenants / 4 shops / 4 users into the dev database
pnpm db:reset      # dev/test only: drop and recreate the schema, then re-migrate from scratch
```

`packages/db`'s public API is `withTenant(tenantId, fn)` (opens a transaction as the
`ventidoc_app` role with Row-Level Security scoped to that tenant) and `withSystem(fn)` (opens
a transaction as the `ventidoc_owner` role, which bypasses RLS — seeds/migrations/tests only,
never request-handling code).

## Running the tests

```bash
pnpm lint          # ESLint across every workspace package
pnpm typecheck     # tsc --noEmit across every workspace package
pnpm test          # Vitest unit tests across every workspace package (needs `pnpm db:up` for packages/db)
pnpm build         # next build
pnpm test:e2e      # builds the app, then runs Playwright against it
```

`pnpm test:e2e` needs Playwright's browser binaries installed once:

```bash
pnpm --filter web exec playwright install chromium
```

## Formatting

```bash
pnpm format         # writes
pnpm format:check   # checks only, used in CI indirectly via lint
```

## Project structure

```
ventidoc/
  apps/
    web/            # Next.js: marketing site, dashboard, admin, /api/v1
  packages/
    db/             # Drizzle schema, migrations, RLS policies, seed data
    core/           # shared business logic services (Stage 7+)
    auth/           # auth config, session + token helpers (Stage 3+)
    permissions/    # permission list, roles, can() checks (Stage 4+)
    validation/     # Zod schemas -> OpenAPI spec (Stage 4+)
    emails/         # React Email templates (Stage 2+)
    ui/             # shared web components and theme tokens
    config/         # shared tsconfig/eslint config, env validation (Zod)
  docs/             # blueprint, progress log
  .github/workflows # CI: lint, typecheck, tests, build, e2e
```
