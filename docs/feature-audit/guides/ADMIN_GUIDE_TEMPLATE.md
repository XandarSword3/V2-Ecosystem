# Admin Guide: {MODULE_NAME}

> **Template Version:** 1.0
> **Audience:** Resort administrators and system managers
> **Tone:** Technical, thorough, reference-oriented

---

## Overview

{Brief description of what this admin module controls — 2-3 sentences. Include impact scope (which customer/staff features it affects).}

---

## Prerequisites

- You must be logged in with an **Admin** account (`/admin/login`)
- Required role: `super_admin` or `{specific_role}`
- {Any additional requirements}

---

## Features Covered

| Feature ID | Feature Name | Type | Impact | Status |
|-----------|-------------|------|--------|--------|
| ADM-{MOD}-001 | {Feature Name} | CRUD / Config / Report | {Who it affects} | ✅ / 🔧 |
| ... | ... | ... | ... | ... |

---

## Dashboard Overview

**URL:** `/admin/{module}`

**Key Metrics Displayed:**
- {Metric 1 — e.g., Total items, Active count}
- {Metric 2 — e.g., Revenue, Pending approvals}

**Quick Actions:**
- {Button 1 — e.g., "Add New", "Export"}
- {Button 2}

---

## CRUD Operations

### Create {Entity}

**Steps:**
1. Navigate to `/admin/{module}`
2. Click **"Add New"** / **"Create"**
3. Fill in required fields:
   - **{Field 1}** — {Description, validation rules}
   - **{Field 2}** — {Description, validation rules}
   - **{Field 3}** — {Optional/Required, format}
4. Click **"Save"**

**Validation Rules:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| {Field} | {text/number/date} | Yes/No | {max length, range, format} |

**API Endpoint:** `POST /api/{module}`

---

### Read / List {Entities}

**Features:**
- Sortable columns: {list}
- Filters: {list}
- Search: {searchable fields}
- Pagination: {page size}

**Export Options:**
- CSV download
- {Other formats if available}

---

### Update {Entity}

**Steps:**
1. Click on the entity row or edit icon
2. Modify fields
3. Click **"Update"** / **"Save Changes"**

**Audit Trail:** Changes are logged in {audit table/system}

---

### Delete {Entity}

**Steps:**
1. Click delete icon on the entity row
2. Confirm in the modal dialog

**Soft Delete:** {Yes/No — describe behavior}
**Cascading Effects:** {What related data is affected}

---

## Configuration Settings

| Setting | Path | Default | Options | Impact |
|---------|------|---------|---------|--------|
| {Setting name} | `/admin/settings/{section}` | {default} | {options} | {What changes} |

---

## Bulk Operations

| Operation | How | Limit |
|-----------|-----|-------|
| Bulk delete | Select rows → Actions → Delete | {max} |
| Bulk export | Select rows → Export CSV | {max} |
| Bulk status change | Select rows → Actions → Change Status | {max} |

---

## Reports & Analytics

| Report | URL | Filters | Export |
|--------|-----|---------|--------|
| {Report name} | `/admin/reports/{type}` | {date range, category} | CSV/PDF |

---

## Integration Points

| System | Direction | What Syncs | Trigger |
|--------|-----------|-----------|---------|
| {Stripe/Supabase/Redis} | In/Out/Bidirectional | {Data type} | {When} |

---

## Common Issues & Troubleshooting

| Issue | Likely Cause | Resolution |
|-------|-------------|-----------|
| {Issue description} | {Root cause} | {How to fix} |
| Changes not reflecting | Cache not invalidated | Clear Redis cache / hard refresh |

---

## Security & Permissions

| Action | Required Role | Notes |
|--------|--------------|-------|
| View | admin, super_admin | Read-only access |
| Create | super_admin | {Notes} |
| Delete | super_admin | Requires confirmation |

---

## Related Modules

- [{Related Module}](../admin/{filename}.md) — {Why it's related}
- [{Customer Module}](../customer/{filename}.md) — {How admin changes affect customers}

---

## Feature Coverage Summary

| Metric | Value |
|--------|-------|
| Total Features | {N} |
| Fully Documented | {N} |
| Backend Endpoints | {N} |
| DB Tables | {list} |
| Test Coverage | {IDs of test specs covering this module} |

---

*Last Updated: {DATE}*
*Feature IDs: ADM-{MOD}-001 through ADM-{MOD}-{NNN}*
