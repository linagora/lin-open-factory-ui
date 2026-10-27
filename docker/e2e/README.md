# Environment: E2E

This environment is intended for end-to-end (E2E) testing.
All services are containerized with ports exposed for debugging and test access.

## Quick Start

Generate certificates, OIDC keys, LemonLDAP::NG and frontend configuration files, build the `ui` and `fake-api`
images and start everything with the following commands.

```bash
task setup:e2e
task start:e2e
```

The `catalog-ui` image is pulled from Docker Hub (`linagora/lin-pulsar:v0.3.0`), its version is pinned in `docker-compose.yml`.

The SSO is LemonLDAP::NG, with its PostgreSQL database holding the test accounts (`admin` / `password`, `user1` /
`password`, see `../init-db/init_db.sql`).

The LinID API is not part of this project: it is replaced by a fake (`fake-api`, built with Fastify), which answers an empty object to any request: the frontend without any module only
needs its calls to succeed (user preferences, backend translations). The user preferences are not stored, the
selected language being also kept in the local storage of the browser. The access token is not checked.

## Services

| Service         | URL                                  | Description                                  |
| --------------- | ------------------------------------ | -------------------------------------------- |
| ui              | https://linid.localtest.me:9000      | Lin Open Factory Ui                        |
| auth            | https://linid.localtest.me:9000/auth | SSO (LemonLDAP::NG), served by the UI server |
| db              | (internal network)                   | PostgreSQL of LemonLDAP::NG                  |
| api             | (internal network)                   | Fake of the LinID API                        |
| catalog-ui      | (internal network)                   | UI components library                        |
| e2e-test-runner | (internal network)                   | Runner to execute e2e tests                  |
