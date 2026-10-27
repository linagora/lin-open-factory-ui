# Certificates Configuration

This guide explains how TLS certificates and OIDC keys are managed in the **development and E2E
environments**.

The UI server uses a **server certificate** signed by a **local certificate authority (CA)**.
Trusting that CA once is enough to access the UI without browser security warnings.

---

## 🔐 1️⃣ Local Certificate Authority

The CA is generated **once** in `docker/certs/` (`ca.crt` and `ca.key`) and reused by all
environments. It is created automatically by the certificate tasks and is **never
regenerated** as long as the files exist, so the trust you grant it in your browser or
operating system survives environment restarts.

```bash
task setup:certs        # dev + e2e
task setup:certs:dev    # dev
task setup:certs:e2e    # e2e
```

To start from scratch, delete `docker/certs/` and run the task again (you will need to
trust the new CA).

The LinID API, and the SSO outside of the E2E environment, are started outside of this project: the UI server must
trust their certificates (`NODE_EXTRA_CA_CERTS`). The simplest way is to share the same CA: copy the
`ca.crt` and `ca.key` of the project that starts them in `docker/certs/` **before** running
the certificate tasks, which then keep it.

---

## 🌐 2️⃣ Server Certificate

Each environment gets a single `server.crt`/`server.key` pair in
`docker/<env>/resources/`, signed by the local CA. Its Subject Alternative Names cover
every hostname used in the platform:

* `linid.localtest.me`
* `localhost`
* `ui` (internal Docker service name)

It is used by the UI server to serve HTTPS.

It is an end-entity certificate (`CA:FALSE`), so it cannot sign other certificates.

---

## ✅ 3️⃣ Trust the CA (one-time setup)

Trust `docker/certs/ca.crt` once and all services are accepted by your browser.

**Linux (system-wide):**

```bash
sudo cp docker/certs/ca.crt /usr/local/share/ca-certificates/linid-dev-ca.crt
sudo update-ca-certificates
```

**macOS:**

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain docker/certs/ca.crt
```

**Firefox** (uses its own trust store): *Settings → Privacy & Security → Certificates →
View Certificates → Authorities → Import*, select `docker/certs/ca.crt` and check
*"Trust this CA to identify websites"*.

**Chrome/Chromium on Linux** reads the system store after a restart; alternatively import
the CA under *Settings → Privacy and security → Security → Manage certificates*.

---

## 🔑 4️⃣ OIDC Keys for LemonLDAP::NG

These RSA keys **sign JWTs** for OIDC authentication in the E2E environment, whose SSO is LemonLDAP::NG. They are
not TLS certificates and are generated per environment alongside the server certificate:

* `oidc.key`: private key
* `oidc.pub`: public key

---

## 📝 Notes

* All generated files are **git-ignored**; never commit certificates or keys
* The CA and certificates are valid for **10 years (3650 days)**
* Server certificates are regenerated on each setup, but this is invisible to the
  browser as long as the CA stays the same
* These certificates are for **development and E2E only** — use certificates from
  a real authority in production, and externalize all passwords
