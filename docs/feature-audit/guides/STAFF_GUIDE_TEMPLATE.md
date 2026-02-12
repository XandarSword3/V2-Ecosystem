# Staff Guide: {MODULE_NAME}

> **Template Version:** 1.0
> **Audience:** Resort staff members (front-desk, kitchen, pool attendants, etc.)
> **Tone:** Professional, concise, task-oriented

---

## Overview

{Brief description of what this module enables staff to do — 2-3 sentences.}

---

## Prerequisites

- You must be logged in with a **Staff** account (`/staff/login`)
- {Required permissions or role assignments}
- {Any hardware requirements — e.g., kitchen display, POS terminal}

---

## Features Covered

| Feature ID | Feature Name | Type | Status |
|-----------|-------------|------|--------|
| STF-{MOD}-001 | {Feature Name} | Action / Display / Alert | ✅ / 🔧 / ⏳ |
| ... | ... | ... | ... |

---

## Daily Workflow

### Opening / Shift Start
1. Log in at `/staff/login`
2. {Navigate to the module dashboard}
3. {Check pending items / alerts}

### During Operations
1. {Primary operational task — e.g., accept incoming orders}
2. {Secondary task — e.g., update order status}
3. {Monitoring task — e.g., watch for alerts}

### Closing / Shift End
1. {End-of-shift task — e.g., reconcile, log out}

---

## Feature Details

### 1. {Feature — e.g., "View Incoming Orders"}

**What it does:** {One sentence.}

**Steps:**
1. Navigate to `{URL path}`
2. {Step 2}
3. {Step 3}

**Real-time Updates:**
- {How WebSocket/polling updates the display}

**Statuses:**
| Status | Meaning | Color |
|--------|---------|-------|
| Pending | {Description} | 🟡 Yellow |
| In Progress | {Description} | 🔵 Blue |
| Complete | {Description} | 🟢 Green |

---

### 2. {Feature — e.g., "Update Order Status"}

**What it does:** {One sentence.}

**Steps:**
1. {Step 1}
2. {Step 2}

**Keyboard Shortcuts:**
- {If any}

---

### 3. {Feature — e.g., "Handle Alerts / Escalations"}

**What it does:** {One sentence.}

**When it triggers:** {Condition}

**Response procedure:**
1. {Step 1}
2. {Step 2}

---

## Manager Escalation Points

| Scenario | Action | Escalate To |
|----------|--------|-------------|
| {Scenario — e.g., customer complaint} | {What staff should do} | Manager dashboard |
| {Scenario — e.g., stock out} | {What to do} | Inventory manager |

---

## Common Issues & Troubleshooting

| Issue | Likely Cause | Resolution |
|-------|-------------|-----------|
| {Issue description} | {Root cause} | {How to fix} |
| Orders not appearing | WebSocket disconnect | Refresh page or check network |

---

## Related Modules

- [{Related Module}](../staff/{filename}.md) — {Why it's related}

---

## Feature Coverage Summary

| Metric | Value |
|--------|-------|
| Total Features | {N} |
| Fully Documented | {N} |
| Test Coverage | {IDs of test specs covering this module} |

---

*Last Updated: {DATE}*
*Feature IDs: STF-{MOD}-001 through STF-{MOD}-{NNN}*
