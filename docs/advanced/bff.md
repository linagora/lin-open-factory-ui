# UI Server (Backend For Frontend)

## 🎯 Purpose

The **UI server** (`server`, [Fastify](https://fastify.dev/)) serves the SPA, proxies the backend services and
handles the **OIDC authentication** with the SSO (LemonLDAP::NG in the provided environments).

It follows the **Backend For Frontend (BFF)** pattern: the tokens stay on the server, the browser only has a session
cookie.

👉 See also: [`server-config.json`](../configuration/ui/server-config.md) ·
[environment variables](../configuration/ui/server-environment.md)

---

## 🏗️ How it works

```text
Browser ── cookie ──► UI server ── OAuth 2 / OIDC ─────► SSO (LemonLDAP::NG)
                          │
                          └── /backend + Bearer token ─► LinID API
```

---

## 🔗 Routes

| Route              | Behavior                                                                                                                                     |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `/auth/login`      | Sets the `returnTo` (`?returnTo=/path`), `state` and PKCE verifier cookies, redirects to the SSO                                             |
| `/auth/callback`   | Checks the `state`, exchanges the code for the tokens, regenerates the session ID, stores the tokens in the session, redirects to `returnTo` |
| `/auth/me`         | Proxy to the SSO userinfo endpoint (`proxies`, `withAccessToken`): the user claims, or `401`                                                 |
| `/auth/logout`     | Destroys the session, clears the cookie and redirects to the SSO logout                                                                      |
| `/auth/logged-out` | Where the SSO sends the user back after the logout: redirects to `/auth/login`                                                               |

Any other `/auth/*` path is proxied to LemonLDAP::NG.

---

## 🔄 Login

1. The SPA calls `/auth/me`. Without a session: `401`, so it redirects to `/auth/login`.
2. `/auth/login` sets the `returnTo`, `state` and PKCE verifier cookies, then redirects to the SSO. No session is
   created before the login succeeds.
3. The user logs in. The SSO redirects to `/auth/callback?code=…&state=…`.
4. The server checks the `state`, exchanges the code for the tokens (server to server), regenerates the session ID
   (against session fixation) and stores the tokens in the new session.
5. The server redirects to `returnTo` if it is a path of the application, or to `/`. `returnTo` is parsed like the
   browsers do (e.g. `/\t/evil.com` is `//evil.com`), so that it cannot lead to another site.

---

## 🔁 API calls

For `/backend` and `/auth/me` (`withAccessToken`), the UI server:

1. refuses with `403` the `POST`, `PUT`, `PATCH` and `DELETE` requests coming from another site (CSRF);
2. renews the access token if it expires soon (`oidc.refreshMarginMilliseconds`);
3. adds `Authorization: Bearer <access token>` and removes the cookie;
4. forwards the request.

During the renewal, the session is locked in the database (`SELECT ... FOR UPDATE`): the requests renewing the same
session at the same time, on any instance of the server, wait, then use the token saved by the first one. The SSO is
called once and a revoked refresh token is never reused.

If the SSO does not send a new refresh token or ID token on renewal (allowed by OAuth 2 and OIDC), the previous ones
are kept. If the renewal fails, the session is destroyed and the server answers `401`: the SPA redirects to the login.

---

## 🍪 Session

* Stored in **PostgreSQL** (`@fastify/session`), in the `sessions` table, configured with `session.database`.
* The sessions survive a restart of the server and are shared by its instances: the server keeps no state in memory.
* The session is only loaded by `/auth` and the proxies: the static files never query the database, and the SPA still
  loads when the database is down.
* The cookie only holds the **session ID**, signed with `session.secret`.
* The cookie is `HttpOnly`, `Secure` and `SameSite=Lax` by default.
* The session holds the tokens (access, refresh, ID). **They are never sent to the browser.**
* The session cookie is **never sent to the upstreams**: it is removed from the proxied requests, the other cookies
  are kept.
* During the login, there is no session yet.

---

## 🔐 Security

* **PKCE** and `state` protect the login.
* The session ID is regenerated after the login.
* A failed login returns `400` `{"message":"Authentication failed"}`. The cause is only logged.
* `SameSite=Lax` blocks the cookie on cross-site `POST`, `PUT`, `PATCH` and `DELETE`.
* On the `withAccessToken` routes, these methods are also refused with `403` when the request comes from another
  site: `Sec-Fetch-Site`, set by the browser, must be `same-origin`.
* `contentSecurityPolicy` sets the `Content-Security-Policy` header of `index.html`, see the
  [server configuration](../configuration/ui/server-config.md#contentsecuritypolicy).
* The files provided by the users (e.g. avatars) are served sandboxed under `userContentPrefix`, see the
  [server configuration](../configuration/ui/server-config.md#usercontentprefix).

---
