# Environment: Development

This environment starts the SSO of the development environment in Docker: LemonLDAP::NG and its PostgreSQL
database. The UI server (BFF) runs on the host with `task start:dev`, and the frontend with `pnpm dev`.

## Quick Start

Generate the certificates, the OIDC keys and the LemonLDAP::NG configuration, then start the SSO and the UI server
with the following commands.

```bash
task setup:dev
task start:dev
pnpm dev
```

`task setup:dev` is only needed once: it creates the local CA in `docker/certs/` and the shared `server.crt` used by
LemonLDAP::NG and the Quasar dev server. Trust `docker/certs/ca.crt` once in your browser to stop the certificate
warnings (see [certificates](../../docs/configuration/certificates.md)).

Stop everything with `task stop:dev`.

The test accounts are `admin` / `password` and `user1` / `password` (see `../init-db/init_db.sql`).

The OIDC client of the UI server (`lin-open-factory-client`) is declared with `https://localhost:9000` as public URL.
Its secret (`OIDC_CLIENT_SECRET` in `env/dev.env`) must match the one of `server/server-config.json`.

The database of the UI server and its two users (the admin applying the migrations, the user of the server) are
created with the `UI_DATABASE_*` variables of `env/db.env` (see `../init-db/init_ui_db.sh`). They, and `DB_PORT` of
`env/dev.env`, must match `session.database` and `session.migrations.database` of `server/server-config.json`.

The LinID API (`https://localhost:8443`) and the Module Federation remote (`http://localhost:5001`) are not started
by this environment.

## Services

| Service | URL                    | Description                  |
| ------- | ---------------------- | ---------------------------- |
| auth    | https://localhost:8080 | SSO (LemonLDAP::NG)          |
| db      | localhost:5432 (`DB_PORT` of `env/dev.env`) | PostgreSQL of LemonLDAP::NG and of the UI server sessions |
