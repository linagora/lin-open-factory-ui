# 🗄️ Database migrations

The schema of the UI server database (the user sessions) is managed with
[node-pg-migrate](https://salsita.github.io/node-pg-migrate/), like Flyway.

## How it works

* The migrations are the SQL files of `server/migrations`, numbered like Flyway (`0001_create-sessions.sql`,
  `0002_...`) and applied in the order of their number.
* At startup, the server applies the migrations not applied yet, then starts listening. If a migration fails, the
  server does not start.
* They run with the admin user of `session.migrations.database`, owner of the database. The server then runs with the
  user of `session.database`, which can only read and write data.
* The applied migrations are recorded in the `pgmigrations` table (`session.migrations.table`).
* An advisory lock makes the instances starting at the same time apply them once: the others wait.

## Adding a migration

```bash
cd server
pnpm migration:create add-something
```

This creates `migrations/<next number>_add-something.sql`, e.g. `0002_add-something.sql`. Write the SQL under `-- Up Migration`, and the SQL undoing it
under `-- Down Migration`:

```sql
-- Up Migration
ALTER TABLE sessions ADD COLUMN user_id VARCHAR(255);

-- Down Migration
ALTER TABLE sessions DROP COLUMN user_id;
```

Each migration runs in a transaction. **Never change or rename a migration already applied**: add a new one instead.
If two branches create the same number, renumber the one merged last before it is deployed.

## Rolling back

The server only applies migrations. To undo the last one, run the CLI of node-pg-migrate with the URL of the database and
the admin user:

```bash
cd server
DATABASE_URL=postgres://lin_open_factory_admin:password@localhost:5432/lin_open_factory \
  pnpm exec node-pg-migrate down --migrations-dir migrations --migrations-table pgmigrations
```
