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
nvm use                 # Node 20
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
