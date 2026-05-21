// ============================================================
// V2 Resort — Wizard 1: .exe Installation Wizard
// Electron Main Process
// ============================================================
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, exec, spawn } = require('child_process');
const crypto = require('crypto');
const net = require('net');

let mainWindow;
let installLog = [];

// ─── Window ────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 860,
    minHeight: 640,
    resizable: true,
    frame: false,         // Custom titlebar
    transparent: false,
    backgroundColor: '#0f0f0f',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Prevent navigation away
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── Window controls (custom titlebar) ────────────────────
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:close', () => app.quit());

// ─── System info ──────────────────────────────────────────
ipcMain.handle('system:getServerIP', async () => {
  try {
    // Try to get public IP via a quick socket connection
    const ip = await getPublicIP();
    return { ip, local: getLocalIP() };
  } catch {
    return { ip: null, local: getLocalIP() };
  }
});

ipcMain.handle('system:getLocalIP', () => getLocalIP());

ipcMain.handle('system:generateSecrets', () => ({
  jwtSecret: crypto.randomBytes(64).toString('hex'),
  jwtRefreshSecret: crypto.randomBytes(64).toString('hex'),
}));

// ─── Docker ───────────────────────────────────────────────
ipcMain.handle('docker:check', async () => {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    execSync('docker info', { stdio: 'pipe' });
    return { installed: true, running: true };
  } catch (err) {
    // Installed but not running?
    try {
      execSync('docker --version', { stdio: 'pipe' });
      return { installed: true, running: false };
    } catch {
      return { installed: false, running: false };
    }
  }
});

ipcMain.handle('docker:openInstallPage', () => {
  shell.openExternal('https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe');
  return true;
});

ipcMain.handle('docker:startDesktop', async () => {
  try {
    // Attempt to start Docker Desktop on Windows
    exec('"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"');
    return { started: true };
  } catch {
    return { started: false };
  }
});

ipcMain.handle('docker:waitForReady', async () => {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      try {
        execSync('docker info', { stdio: 'pipe' });
        clearInterval(interval);
        resolve({ ready: true });
      } catch {
        if (attempts >= 60) { // 5 min timeout
          clearInterval(interval);
          resolve({ ready: false });
        }
      }
    }, 5000);
  });
});

// ─── File writing ─────────────────────────────────────────
ipcMain.handle('files:writeEnvFiles', async (event, { config, installDir }) => {
  try {
    const domain = config.domain || 'localhost';
    const protocol = config.domain ? 'https' : 'http';
    const frontendUrl = config.domain ? `https://${domain}` : 'http://localhost:3000';
    const backendUrl = config.domain ? `https://${domain}/api` : 'http://localhost:3001';

    // Root .env
    const rootEnv = buildEnv({
      SUPABASE_URL: config.supabaseUrl,
      SUPABASE_ANON_KEY: config.supabaseAnonKey,
      SUPABASE_SERVICE_KEY: config.supabaseServiceKey,
      DATABASE_URL: config.databaseUrl,
      JWT_SECRET: config.jwtSecret,
      JWT_REFRESH_SECRET: config.jwtRefreshSecret,
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      NODE_ENV: 'production',
      PORT: '3001',
      CORS_ORIGIN: frontendUrl,
      STRIPE_SECRET_KEY: config.stripeSecretKey || '',
      STRIPE_WEBHOOK_SECRET: config.stripeWebhookSecret || '',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: config.stripePublishableKey || '',
      NEXT_PUBLIC_API_URL: backendUrl,
      NEXT_PUBLIC_SOCKET_URL: backendUrl,
      NEXT_PUBLIC_APP_NAME: 'V2 Resort',
      SMTP_HOST: config.smtpHost || '',
      SMTP_PORT: config.smtpPort || '587',
      SMTP_USER: config.smtpUser || '',
      SMTP_PASS: config.smtpPass || '',
      EMAIL_FROM: config.emailFrom || `V2 Resort <noreply@${domain}>`,
    });

    // Backend .env
    const backendEnvFile = buildEnv({
      NODE_ENV: 'production',
      PORT: '3001',
      API_URL: backendUrl,
      FRONTEND_URL: frontendUrl,
      CORS_ORIGINS: frontendUrl,
      CSRF_COOKIE_SAMESITE: config.domain ? 'none' : 'strict',
      DATABASE_URL: config.databaseUrl,
      SUPABASE_URL: config.supabaseUrl,
      SUPABASE_ANON_KEY: config.supabaseAnonKey,
      SUPABASE_SERVICE_KEY: config.supabaseServiceKey,
      JWT_SECRET: config.jwtSecret,
      JWT_REFRESH_SECRET: config.jwtRefreshSecret,
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      STRIPE_SECRET_KEY: config.stripeSecretKey || '',
      STRIPE_WEBHOOK_SECRET: config.stripeWebhookSecret || '',
      SMTP_HOST: config.smtpHost || '',
      SMTP_PORT: config.smtpPort || '587',
      SMTP_USER: config.smtpUser || '',
      SMTP_PASS: config.smtpPass || '',
      EMAIL_FROM: config.emailFrom || `noreply@${domain}`,
      RATE_LIMIT_WINDOW_MS: '900000',
      RATE_LIMIT_MAX_REQUESTS: '100',
      WEBAUTHBN_RP_ID: domain,
      WEBAUTHN_RP_NAME: 'V2 Resort',
      WEBAUTHN_ORIGIN: frontendUrl,
    });

    // Write files
    fs.mkdirSync(path.join(installDir, 'backend'), { recursive: true });
    fs.writeFileSync(path.join(installDir, '.env'), rootEnv);
    fs.writeFileSync(path.join(installDir, 'backend', '.env'), backendEnvFile);

    // Write nginx config with domain
    if (config.domain) {
      const nginxConf = buildNginxConf(domain);
      fs.mkdirSync(path.join(installDir, 'nginx'), { recursive: true });
      fs.writeFileSync(path.join(installDir, 'nginx', 'nginx.conf'), nginxConf);
    }

    // Write docker-compose.production.yml
    const composeContent = buildDockerCompose(config, domain, protocol);
    fs.writeFileSync(path.join(installDir, 'docker-compose.production.yml'), composeContent);

    log('ENV files written successfully');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Deploy ───────────────────────────────────────────────
ipcMain.handle('deploy:start', async (event, { installDir }) => {
  return new Promise((resolve) => {
    log('Starting docker-compose...');

    const proc = spawn('docker', ['compose', '-f', 'docker-compose.production.yml', 'up', '-d', '--build'], {
      cwd: installDir,
      shell: true,
      stdio: 'pipe',
    });

    proc.stdout.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        log(line);
        mainWindow.webContents.send('deploy:log', line);
      }
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        log('[ERR] ' + line);
        mainWindow.webContents.send('deploy:log', line);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log('Docker stack is up.');
        resolve({ success: true });
      } else {
        resolve({ success: false, code });
      }
    });
  });
});

ipcMain.handle('deploy:runMigrations', async (event, { installDir }) => {
  return new Promise((resolve) => {
    log('Running database migrations...');

    // Wait a few seconds for backend to be ready, then hit migration endpoint
    setTimeout(() => {
      const proc = spawn('docker', ['exec', 'v2-resort-backend', 'node', 'scripts/run-migration.js'], {
        cwd: installDir,
        shell: true,
        stdio: 'pipe',
      });

      proc.stdout.on('data', (d) => {
        const line = d.toString().trim();
        if (line) {
          log(line);
          mainWindow.webContents.send('deploy:log', line);
        }
      });

      proc.on('close', (code) => {
        resolve({ success: code === 0 });
      });
    }, 10000);
  });
});

ipcMain.handle('deploy:waitForHealth', async (event, { port = 3001 }) => {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const client = new net.Socket();
      client.setTimeout(2000);

      client.connect(port, '127.0.0.1', () => {
        client.destroy();
        clearInterval(interval);
        resolve({ ready: true });
      });

      client.on('error', () => client.destroy());
      client.on('timeout', () => client.destroy());

      if (attempts >= 60) {
        clearInterval(interval);
        resolve({ ready: false });
      }
    }, 5000);
  });
});

ipcMain.handle('deploy:openBrowser', (event, { url }) => {
  shell.openExternal(url);
  return true;
});

// ─── Helpers ──────────────────────────────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function getPublicIP() {
  const https = require('https');
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data.trim()));
    }).on('error', reject);
  });
}

function buildEnv(obj) {
  return Object.entries(obj)
    .map(([k, v]) => {
      if (v === '' || v === null || v === undefined) return `# ${k}=`;
      const val = String(v).includes(' ') ? `"${v}"` : v;
      return `${k}=${val}`;
    })
    .join('\n') + '\n';
}

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  const line = `[${ts}] ${msg}`;
  installLog.push(line);
  console.log(line);
}

function buildNginxConf(domain) {
  return `# Auto-generated by V2 Installer Wizard
events { worker_connections 1024; }

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    upstream frontend { server frontend:3000; }
    upstream backend  { server backend:3001; }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name ${domain};
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 301 https://$host$request_uri; }
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name ${domain};

        ssl_certificate     /etc/letsencrypt/live/${domain}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers off;

        add_header Strict-Transport-Security "max-age=63072000" always;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header X-Content-Type-Options nosniff always;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend/;
            proxy_http_version 1.1;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Host $host;
        }

        # WebSocket
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Auth rate limit
        location /api/auth/ {
            limit_req zone=login burst=10 nodelay;
            proxy_pass http://backend/auth/;
        }
    }
}
`;
}

function buildDockerCompose(config, domain, protocol) {
  const frontendUrl = domain ? `https://${domain}` : 'http://localhost:3000';
  const useCertbot = !!domain;

  return `# Auto-generated by V2 Installer Wizard — ${new Date().toISOString().substring(0, 10)}
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: v2-resort-db
    environment:
      POSTGRES_USER: v2resort
      POSTGRES_PASSWORD: \${DB_PASSWORD:-v2resort_secret}
      POSTGRES_DB: v2resort
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - v2-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U v2resort"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: v2-resort-redis
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - v2-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: v2-resort-backend
    env_file: ./backend/.env
    environment:
      NODE_ENV: production
      PORT: 3001
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - v2-network
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: v2-resort-frontend
    environment:
      NEXT_PUBLIC_API_URL: ${protocol}://${domain || 'localhost:3001'}/api
      NEXT_PUBLIC_SOCKET_URL: ${protocol}://${domain || 'localhost:3001'}
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${config.stripePublishableKey || ''}
    depends_on:
      - backend
    networks:
      - v2-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: v2-resort-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - certbot_www:/var/www/certbot:ro
      - certbot_conf:/etc/letsencrypt:ro
    depends_on:
      - frontend
      - backend
    networks:
      - v2-network
    restart: unless-stopped
${useCertbot ? `
  certbot:
    image: certbot/certbot
    container_name: v2-certbot
    volumes:
      - certbot_www:/var/www/certbot
      - certbot_conf:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
` : ''}

volumes:
  postgres_data:
  redis_data:
  certbot_www:
  certbot_conf:

networks:
  v2-network:
    driver: bridge
`;
}
