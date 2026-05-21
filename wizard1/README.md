# Wizard 1 — V2 Resort `.exe` Installation Wizard

> **Electron-based Windows installer** that gets V2 Resort running on your server with one guided session.

## What it does

| Step | Action |
|------|--------|
| 1 | Welcome — sets install directory |
| 2 | Docker check — detects / prompts to install Docker Desktop |
| 3 | Supabase — collects URL, anon key, service key, DB connection string |
| 4 | Security keys — auto-generates 512-bit JWT secrets |
| 5 | Stripe — optional payment keys |
| 6 | SMTP — optional email credentials |
| 7 | Domain & DNS — detects server IP, shows exact DNS A-record to create, configures Nginx + Let's Encrypt |
| 8 | Review & Install — writes all `.env` files, runs `docker compose up`, runs migrations, opens browser to `/install` |

---

## Build the `.exe`

### Prerequisites
- Node.js 18+
- Windows machine (for `.exe` output) or Wine (for cross-compile)

### Steps

```bash
# 1. From the repo root — install wizard dependencies
cd wizard1
npm install

# 2. Start in dev mode (Electron window, no build)
npm start

# 3. Build the installer .exe
npm run build
# Output → wizard1/dist/V2 Resort Installer Setup 1.0.0.exe
```

### Output
`dist/V2 Resort Installer Setup 1.0.0.exe` — a standalone NSIS installer that:
- Requires administrator privileges (set in manifest)
- Bundles all Node.js runtime via Electron
- Copies V2 source files as extra resources
- Creates a Start Menu shortcut

---

## Architecture

```
wizard1/
├── package.json              ← Electron + electron-builder config
├── src/
│   ├── main.js               ← Electron main process (IPC handlers, system ops)
│   ├── preload.js            ← Secure contextBridge API
│   └── renderer/
│       ├── index.html        ← Shell with custom titlebar + sidebar
│       ├── style.css         ← Dark UI design system
│       └── wizard.js         ← All 8 step renderers + deploy logic
└── assets/
    └── icon.ico              ← App icon (add your own)
```

### IPC API surface (preload → main)

| Method | Description |
|--------|-------------|
| `checkDocker()` | Detects Docker install + running state |
| `openDockerInstallPage()` | Opens Docker Desktop download in browser |
| `startDockerDesktop()` | Attempts to launch Docker Desktop process |
| `waitForDockerReady()` | Polls `docker info` until ready (5-min timeout) |
| `getServerIP()` | Returns public + local IP |
| `generateSecrets()` | Returns two 512-bit hex JWT secrets |
| `writeEnvFiles({ config, installDir })` | Writes `/.env`, `/backend/.env`, `/nginx/nginx.conf`, `/docker-compose.production.yml` |
| `startDeploy({ installDir })` | Runs `docker compose -f docker-compose.production.yml up -d --build` |
| `runMigrations({ installDir })` | Exec migrations inside running backend container |
| `waitForHealth({ port })` | TCP-polls port until open (5-min timeout) |
| `openBrowser({ url })` | Opens URL in default browser |
| `onDeployLog(cb)` | Streams deploy log lines to renderer |

---

## Generated files

After the wizard runs, these files are written to `installDir` (default `C:\V2Resort`):

```
C:\V2Resort\
├── .env                         ← Root environment (Supabase, JWT, Stripe, SMTP)
├── backend\
│   └── .env                     ← Backend-specific environment
├── nginx\
│   └── nginx.conf               ← Nginx config with SSL (if domain set)
└── docker-compose.production.yml ← Production compose with certbot if domain set
```

---

## What the owner must still do manually

1. **Create a Supabase project** (~5 min) at [supabase.com](https://supabase.com)
2. **Create a Stripe account** if payments are needed
3. **Buy a domain** and set one **A record** pointing to the server's public IP
4. **Wait for DNS propagation** (minutes to 48 hours depending on provider)

Everything else — Docker, SSL, database, containers — is handled by the wizard.

---

## After Wizard 1 completes → Wizard 2

The wizard opens `https://your-domain.com/install` (or `http://localhost:3000/install`). That's **Wizard 2** — the web-based install that creates the owner account, seeds roles, and configures the resort. See `/frontend/src/app/install/` in the main repo.
