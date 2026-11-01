# Ventidoc

Multi-tenant inventory & business-operations SaaS. See `docs/BLUEPRINT.md` for the full
product and technical blueprint, and `docs/PROGRESS.md` for what's been built stage by stage.

## Stack

- pnpm workspaces + Turborepo monorepo, Node 20 LTS, TypeScript strict mode.
- `apps/web`: Next.js (App Router) + Tailwind CSS.
- `packages/*`: shared `db`, `core`, `auth`, `permissions`, `validation`, `emails`, `ui` and
  `config` packages.
- Postgres + Mailpit for local development, via Docker Compose.
- ESLint, Prettier, Vitest, Playwright, GitHub Actions CI.

## Prerequisites

- Node 20 (`nvm use` picks it up from `.nvmrc`)
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

`.env` defaults already match `docker-compose.yml` (user/password `ventidoc`, database
`ventidoc`, a separate `ventidoc_test` database, Mailpit on port 1025). Edit it if you're
pointing at something else.

## Running the app

```bash
pnpm db:up     # starts Postgres (:5432) and Mailpit (SMTP :1025, UI http://localhost:8025)
pnpm dev       # starts the Next.js app at http://localhost:3000
```

`GET http://localhost:3000/api/v1/health` returns `{ "status": "ok", "version": "..." }`.

Stop the local services when you're done:

```bash
pnpm db:down
```

## Running the tests

```bash
pnpm lint          # ESLint across every workspace package
pnpm typecheck     # tsc --noEmit across every workspace package
pnpm test          # Vitest unit tests across every workspace package
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
    db/             # Drizzle schema, migrations, RLS policies, seed data (Stage 1+)
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
