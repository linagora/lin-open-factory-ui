# Prerequisites

## 🎯 Purpose

This guide lists all **requirements and prerequisites** before installing or running **Lin Open Factory Ui**.

Ensuring these are met will allow a smooth setup and avoid common issues.

---

## 🧩 System Requirements

* **Operating System**: Linux or macOS (Windows for development is supported via Docker)
* **CPU / Memory**: Minimum 2 cores, 4GB RAM (8GB recommended)
* **Disk Space**: Minimum 10GB free

---

## 💾 Software Requirements

### 1️⃣ SSO and LinID API

* The **SSO** (LemonLDAP::NG) and the **LinID API** are **not part of this project**: they are provided and configured
  by the project that uses this UI. Only the E2E environment starts its own SSO (LemonLDAP::NG)
  and a fake of the LinID API
* The UI server reaches them through its proxies (`AUTH_UPSTREAM` and `API_UPSTREAM`, see
  [server environment variables](../configuration/ui/server-environment.md))
* The SSO must declare the OIDC client of the UI server (`OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`), with
  `{publicUrl}/auth/callback` as redirect URI and `{publicUrl}/auth/logged-out` as post-logout redirect URI

### 2️⃣ Node.js / Frontend

* **Node.js 22** or later (for development and local builds)
* **pnpm 11**

> ⚠️ Required only if you plan to build or customize the frontend locally. Docker images include prebuilt frontend.

### 3️⃣ Docker

* **Docker 24+**
* **Docker Compose 2+**
* Used to run the E2E environment of the UI

### 4️⃣ Task

* **Task** ([https://taskfile.dev/#/installation](https://taskfile.dev/#/installation))
* Used to generate the certificates and configuration files, and to start the environments

---

## 🌐 Network & Access

* Port `9000` (frontend) must be accessible
* The SSO and the LinID API must be reachable by the UI server

---

## 🔐 Certificates

The UI server calls the SSO and the LinID API over HTTPS: it must trust their certificate authority
(`NODE_EXTRA_CA_CERTS`).
See [certificates](../configuration/certificates.md).

---

## 📝 Best Practices

* Start the **SSO** and the **LinID API** before the frontend
* Use **Docker** for an isolated, reproducible environment for E2E tests
* Keep environment variables **secure and versioned** carefully
* Test network access to the SSO and the API before configuring applications

---

## ➡️ Next Steps

* Proceed with **installation**:
  👉 [installation/setup](setup.md)

* Configure the **UI server**:
  👉 [configuration/ui/server-config](../configuration/ui/server-config.md)

* Verify **frontend build requirements** (if needed):
  👉 [configuration/ui/theming](../configuration/ui/theming.md)
