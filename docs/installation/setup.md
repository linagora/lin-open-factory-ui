# Installation & Setup

## 🎯 Purpose

This guide explains how to **install and run Lin Open Factory Ui** in a development or E2E environment.

You can use **Docker** for a quick setup or install the frontend manually. The SSO and the LinID API are not part of
this project: they must be started beside (see [prerequisites](prerequisites.md)).

---

## 🐳 Using Docker (Recommended)

Lin Open Factory Ui provides a **Docker setup** for the E2E environment (`docker/e2e`), whose folder contains a README
with detailed instructions.

1. **Navigate to the environment folder**

```bash id="docker-env"
cd docker/e2e
```

2. **Follow the environment README**

```bash id="docker-readme"
cat README.md
# or open it in your editor
```

> ✅ The README contains the full steps to start the Docker environment, including the frontend and its SSO.

---

## 💻 Local Development

The frontend runs with the Quasar dev server on `https://localhost:9000`, and the UI server (BFF) on
`http://localhost:3000`. The dev server proxies `/backend`, `/auth` and `/catalog-ui` to the UI server.

The UI server reads `server/server-config.json`, which expects:

* the SSO (LemonLDAP::NG) on `https://localhost:8080`, declaring the OIDC client `lin-open-factory-client`
* the LinID API on `https://localhost:8443`
* the Module Federation remote (catalog UI) on `http://localhost:5001`

1. **Generate the dev certificate**, signed by the local CA (see
   [certificates](../configuration/certificates.md))

```bash id="dev-certs"
task setup:dev
```

2. **Install the dependencies**

```bash id="dev-install"
pnpm install
```

3. **Start the UI server**, then the frontend

```bash id="dev-start"
task start:dev
pnpm dev
```

4. **Stop the UI server**

```bash id="dev-stop"
task stop:dev
```

> ℹ️ Without any configuration, the frontend only contains the home page: add your modules, design files and
> translations to `public` to develop new pages.

---

## ⚙️ Post-Installation Checks

* UI server health endpoint: `https://linid.localtest.me:9000/health`
* Frontend loads translations, theming, and plugins correctly

---

## 📝 Best Practices

* Use **Docker** for E2E tests or quick setups
* Keep `.env` files secure and **do not commit secrets**
* Verify **network connectivity** between the UI server, the SSO and the API
* Test frontend after backend is running to ensure translations and theming are applied

---

## ➡️ Next Steps

* Configure the **UI server**:
  👉 [configuration/ui/server-config](../configuration/ui/server-config.md)

* Customize **UI / themes / translations**:
  👉 [configuration/ui/theming](../configuration/ui/theming.md)
  👉 [configuration/ui/translations](../configuration/ui/translations.md)
