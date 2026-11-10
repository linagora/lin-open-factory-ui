# UI Server Configuration (`server-config.json`)

## 🎯 Purpose

`server-config.json` configures the **UI server** (`server`).

---

## 📍 Location

| Environment   | File                                                                                         |
|---------------|----------------------------------------------------------------------------------------------|
| Development   | `server/server-config.json`                                                               |
| E2E           | Generated from `docker/e2e/resources/server-config.template.json` by `task setup:config`     |

* The path can be changed with `SERVER_CONFIG_PATH`.
* The file is read at startup: **restart the server** after a change.
* `__APP_ENV__` is replaced by the `APP_ENV` environment variable.

---

## 📄 Example

```json
{
  "environment": "__APP_ENV__",
  "http": {
    "port": 443,
    "trustProxy": false,
    "tls": { "cert": "/etc/server/certs/server.crt", "key": "/etc/server/certs/server.key" }
  },
  "oidc": {
    "oauth2": {
      "credentials": {
        "client": { "id": "lin-open-factory-client", "secret": "lin-open-factory-secret" },
        "options": { "authorizationMethod": "body" },
        "http": { "headers": { "host": "linid.localtest.me" } }
      },
      "discovery": { "issuer": "http://auth" },
      "scope": "openid email profile roles",
      "callbackUri": "https://linid.localtest.me:9000/auth/callback",
      "pkce": "S256",
      "cookie": { "httpOnly": true, "sameSite": "lax", "secure": true }
    },
    "logoutUrl": "https://linid.localtest.me:9000/auth/oauth2/logout",
    "postLogoutRedirectUri": "https://linid.localtest.me:9000/auth/logged-out",
    "refreshMarginMilliseconds": 30000
  },
  "session": {
    "secret": "e2e-only-session-secret-do-not-use-in-production",
    "cookieName": "lin-open-factory",
    "maxAgeMilliseconds": 28800000,
    "database": {
      "host": "db",
      "port": 5432,
      "database": "lin_open_factory",
      "user": "lin_open_factory_user",
      "password": "password",
      "ssl": false,
      "max": 10,
      "connectionTimeoutMillis": 5000,
      "idleTimeoutMillis": 10000
    },
    "migrations": {
      "table": "pgmigrations",
      "database": { "user": "lin_open_factory_admin", "password": "password" }
    }
  },
  "proxies": [
    { "prefix": "/backend", "upstream": "https://linid.localtest.me:8443", "withAccessToken": true },
    { "prefix": "/lin-pulsar", "upstream": "http://lin-pulsar" },
    { "prefix": "/auth/me", "upstream": "http://auth", "rewritePrefix": "/oauth2/userinfo", "withAccessToken": true },
    { "prefix": "/auth", "upstream": "http://auth" },
    { "prefix": "/static", "upstream": "http://auth", "keepPrefix": true },
    { "prefix": "/index.psgi", "upstream": "http://auth", "keepPrefix": true }
  ],
  "staticDir": "/app/spa",
  "configJsonPath": "/app/spa/config.json",
  "cache": {
    "html": "no-cache, no-store, must-revalidate",
    "assets": "public, max-age=604800, immutable"
  }
}
```

---

## ⚙️ Parameters

### General

| Parameter               | Description                                                    |
|-------------------------|----------------------------------------------------------------|
| `environment`           | Environment name, injected in the SPA `/config.json`           |
| `http.port`             | Listening port                                                 |
| `http.tls`              | Optional. `cert` and `key` paths (PEM) to listen in HTTPS      |
| `http.trustProxy`       | Optional, `false` by default. See below                        |
| `staticDir`             | Directory of the built SPA                                     |
| `configJsonPath`        | SPA configuration served at `/config.json`                     |
| `cache.html`            | `Cache-Control` of `index.html` and `/config.json`             |
| `cache.assets`          | `Cache-Control` of the files under `/assets/`                  |
| `contentSecurityPolicy` | Optional. `Content-Security-Policy` of `index.html`. See below |
| `userContentPrefix`     | Optional, none by default. See below                           |

### `http.trustProxy`

Option `trustProxy` of Fastify, passed as is. Set it when the server is behind a reverse proxy that terminates TLS:
the server then receives HTTP, and without it, the session cookie (`secure` by default) is never sent.

| Value                         | Trusted proxies                                                  |
|-------------------------------|------------------------------------------------------------------|
| `false`                       | None: the server is reached directly                             |
| `true`                        | Any client: only if the server cannot be reached without a proxy |
| `"10.0.0.1"`, `"10.0.0.0/8"`  | The proxies with these addresses (string or array)               |

Prefer the addresses of the proxy to `true`.

### `contentSecurityPolicy`

Value of the `Content-Security-Policy` header, sent as is with `index.html`, so for every page of the SPA.

The responses of the `proxies` are not changed: each service keeps its own policy, like the login page of the SSO.

```json
"contentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-eval'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
```

* `script-src` must allow `'unsafe-eval'`: Nunjucks compiles the templates of the SPA in the browser, and cannot render
  them without it.
* A remote served from another origin must be allowed in `connect-src` (its manifest), `script-src`, `style-src`,
  `font-src` (if it loads fonts) and `img-src` (if it loads images). Keep `'self'` in each of them: a directive
  replaces `default-src`, so with only the origin of the remote, the SPA can no longer load `/config.json`,
  `/auth/me`, `/backend/*`, its CSS or its fonts.
* The `SupersetWidgetCard` of LinPulsar displays its dashboard in an iframe: its `supersetDomain` must be allowed in
  `frame-src`.

The E2E configuration uses this value, set with the `CONTENT_SECURITY_POLICY` variable.

Adapt this example to the deployment, and check the browser console for blocked resources before using it in production.

### `userContentPrefix`

URL prefix of the files of `staticDir` provided by the users of the application (e.g. avatars). It starts and ends
with `/`:

```json
"userContentPrefix": "/avatars/"
```

The files under this prefix are served with:

* `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff`: a file carrying a
  script, such as an SVG, cannot run anything when its URL is opened
* `Cache-Control: no-cache`: a file replaced by the user is reloaded

A missing file answers `404`, instead of `index.html` for the other paths.

The application mounts the directory of these files in `staticDir` (e.g. `/app/spa/avatars` in the Docker image).

### `oidc`

| Parameter                   | Default   | Description                                                                       |
|-----------------------------|-----------|-----------------------------------------------------------------------------------|
| `oauth2`                    | —         | Options of `@fastify/oauth2`, see below                                           |
| `logoutUrl`                 | —         | URL of the logout endpoint of the SSO (`end_session_endpoint`)                    |
| `postLogoutRedirectUri`     | —         | Where the SSO sends the user back after the logout: `{publicUrl}/auth/logged-out` |
| `refreshMarginMilliseconds` | `30000`   | Renews the access token this many milliseconds before it expires                  |

### `oidc.oauth2`

Options of `@fastify/oauth2` (type `FastifyOAuth2Options`), passed as is to the plugin, except `name` set by the server.
All the options are described in the [documentation of `@fastify/oauth2`](https://github.com/fastify/fastify-oauth2#readme).
The main ones:

| Parameter                                   | Description                                                                                        |
|---------------------------------------------|----------------------------------------------------------------------------------------------------|
| `credentials.client.id`                     | Client identifier declared in the SSO                                                              |
| `credentials.client.secret`                 | Client secret declared in the SSO, omitted for a public client                                     |
| `discovery.issuer`                          | URL of the SSO: the endpoints are read from `{issuer}/.well-known/openid-configuration` at startup |
| `credentials.options.authorizationMethod`   | `body` for a public client (no secret) or `client_secret_post`, `header` for `client_secret_basic` |
| `scope`                                     | Requested scopes: array, or string separated by spaces (`openid` is required)                      |
| `callbackUri`                               | `{publicUrl}/auth/callback`, declared as redirect URI in the SSO                                   |
| `pkce`                                      | `S256`                                                                                             |
| `cookie`                                    | Options of the `state`, PKCE verifier and `returnTo` cookies: `httpOnly`, `sameSite`, `secure`     |

`{publicUrl}` is the public URL of the application, without trailing slash (e.g. `https://linid.localtest.me:9000`).

The discovery runs once, when the server starts: the server does not start if the SSO cannot be reached. It only gives
the authorization and token endpoints, `logoutUrl` and the userinfo path of `/auth/me` are still configured.

When the SSO is served by the UI server itself (e.g. LemonLDAP::NG under `/auth`), its public URL cannot
be reached while the server starts. The discovery then uses its internal URL, with the `Host` of its portal, sent with
every request to the SSO:

```json
"credentials": {
  "client": { "id": "lin-open-factory-client", "secret": "lin-open-factory-secret" },
  "options": { "authorizationMethod": "body" },
  "http": { "headers": { "host": "linid.localtest.me" } }
},
"discovery": { "issuer": "http://auth" }
```

Without discovery, the endpoints can be given with `credentials.auth` (`tokenHost`, `tokenPath`, `authorizePath`), see
the [documentation of `@fastify/oauth2`](https://github.com/fastify/fastify-oauth2#readme).

### `session`

| Parameter            | Default | Description                                                  |
|----------------------|---------|--------------------------------------------------------------|
| `secret`             | —       | Signs the session cookie. **At least 32 characters**         |
| `cookieName`         | —       | Name of the session cookie                                   |
| `maxAgeMilliseconds` | —       | Lifetime of the session cookie from the login, in ms         |
| `database`           | —       | Options of the `pg` pool, see below                          |
| `migrations`         | —       | Database migrations, see below                               |
| `secure`             | `true`  | Cookie sent over HTTPS only. Set `false` only for plain HTTP |
| `sameSite`           | `lax`   | `lax` (recommended), `strict` or `none`                      |

### `session.database`

The sessions are stored in the `sessions` table of a PostgreSQL database, through a `pg.Pool` created with these
options (see the documentation of `pg`), as is. For example:

| Parameter                 | Default | Description                                                                         |
|---------------------------|---------|-------------------------------------------------------------------------------------|
| `host`, `port`            | —       | Address of the database                                                             |
| `database`                | —       | Name of the database                                                                |
| `user`, `password`        | —       | Credentials of the UI server                                                        |
| `connectionString`        | —       | Instead of the parameters above, e.g. `postgres://user:password@host:5432/database` |
| `ssl`                     | `false` | `true`, or the options of `tls.connect` (e.g. `{"rejectUnauthorized": false}`)      |
| `max`                     | `10`    | Maximum number of connections                                                       |
| `connectionTimeoutMillis` | `5000`  | A request fails when no connection is available after this delay, instead of hanging |
| `idleTimeoutMillis`       | `10000` | An unused connection is closed after this delay                                     |

The user of `database` only needs to read and write the data of the tables (`SELECT`, `INSERT`, `UPDATE`, `DELETE`):
the tables are created by the migrations, with the user of `session.migrations.database`. A session expires with its
cookie (`maxAgeMilliseconds`): the expired sessions are never read, and are deleted at each login.

### `session.migrations`

The schema is created at startup by the migrations of `server/migrations`, see
[database migrations](../../advanced/database-migrations.md).

| Parameter  | Default        | Description                                                                                       |
|------------|----------------|---------------------------------------------------------------------------------------------------|
| `table`    | `pgmigrations` | Table recording the applied migrations                                                            |
| `database` | —              | Options of the connection applying the migrations, merged over `session.database`: e.g. `user` and `password` of the owner of the database. Without it, the user of `session.database`, which then needs the right to create tables |

In the Docker environments, `docker/init-db/init_ui_db.sh` creates the two users: the admin owns the database, and
the user of the server gets the data rights on the tables that the admin creates (`ALTER DEFAULT PRIVILEGES`).

### `proxies`

| Parameter           | Default   | Description                                               |
|---------------------|-----------|-----------------------------------------------------------|
| `prefix`            | —         | Public URL prefix                                         |
| `upstream`          | —         | Base URL of the proxied service                           |
| `keepPrefix`        | `false`   | Keeps the prefix in the upstream path                     |
| `rewritePrefix`     | —         | Replaces the prefix with this path in the upstream path   |
| `withAccessToken`   | `false`   | Adds the user's access token, `401` if not logged in      |
