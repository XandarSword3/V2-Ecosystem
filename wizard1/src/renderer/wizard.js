// ============================================================
// V2 Resort — Wizard 1: Installation Wizard (Renderer)
// All 8 steps: Welcome → Docker → Supabase → Security →
//   Stripe → SMTP → Domain/DNS → Review → Deploy → Done
// ============================================================

const STEPS = [
  { id: 'welcome',   label: 'Welcome',          icon: '👋' },
  { id: 'docker',    label: 'Docker Check',      icon: '🐳' },
  { id: 'supabase',  label: 'Supabase',          icon: '🔥' },
  { id: 'security',  label: 'Security Keys',     icon: '🔐' },
  { id: 'stripe',    label: 'Stripe (Optional)', icon: '💳' },
  { id: 'smtp',      label: 'Email (Optional)',  icon: '📧' },
  { id: 'domain',    label: 'Domain & DNS',      icon: '🌐' },
  { id: 'review',    label: 'Review & Install',  icon: '🚀' },
];

// Global state
const state = {
  current: 0,
  completed: new Set(),
  config: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceKey: '',
    databaseUrl: '',
    jwtSecret: '',
    jwtRefreshSecret: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    stripePublishableKey: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    emailFrom: '',
    domain: '',
  },
  serverIP: null,
  installDir: 'C:\\V2Resort',
  dockerStatus: null,
};

// ─── Bootstrap ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  buildSidebar();
  renderStep(0);
  await preloadServerIP();
  await preloadSecrets();
});

async function preloadServerIP() {
  try {
    const res = await window.api.getServerIP();
    state.serverIP = res.ip || res.local;
  } catch { state.serverIP = '?.?.?.?'; }
}

async function preloadSecrets() {
  try {
    const s = await window.api.generateSecrets();
    state.config.jwtSecret = s.jwtSecret;
    state.config.jwtRefreshSecret = s.jwtRefreshSecret;
  } catch {}
}

// ─── Sidebar ──────────────────────────────────────────────
function buildSidebar() {
  const list = document.getElementById('stepList');
  list.innerHTML = '';
  STEPS.forEach((step, i) => {
    const li = document.createElement('li');
    li.className = 'step-item' + (i === state.current ? ' active' : '') + (state.completed.has(i) ? ' done' : '');
    li.id = `sidebar-step-${i}`;

    const isDone = state.completed.has(i);
    const numEl = `<span class="step-num">${isDone ? '<span class="step-num-check">✓</span>' : i + 1}</span>`;
    li.innerHTML = `${numEl}<span class="step-label">${step.label}</span>`;
    list.appendChild(li);
  });
}

function updateSidebar() {
  STEPS.forEach((_, i) => {
    const el = document.getElementById(`sidebar-step-${i}`);
    if (!el) return;
    el.className = 'step-item' +
      (i === state.current ? ' active' : '') +
      (state.completed.has(i) ? ' done' : '');
    const isDone = state.completed.has(i);
    el.querySelector('.step-num').innerHTML = isDone ? '<span class="step-num-check">✓</span>' : i + 1;
  });
}

// ─── Router ───────────────────────────────────────────────
function renderStep(i) {
  state.current = i;
  updateSidebar();
  const content = document.getElementById('content');
  content.innerHTML = '';

  const renderers = [
    renderWelcome,
    renderDockerCheck,
    renderSupabase,
    renderSecurity,
    renderStripe,
    renderSMTP,
    renderDomain,
    renderReview,
  ];

  renderers[i]();
}

function goNext() {
  state.completed.add(state.current);
  if (state.current < STEPS.length - 1) renderStep(state.current + 1);
}

function goBack() {
  if (state.current > 0) renderStep(state.current - 1);
}

// ─── Helpers ──────────────────────────────────────────────
function h(tag, cls, inner) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (inner !== undefined) el.innerHTML = inner;
  return el;
}

function panel() {
  const el = document.createElement('div');
  el.className = 'step-panel active';
  document.getElementById('content').appendChild(el);
  return el;
}

function header(eyebrow, title, desc) {
  return `<div class="step-header">
    <div class="step-eyebrow">${eyebrow}</div>
    <div class="step-title">${title}</div>
    ${desc ? `<div class="step-desc">${desc}</div>` : ''}
  </div>`;
}

function field({ id, label, badge = 'required', hint, placeholder, type = 'text', value = '', mono = false }) {
  const badgeHtml = badge === 'required' ? '<span class="field-badge-required">Required</span>'
    : badge === 'auto' ? '<span class="field-badge-auto">Auto-generated</span>'
    : badge === 'optional' ? '<span class="field-badge-optional">Optional</span>'
    : '';
  return `<div class="field">
    <div class="field-label">${label} ${badgeHtml}</div>
    ${hint ? `<div class="field-hint">${hint}</div>` : ''}
    <input type="${type}" id="${id}" placeholder="${placeholder || ''}" value="${esc(value)}"
      class="${mono ? 'monospace' : ''}" oninput="saveField('${id}', this.value)" />
  </div>`;
}

function secretField({ id, label, hint, value = '' }) {
  return `<div class="field">
    <div class="field-label">${label} <span class="field-badge-auto">Auto-generated</span></div>
    ${hint ? `<div class="field-hint">${hint}</div>` : ''}
    <div class="field-input-wrap">
      <input type="text" id="${id}" value="${esc(value)}" class="monospace has-copy-btn" readonly />
      <button class="input-regen-btn" onclick="regenSecret('${id}')">↻ Regen</button>
    </div>
  </div>`;
}

function callout(type, icon, title, text) {
  return `<div class="callout callout-${type}">
    <span class="callout-icon">${icon}</span>
    <div class="callout-body">
      <div class="callout-title">${title}</div>
      <div class="callout-text">${text}</div>
    </div>
  </div>`;
}

function navRow({ backLabel = '← Back', nextLabel = 'Continue →', nextId = 'btn-next', backHidden = false }) {
  return `<div class="step-nav">
    <div class="nav-left">
      ${backHidden ? '' : `<button class="btn btn-secondary" onclick="goBack()">${backLabel}</button>`}
    </div>
    <div class="nav-right">
      <button class="btn btn-primary" id="${nextId}">
        ${nextLabel}
      </button>
    </div>
  </div>`;
}

function esc(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Save field back to state
function saveField(key, value) {
  if (key in state.config) state.config[key] = value;
}

async function regenSecret(id) {
  const secrets = await window.api.generateSecrets();
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'jwtSecret') {
    el.value = secrets.jwtSecret;
    state.config.jwtSecret = secrets.jwtSecret;
  } else if (id === 'jwtRefreshSecret') {
    el.value = secrets.jwtRefreshSecret;
    state.config.jwtRefreshSecret = secrets.jwtRefreshSecret;
  }
}

function mask(s) {
  if (!s || s.length < 8) return s || '—';
  return s.substring(0, 6) + '••••••••' + s.slice(-4);
}

// ─── STEP 0: Welcome ──────────────────────────────────────
function renderWelcome() {
  const p = panel();
  p.innerHTML = `
    ${header('Step 1 of 8', 'Welcome to V2 Resort Installer',
      'This wizard will get V2 Resort Management Platform running on your Windows server with Docker, SSL, and automatic database setup. The whole process takes about 10 minutes.'
    )}

    <ul class="what-list">
      <li class="what-item"><span class="what-icon">🐳</span><div class="what-text"><strong>Checks & installs Docker Desktop</strong> — the container runtime that powers the entire V2 stack.</div></li>
      <li class="what-item"><span class="what-icon">🔐</span><div class="what-text"><strong>Collects your API keys</strong> — Supabase, Stripe, and SMTP, with inline instructions for every field.</div></li>
      <li class="what-item"><span class="what-icon">🌐</span><div class="what-text"><strong>Configures your domain & SSL</strong> — tells you exactly which DNS record to create, then sets up Nginx + Let's Encrypt automatically.</div></li>
      <li class="what-item"><span class="what-icon">🚀</span><div class="what-text"><strong>Launches the full stack</strong> — writes all environment files, runs Docker Compose, executes database migrations, and opens V2 in your browser.</div></li>
    </ul>

    ${callout('info', 'ℹ️', 'What you need before starting',
      'A <strong>Supabase account</strong> (free at supabase.com) · A <strong>domain name</strong> with A-record access · <strong>Admin rights</strong> on this machine (already granted). Stripe and email are optional — you can add them later.'
    )}

    <div class="field mt-16">
      <div class="field-label">Installation Directory <span class="field-badge-optional">Optional</span></div>
      <div class="field-hint">Where V2 files will be saved on this machine. Leave as default unless you have a reason to change it.</div>
      <input type="text" id="installDir" value="${esc(state.installDir)}" oninput="state.installDir = this.value" />
    </div>

    ${navRow({ backHidden: true, nextLabel: 'Get Started →', nextId: 'btn-start' })}
  `;

  document.getElementById('btn-start').onclick = () => goNext();
}

// ─── STEP 1: Docker Check ─────────────────────────────────
function renderDockerCheck() {
  const p = panel();
  p.innerHTML = `
    ${header('Step 2 of 8', 'Docker Desktop', 'V2 runs entirely inside Docker containers — the backend, frontend, database, and reverse proxy are all packaged and isolated.')}

    <div id="docker-status">
      <div class="status-card">
        <div class="status-icon"><div class="spinner"></div></div>
        <div class="status-body">
          <div class="status-title">Checking Docker...</div>
          <div class="status-sub">Detecting Docker Desktop installation and daemon status.</div>
        </div>
      </div>
    </div>

    ${callout('info', 'ℹ️', 'What is Docker Desktop?',
      'Docker runs each part of V2 in an isolated container. You don\'t need to install Node.js, PostgreSQL, Redis, or Nginx manually — Docker handles all of that. It takes about 5 minutes to install and runs silently in the background.'
    )}

    ${navRow({ nextLabel: 'Continue →', nextId: 'btn-docker-next' })}
  `;

  document.getElementById('btn-docker-next').disabled = true;

  checkDocker();
}

async function checkDocker() {
  const statusEl = document.getElementById('docker-status');
  if (!statusEl) return;

  const status = await window.api.checkDocker();
  state.dockerStatus = status;

  if (status.installed && status.running) {
    statusEl.innerHTML = `
      <div class="status-card">
        <div class="status-icon">✅</div>
        <div class="status-body">
          <div class="status-title">Docker Desktop is installed and running</div>
          <div class="status-sub">Ready to deploy V2 containers.</div>
        </div>
      </div>`;
    document.getElementById('btn-docker-next').disabled = false;
    document.getElementById('btn-docker-next').onclick = () => goNext();

  } else if (status.installed && !status.running) {
    statusEl.innerHTML = `
      <div class="status-card">
        <div class="status-icon">⚠️</div>
        <div class="status-body">
          <div class="status-title">Docker is installed but not running</div>
          <div class="status-sub">Docker Desktop is installed. Click the button to start it, then wait a moment.</div>
        </div>
        <div class="status-action">
          <button class="btn btn-secondary btn-sm" onclick="startAndWaitDocker()">▶ Start Docker</button>
        </div>
      </div>
      <div id="docker-wait-msg"></div>`;

  } else {
    statusEl.innerHTML = `
      <div class="status-card">
        <div class="status-icon">❌</div>
        <div class="status-body">
          <div class="status-title">Docker Desktop is not installed</div>
          <div class="status-sub">Click the button to download the installer. Run it, restart this wizard, and it will be detected automatically.</div>
        </div>
        <div class="status-action">
          <button class="btn btn-primary btn-sm" onclick="downloadDocker()">⬇ Download Docker</button>
        </div>
      </div>
      ${callout('warn', '⚠️', 'After installing Docker',
        'Close this wizard, install Docker Desktop, allow it to start, then re-run this installer. Docker runs as a background service and must be active before V2 can launch.'
      )}`;
  }
}

async function startAndWaitDocker() {
  await window.api.startDockerDesktop();
  document.getElementById('docker-wait-msg').innerHTML = `
    <div class="callout callout-info">
      <span class="callout-icon"><div class="spinner"></div></span>
      <div class="callout-body">
        <div class="callout-title">Waiting for Docker to start…</div>
        <div class="callout-text">This can take up to 60 seconds. The wizard will continue automatically.</div>
      </div>
    </div>`;

  const res = await window.api.waitForDockerReady();
  if (res.ready) {
    document.getElementById('docker-status').innerHTML = `
      <div class="status-card">
        <div class="status-icon">✅</div>
        <div class="status-body">
          <div class="status-title">Docker Desktop is now running</div>
          <div class="status-sub">Ready to deploy.</div>
        </div>
      </div>`;
    document.getElementById('docker-wait-msg').innerHTML = '';
    document.getElementById('btn-docker-next').disabled = false;
    document.getElementById('btn-docker-next').onclick = () => goNext();
  } else {
    document.getElementById('docker-wait-msg').innerHTML = `
      ${callout('err', '❌', 'Docker did not start in time',
        'Try opening Docker Desktop manually from your Start menu and wait for the whale icon in the taskbar to stop animating, then click "Check again".'
      )}
      <button class="btn btn-secondary btn-sm" onclick="checkDocker()">↻ Check Again</button>`;
  }
}

async function downloadDocker() {
  await window.api.openDockerInstallPage();
}

// ─── STEP 2: Supabase ─────────────────────────────────────
function renderSupabase() {
  const p = panel();
  p.innerHTML = `
    ${header('Step 3 of 8', 'Supabase Configuration',
      'V2 uses Supabase as its database layer. You need a free Supabase project — it takes about 5 minutes to create.'
    )}

    ${callout('info', '🔥', 'How to get your Supabase keys',
      `<ol style="margin:6px 0 0 16px; line-height:1.9">
        <li>Go to <strong>supabase.com</strong> → click <em>New Project</em></li>
        <li>Choose a name (e.g. <code>v2-resort</code>) and a strong database password — <strong>save this password</strong></li>
        <li>Wait ~2 min for the project to provision</li>
        <li>Go to <strong>Project Settings → API</strong> — copy the three keys below</li>
        <li>Go to <strong>Project Settings → Database</strong> → copy the Connection String (URI format)</li>
      </ol>`
    )}

    <div class="form-section">
      <div class="form-section-title">Supabase Project API</div>
      ${field({
        id: 'supabaseUrl', label: 'Project URL', value: state.config.supabaseUrl,
        hint: 'Found at: <strong>Project Settings → API → Project URL</strong>. Looks like: <code>https://abcdefgh.supabase.co</code>',
        placeholder: 'https://your-project-id.supabase.co',
      })}
      ${field({
        id: 'supabaseAnonKey', label: 'Anon / Public Key', value: state.config.supabaseAnonKey,
        hint: 'Found at: <strong>Project Settings → API → Project API Keys → anon public</strong>. Safe to expose to browsers.',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        mono: true,
      })}
      ${field({
        id: 'supabaseServiceKey', label: 'Service Role Key', type: 'password', value: state.config.supabaseServiceKey,
        hint: '<strong>⚠️ Secret — never expose this publicly.</strong> Found at: <strong>Project Settings → API → Project API Keys → service_role</strong>. V2 backend uses this to bypass RLS for admin operations.',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      })}
    </div>

    <div class="form-section">
      <div class="form-section-title">Database Connection</div>
      ${field({
        id: 'databaseUrl', label: 'PostgreSQL Connection String', value: state.config.databaseUrl,
        hint: 'Found at: <strong>Project Settings → Database → Connection String → URI</strong>. Replace <code>[YOUR-PASSWORD]</code> with the password you set when creating the project.',
        placeholder: 'postgresql://postgres:YOUR_PASSWORD@db.abcdef.supabase.co:5432/postgres',
        mono: true,
      })}
    </div>

    ${navRow({ nextLabel: 'Continue →', nextId: 'btn-supa-next' })}
  `;

  document.getElementById('btn-supa-next').onclick = () => {
    if (!state.config.supabaseUrl || !state.config.supabaseAnonKey || !state.config.supabaseServiceKey || !state.config.databaseUrl) {
      showInlineError('btn-supa-next', 'All four Supabase fields are required.');
      return;
    }
    goNext();
  };
}

// ─── STEP 3: Security Keys ────────────────────────────────
function renderSecurity() {
  const p = panel();
  p.innerHTML = `
    ${header('Step 4 of 8', 'Security Keys',
      'These secrets protect your users\' sessions. They have been auto-generated using cryptographically secure random bytes — you do not need to change them.'
    )}

    ${callout('ok', '🔐', 'These are already generated for you',
      'V2 uses two separate JWT secrets: one for short-lived access tokens (15 min) and one for long-lived refresh tokens (7 days). Each is a 512-bit hex string generated locally on your machine using Node.js <code>crypto.randomBytes(64)</code>.'
    )}

    <div class="form-section">
      <div class="form-section-title">JWT Signing Secrets</div>
      ${secretField({
        id: 'jwtSecret', label: 'JWT Access Token Secret', value: state.config.jwtSecret,
        hint: 'Used to sign the short-lived access tokens (expires in 15 minutes). If you rotate this, all users will be logged out.',
      })}
      ${secretField({
        id: 'jwtRefreshSecret', label: 'JWT Refresh Token Secret', value: state.config.jwtRefreshSecret,
        hint: 'Used to sign the long-lived refresh tokens (expires in 7 days). Must be different from the access token secret.',
      })}
    </div>

    ${callout('warn', '⚠️', 'Back these up',
      'Store these secrets somewhere safe (password manager, secure notes). If you lose them and your server crashes, all sessions will be invalidated on next boot.'
    )}

    ${navRow({ nextLabel: 'Continue →', nextId: 'btn-sec-next' })}
  `;

  document.getElementById('btn-sec-next').onclick = () => {
    // Read current values from inputs
    const j = document.getElementById('jwtSecret');
    const jr = document.getElementById('jwtRefreshSecret');
    if (j) state.config.jwtSecret = j.value;
    if (jr) state.config.jwtRefreshSecret = jr.value;
    goNext();
  };
}

// ─── STEP 4: Stripe ───────────────────────────────────────
function renderStripe() {
  const p = panel();
  p.innerHTML = `
    ${header('Step 5 of 8', 'Stripe Payment Keys',
      'V2 supports card payments, split billing, and automatic refunds through Stripe. Skip this step if you don\'t need payments yet — you can add keys later by editing <code>backend/.env</code>.'
    )}

    ${callout('info', '💳', 'How to get Stripe keys',
      `<ol style="margin:6px 0 0 16px;line-height:1.9">
        <li>Sign up at <strong>stripe.com</strong> → complete business verification</li>
        <li>Go to <strong>Developers → API Keys</strong></li>
        <li>Copy the <strong>Publishable key</strong> (starts with <code>pk_live_</code>) and <strong>Secret key</strong> (starts with <code>sk_live_</code>)</li>
        <li>For the Webhook Secret: go to <strong>Developers → Webhooks → Add endpoint</strong>, point it at <code>https://your-domain.com/api/webhooks/stripe</code>, then copy the signing secret (starts with <code>whsec_</code>)</li>
      </ol>`
    )}

    <div class="form-section">
      <div class="form-section-title">Stripe API Keys</div>
      ${field({
        id: 'stripePublishableKey', label: 'Publishable Key', badge: 'optional', value: state.config.stripePublishableKey,
        hint: 'Used in the browser to initialize Stripe Elements. Starts with <code>pk_live_</code> or <code>pk_test_</code> for testing.',
        placeholder: 'pk_live_...',
        mono: true,
      })}
      ${field({
        id: 'stripeSecretKey', label: 'Secret Key', badge: 'optional', type: 'password', value: state.config.stripeSecretKey,
        hint: '⚠️ Never expose this. Used server-side to charge cards. Starts with <code>sk_live_</code>.',
        placeholder: 'sk_live_...',
      })}
      ${field({
        id: 'stripeWebhookSecret', label: 'Webhook Signing Secret', badge: 'optional', type: 'password', value: state.config.stripeWebhookSecret,
        hint: 'V2 validates incoming Stripe webhooks with this secret. Required for automatic payment confirmation and refunds. Starts with <code>whsec_</code>.',
        placeholder: 'whsec_...',
      })}
    </div>

    ${navRow({ nextLabel: 'Continue →', nextId: 'btn-stripe-next' })}
  `;

  document.getElementById('btn-stripe-next').onclick = () => goNext();
}

// ─── STEP 5: SMTP ─────────────────────────────────────────
function renderSMTP() {
  const p = panel();
  p.innerHTML = `
    ${header('Step 6 of 8', 'Email / SMTP Configuration',
      'V2 sends password reset emails, booking confirmations, and staff notifications. You can skip this now and configure it later in the admin panel.'
    )}

    ${callout('info', '📧', 'How to get SMTP credentials',
      `<strong>Gmail (easiest):</strong> Go to myaccount.google.com → Security → 2-Step Verification (must be on) → App Passwords → Generate. Use <code>smtp.gmail.com</code>, port <code>587</code>, your Gmail address, and the 16-char app password.<br><br>
      <strong>SendGrid (recommended for production):</strong> Create account at sendgrid.com → Settings → API Keys → Create. Use <code>smtp.sendgrid.net</code>, port <code>587</code>, username <code>apikey</code>, and the API key as password.`
    )}

    <div class="form-section">
      <div class="form-section-title">SMTP Server Settings</div>
      ${field({
        id: 'smtpHost', label: 'SMTP Host', badge: 'optional', value: state.config.smtpHost,
        hint: 'Your email provider\'s SMTP server. Examples: <code>smtp.gmail.com</code>, <code>smtp.sendgrid.net</code>, <code>mail.your-domain.com</code>',
        placeholder: 'smtp.gmail.com',
      })}
      ${field({
        id: 'smtpPort', label: 'SMTP Port', badge: 'optional', type: 'number', value: state.config.smtpPort,
        hint: 'Standard ports: <code>587</code> (STARTTLS, recommended) or <code>465</code> (SSL). Port <code>25</code> is often blocked by ISPs.',
        placeholder: '587',
      })}
      ${field({
        id: 'smtpUser', label: 'SMTP Username', badge: 'optional', value: state.config.smtpUser,
        hint: 'Usually your email address. For SendGrid this is literally <code>apikey</code> (the word, not your key).',
        placeholder: 'you@gmail.com',
      })}
      ${field({
        id: 'smtpPass', label: 'SMTP Password / App Password', badge: 'optional', type: 'password', value: state.config.smtpPass,
        hint: 'For Gmail: use the App Password generated above, not your account password. For SendGrid: use the API key.',
        placeholder: 'xxxx xxxx xxxx xxxx',
      })}
      ${field({
        id: 'emailFrom', label: 'From Address', badge: 'optional', value: state.config.emailFrom,
        hint: 'How V2 signs outgoing emails. Examples: <code>V2 Resort &lt;noreply@v2resort.com&gt;</code>',
        placeholder: 'V2 Resort <noreply@your-domain.com>',
      })}
    </div>

    ${navRow({ nextLabel: 'Continue →', nextId: 'btn-smtp-next' })}
  `;

  document.getElementById('btn-smtp-next').onclick = () => goNext();
}

// ─── STEP 6: Domain & DNS ─────────────────────────────────
function renderDomain() {
  const p = panel();

  const ip = state.serverIP || '?.?.?.?';

  p.innerHTML = `
    ${header('Step 7 of 8', 'Domain & DNS Setup',
      'V2 will serve traffic over HTTPS using your own domain. Nginx will act as the reverse proxy, and Let\'s Encrypt will issue a free SSL certificate automatically.'
    )}

    <div class="form-section">
      <div class="form-section-title">Your Server's Public IP Address</div>
      <div class="callout callout-info">
        <span class="callout-icon">🖥️</span>
        <div class="callout-body">
          <div class="callout-title">This machine's detected IP</div>
          <div class="callout-text"><span class="ip-display" id="ip-display">${ip}</span></div>
        </div>
      </div>

      ${callout('warn', '⚠️', 'Using a VPS or cloud server?',
        'The IP above is the network interface detected locally. If this machine is behind NAT (a router), the external IP that DNS should point to is the one assigned by your VPS provider. Find it in your server control panel (Vultr / DigitalOcean / Hetzner / Linode → Networking).'
      )}
    </div>

    <div class="form-section">
      <div class="form-section-title">Your Domain</div>
      ${field({
        id: 'domain', label: 'Domain Name', badge: 'optional', value: state.config.domain,
        hint: 'Enter your domain without <code>https://</code>. Example: <code>admin.myresort.com</code> or <code>myresort.com</code>. Leave blank to run on localhost only (no SSL).',
        placeholder: 'admin.myresort.com',
      })}
    </div>

    <div id="dns-instructions"></div>

    ${navRow({ nextLabel: 'Continue →', nextId: 'btn-domain-next' })}
  `;

  // Update DNS instructions live
  const domainInput = document.getElementById('domain');
  domainInput.addEventListener('input', () => updateDNSInstructions(domainInput.value.trim()));
  updateDNSInstructions(state.config.domain);

  document.getElementById('btn-domain-next').onclick = () => {
    const d = document.getElementById('domain').value.trim();
    state.config.domain = d;
    goNext();
  };
}

function updateDNSInstructions(domain) {
  const el = document.getElementById('dns-instructions');
  if (!el) return;
  const ip = state.serverIP || '?.?.?.?';

  if (!domain) {
    el.innerHTML = `<div class="callout callout-warn">
      <span class="callout-icon">ℹ️</span>
      <div class="callout-body">
        <div class="callout-title">No domain entered</div>
        <div class="callout-text">V2 will run on <code>http://localhost:3000</code> without SSL. You can add a domain later by editing the <code>.env</code> files and re-running docker compose.</div>
      </div>
    </div>`;
    return;
  }

  el.innerHTML = `
    <div class="form-section">
      <div class="form-section-title">DNS Record to Create</div>
      <div class="callout callout-ok" style="margin-bottom:12px">
        <span class="callout-icon">✅</span>
        <div class="callout-body">
          <div class="callout-title">Create exactly this A record at your DNS provider</div>
          <div class="callout-text">Log into wherever you bought your domain (Namecheap, Cloudflare, GoDaddy, etc.) → DNS Management → Add Record:</div>
        </div>
      </div>

      <div class="dns-record">
        <div class="dns-row">
          <span class="dns-col-head">Type</span>
          <span class="dns-col-head">Name</span>
          <span class="dns-col-head">Value</span>
        </div>
        <div class="dns-row">
          <span class="dns-col-type">A</span>
          <span style="color:var(--warn)">${domain}</span>
          <span class="dns-col-val">${ip}</span>
        </div>
      </div>

      <div class="callout callout-warn" style="margin-top:12px">
        <span class="callout-icon">⏳</span>
        <div class="callout-body">
          <div class="callout-title">DNS propagation takes time</div>
          <div class="callout-text">Usually 5–30 minutes with Cloudflare. Up to 48 hours with some providers. V2 will try to get an SSL certificate — it will keep retrying until DNS resolves. You can continue the wizard now.</div>
        </div>
      </div>

      <div class="callout callout-info" style="margin-top:12px">
        <span class="callout-icon">💡</span>
        <div class="callout-body">
          <div class="callout-title">Cloudflare tip</div>
          <div class="callout-text">If using Cloudflare, set the proxy to <strong>DNS only</strong> (grey cloud, not orange) initially. Once SSL is issued, you can turn the proxy on.</div>
        </div>
      </div>
    </div>
  `;
}

// ─── STEP 7: Review & Install ─────────────────────────────
function renderReview() {
  const c = state.config;
  const p = panel();

  p.innerHTML = `
    ${header('Step 8 of 8', 'Review & Install',
      'Everything is configured. Review your settings below, then click Install to write the environment files and launch V2.'
    )}

    <div class="form-section">
      <div class="form-section-title">Configuration Summary</div>
      <table class="review-table">
        <tr><td>Installation Directory</td><td>${esc(state.installDir)}</td></tr>
        <tr><td>Supabase URL</td><td>${esc(c.supabaseUrl)}</td></tr>
        <tr><td>Supabase Anon Key</td><td>${mask(c.supabaseAnonKey)}</td></tr>
        <tr><td>Supabase Service Key</td><td>${mask(c.supabaseServiceKey)}</td></tr>
        <tr><td>Database URL</td><td>${mask(c.databaseUrl)}</td></tr>
        <tr><td>JWT Secret</td><td>${mask(c.jwtSecret)}</td></tr>
        <tr><td>JWT Refresh Secret</td><td>${mask(c.jwtRefreshSecret)}</td></tr>
        <tr><td>Stripe</td><td>${c.stripeSecretKey ? '✅ Configured' : '— Skipped'}</td></tr>
        <tr><td>SMTP</td><td>${c.smtpHost ? `✅ ${esc(c.smtpHost)}:${esc(c.smtpPort)}` : '— Skipped'}</td></tr>
        <tr><td>Domain</td><td>${c.domain ? esc(c.domain) + ' (SSL via Let\'s Encrypt)' : 'localhost only (no SSL)'}</td></tr>
      </table>
    </div>

    ${callout('warn', '⚠️', 'Last chance to go back',
      'Once you click Install, the wizard will write environment files and start Docker containers. The process is reversible but takes time to undo.'
    )}

    <div id="install-progress" class="hidden">
      <div class="progress-bar-wrap"><div class="progress-bar" id="pbar"></div></div>
      <div class="deploy-log" id="deploy-log"></div>
    </div>

    <div class="step-nav">
      <div class="nav-left">
        <button class="btn btn-secondary" onclick="goBack()" id="btn-rev-back">← Back</button>
      </div>
      <div class="nav-right">
        <button class="btn btn-primary" id="btn-install" onclick="startInstall()">
          🚀 Install V2 Resort
        </button>
      </div>
    </div>
  `;
}

async function startInstall() {
  const btnInstall = document.getElementById('btn-install');
  const btnBack    = document.getElementById('btn-rev-back');
  const progress   = document.getElementById('install-progress');

  btnInstall.disabled = true;
  btnBack.disabled    = true;
  btnInstall.textContent = 'Installing…';
  progress.classList.remove('hidden');

  const logEl = document.getElementById('deploy-log');
  const pbar  = document.getElementById('pbar');

  function deployLog(msg) {
    const line = document.createElement('div');
    const isErr = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('err]');
    line.className = isErr ? 'log-line-err' : '';
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  window.api.onDeployLog(deployLog);

  function setProgress(pct, msg) {
    pbar.style.width = pct + '%';
    if (msg) deployLog(`[wizard] ${msg}`);
  }

  try {
    // 1. Write env files
    setProgress(10, 'Writing environment files…');
    const writeResult = await window.api.writeEnvFiles({
      config: state.config,
      installDir: state.installDir,
    });
    if (!writeResult.success) throw new Error('Failed to write .env files: ' + writeResult.error);
    setProgress(25, '.env files written.');

    // 2. Launch docker-compose
    setProgress(35, 'Starting Docker containers (this takes a few minutes on first run)…');
    const deployResult = await window.api.startDeploy({ installDir: state.installDir });
    if (!deployResult.success) throw new Error('docker compose exited with code ' + deployResult.code);
    setProgress(65, 'Containers are up.');

    // 3. Wait for backend health
    setProgress(72, 'Waiting for backend to be ready…');
    const health = await window.api.waitForHealth({ port: 3001 });
    if (!health.ready) deployLog('[wizard] Backend health check timed out — it may still be starting.');
    setProgress(80, 'Backend is responding.');

    // 4. Run migrations
    setProgress(85, 'Running database migrations…');
    await window.api.runMigrations({ installDir: state.installDir });
    setProgress(95, 'Migrations complete.');

    // 5. Done
    setProgress(100, 'Installation complete!');
    window.api.offDeployLog();

    // Show success screen
    setTimeout(() => renderSuccess(), 1200);

  } catch (err) {
    window.api.offDeployLog();
    deployLog(`[wizard] ❌ INSTALLATION FAILED: ${err.message}`);
    btnInstall.disabled = false;
    btnBack.disabled    = false;
    btnInstall.textContent = '↻ Retry Install';
    btnInstall.onclick = startInstall;
  }
}

// ─── Success Screen ───────────────────────────────────────
function renderSuccess() {
  const content = document.getElementById('content');
  const domain  = state.config.domain;
  const url     = domain ? `https://${domain}` : 'http://localhost:3000';
  const installUrl = `${url}/install`;

  content.innerHTML = `
    <div class="step-panel active" style="align-items:center;justify-content:center;">
      <div class="success-hero">
        <div class="success-badge">✅</div>
        <div class="success-title">V2 Resort is live!</div>
        <div class="success-sub">
          Docker containers are running, the database is migrated, and your stack is ready.
          The next step is <strong>Wizard 2</strong> — opening the install page in your browser to create your owner account and configure your resort.
        </div>

        <div style="margin-top:28px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="openInstallPage()">
            🌐 Open Install Page
          </button>
          <button class="btn btn-secondary" onclick="window.api.close()">
            Close Wizard
          </button>
        </div>
      </div>

      <div class="form-section" style="width:100%;max-width:520px;margin-top:24px">
        <div class="form-section-title">What happens next (Wizard 2)</div>
        <ul class="what-list">
          <li class="what-item"><span class="what-icon">👤</span><div class="what-text"><strong>Create your owner account</strong> — name, email, and password for the super admin.</div></li>
          <li class="what-item"><span class="what-icon">🏨</span><div class="what-text"><strong>Configure your resort</strong> — name, branding, modules, rooms, and menus.</div></li>
          <li class="what-item"><span class="what-icon">🔒</span><div class="what-text"><strong>Locked for good</strong> — the install page disappears after setup and can't be accessed again without reinstalling.</div></li>
        </ul>
      </div>

      <div class="callout callout-info" style="width:100%;max-width:520px">
        <span class="callout-icon">ℹ️</span>
        <div class="callout-body">
          <div class="callout-title">Your V2 URL</div>
          <div class="callout-text"><code>${installUrl}</code></div>
        </div>
      </div>
    </div>
  `;

  // Mark all steps complete
  STEPS.forEach((_, i) => state.completed.add(i));
  updateSidebar();
}

function openInstallPage() {
  const domain = state.config.domain;
  const url = domain ? `https://${domain}/install` : 'http://localhost:3000/install';
  window.api.openBrowser({ url });
}

function showInlineError(nearBtnId, msg) {
  const existing = document.getElementById('inline-err');
  if (existing) existing.remove();
  const btn = document.getElementById(nearBtnId);
  if (!btn) return;
  const err = document.createElement('div');
  err.id = 'inline-err';
  err.className = 'callout callout-err';
  err.style.marginBottom = '12px';
  err.innerHTML = `<span class="callout-icon">❌</span><div class="callout-body"><div class="callout-text">${msg}</div></div>`;
  btn.parentElement.parentElement.insertBefore(err, btn.parentElement);
}
