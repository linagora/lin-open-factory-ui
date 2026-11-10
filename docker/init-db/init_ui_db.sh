#!/bin/sh
# ============================================================================
# UI server database
# ============================================================================
# Database of the UI server (BFF), which stores the user sessions, and its two users (env/db.env):
# - UI_DATABASE_ADMIN_USER owns the database and applies the migrations at startup (server/migrations);
# - UI_DATABASE_USER, used by the server to run, only reads and writes the data of the tables created by the admin.
# In production, passwords should be managed through secrets.
# ============================================================================

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v name="$UI_DATABASE_NAME" \
  -v admin_user="$UI_DATABASE_ADMIN_USER" -v admin_password="$UI_DATABASE_ADMIN_PASSWORD" \
  -v user="$UI_DATABASE_USER" -v password="$UI_DATABASE_PASSWORD" <<'EOSQL'
CREATE ROLE :"admin_user" WITH LOGIN PASSWORD :'admin_password';
CREATE ROLE :"user" WITH LOGIN PASSWORD :'password';
CREATE DATABASE :"name" OWNER :"admin_user";

\connect :"name"

GRANT USAGE ON SCHEMA public TO :"user";
-- Applies to the tables and sequences that the migrations will create
ALTER DEFAULT PRIVILEGES FOR ROLE :"admin_user" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"admin_user" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO :"user";
EOSQL
