# Lin Open Factory Ui

## 🚀 Overview

**Lin Open Factory Ui** is an open-source, configurable web user interface, part of the LinID ecosystem.

It provides:

* A host application built with Quasar / Vue and Module Federation
* A UI server (BFF) handling the OIDC authentication and proxying the calls to the LinID API

By default, the UI only contains the home page: the project that uses it (e.g. LinID Identity Manager) adds its own
pages and tabs through configuration (modules, design files, translations).

The image ships a minimal `config.json` (home page only), used when no configuration is given. To add pages, mount
your own `config.json` at `/app/spa/config.json`, with the files it references (`/app/spa/modules`,
`/app/spa/design`, `/app/spa/i18n`).

> The **SSO** (LemonLDAP::NG) and the **LinID API** are not part of this project: they are provided and configured by
> the project that uses this UI.

## 🧪 Project Status

🚧  This project is currently **under active development**.

Features and APIs may evolve.

---

## ⚡ Quick Start

Lin Open Factory Ui provides a **Taskfile** to simplify running the E2E environment, which starts the UI, its SSO
(LemonLDAP::NG) and a fake of the LinID API in Docker.
All you need is **Docker** and **Task** installed on your machine.

---

### 1️⃣ Prerequisites

* **Docker 24+** and **Docker Compose 2+**
* **Task** ([https://taskfile.dev/#/installation](https://taskfile.dev/#/installation))

> ⚠️ Make sure Docker is running before executing any tasks.

---

### 2️⃣ Install Lin Open Factory Ui Repository

```bash
git clone https://github.com/linagora/lin-open-factory-ui.git
cd lin-open-factory-ui
git submodule update --init --recursive
```

---

### 3️⃣ Run the Application

1. Use the provided **Taskfile** to start the E2E environment:

```bash
task setup:e2e
task start:e2e
```

2. The task will automatically:

* Generate the certificates, the OIDC keys and the configuration files
* Build the `ui` image and the image of the fake LinID API
* Start the UI, its SSO, the fake LinID API and the Module Federation remote

👉 Access the application: https://linid.localtest.me:9000 (`admin` / `password`)

---

### 📝 Notes

* The E2E environment is intended for **E2E tests and quick testing only**, see its README
  (`docker/e2e/README.md`)
* For local development (`pnpm dev`), see [docs/installation/setup](docs/installation/setup.md#-local-development)

---

## 🧪 Tests

* **Unit tests**: `pnpm test`
* **E2E tests**: `task start:test` (local, Cypress) or `task start:test:ci` (Docker), the E2E environment starting its
  own SSO (LemonLDAP::NG) and a fake of the LinID API

---

## 📚 Documentation

Full documentation is available in the [/docs](docs/index.md) directory.

It includes:

* Installation instructions
* Certificates
* UI configuration (UI server, theming, translations)
* UI server and authentication (BFF)

---

## 🔐 Authentication

Lin Open Factory Ui supports **OIDC-based authentication**, handled by its UI server.

### Supported Providers

* LemonLDAP

### Certificates

Authentication requires certificate configuration.

> See: [docs/configuration/certificates](docs/configuration/certificates.md)

---

### 🎨 UI Configuration

* Theme customization
* Branding
* Externalized translations (i18n)

> See: [docs/configuration/ui/](docs/configuration/ui/theming.md)

---

## 🧱 Tech Stack

* **Frontend**: Quasar / Vue / Module Federation
* **UI server**: Node.js / Fastify

---

## 📜 License

This project is licensed under the:

**GNU Affero General Public License (AGPL)**

---

## 🆘 Support

For questions, issues, or feature requests:

👉 Use **GitHub Issues**
