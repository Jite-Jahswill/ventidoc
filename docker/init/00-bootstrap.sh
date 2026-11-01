#!/bin/sh
set -e

# Bootstraps the two database roles used by the app (see docs/PROGRESS.md
# "Stage 1" and the "Multi-tenancy & data isolation" section of
# docs/BLUEPRINT.md) and the separate test database.
#
# Runs two ways:
#   - locally, automatically, via docker-entrypoint-initdb.d (this whole
#     directory is mounted read-only by docker-compose.yml) against a fresh
#     Postgres data volume;
#   - in CI, as an explicit step after the Postgres service container is
#     healthy, since GitHub Actions service containers can't run
#     docker-entrypoint-initdb.d scripts (they start before checkout).
#
# Either way it needs POSTGRES_USER (a superuser) and POSTGRES_DB on the
# environment, and connects via psql's own PGHOST/PGPORT/PGPASSWORD env vars.

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${VENTIDOC_OWNER_PASSWORD:=ventidoc_owner}"
: "${VENTIDOC_APP_PASSWORD:=ventidoc_app}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE ventidoc_owner WITH LOGIN PASSWORD '$VENTIDOC_OWNER_PASSWORD' BYPASSRLS;
    CREATE ROLE ventidoc_app WITH LOGIN PASSWORD '$VENTIDOC_APP_PASSWORD' NOBYPASSRLS;

    CREATE DATABASE ventidoc_test;
EOSQL

# Postgres 15+ no longer grants CREATE on the public schema to everyone, and
# the bootstrap superuser owns the schema (and the database) by default. Hand
# both to ventidoc_owner: schema ownership so migrations can create tables
# that it owns, and database ownership so drizzle-kit's migrator can create
# its own "drizzle" schema for migration tracking. Let ventidoc_app use the
# public schema (table-level grants happen per-migration, once tables
# exist). Do this in both the dev and test databases.
for db in "$POSTGRES_DB" ventidoc_test; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
      ALTER DATABASE "$db" OWNER TO ventidoc_owner;
EOSQL
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
      ALTER SCHEMA public OWNER TO ventidoc_owner;
      GRANT USAGE ON SCHEMA public TO ventidoc_app;
EOSQL
done
