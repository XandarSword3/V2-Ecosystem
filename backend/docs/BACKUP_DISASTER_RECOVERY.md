# Backup & Disaster Recovery Strategy

## Overview

The V2 Resort platform implements a multi-layered backup strategy to ensure data integrity and business continuity.

## Backup Layers

### Layer 1: Supabase Automatic Backups
**Provider**: Supabase (managed PostgreSQL)

| Feature | Free Tier | Pro Tier |
|---------|-----------|----------|
| Frequency | Daily | Every 1 hour |
| Retention | 7 days | 30 days |
| Point-in-Time Recovery | ❌ | ✅ |
| Cross-Region | ❌ | ✅ (optional) |

**Recovery Process**:
1. Login to Supabase Dashboard
2. Navigate to Project Settings → Database
3. Select backup point from timeline
4. Click "Restore to this point"

### Layer 2: Application-Level Backups
**Endpoint**: `POST /api/admin/backups`

Creates a JSON snapshot of critical business data:
- Users and profiles
- Chalets and bookings
- Restaurant orders and menu items
- Pool tickets and sessions
- Support tickets
- Settings and configurations

**Storage**: Supabase Storage (`backups` bucket)
**Retention**: Configurable (default 30 days)
**Access**: Admin roles only

### Layer 3: Storage Backups
**Provider**: Supabase Storage

Backed up:
- Menu item images
- Chalet photos
- User uploads
- Application backups

**Retention**: Follows storage tier policy

## Backup API

### Create Backup
```bash
POST /api/admin/backups
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "backup_2024-01-19T12-00-00.json",
    "size_bytes": 1234567,
    "created_at": "2024-01-19T12:00:00Z"
  }
}
```

### List Backups
```bash
GET /api/admin/backups
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "filename": "backup_2024-01-19.json",
      "size_bytes": 1234567,
      "created_at": "2024-01-19T12:00:00Z"
    }
  ]
}
```

### Get Download URL
```bash
GET /api/admin/backups/:id/download
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "data": {
    "downloadUrl": "https://signed-url-valid-1-hour"
  }
}
```

### Restore Backup
```bash
POST /api/admin/backups/restore
Authorization: Bearer <admin_token>
Content-Type: application/json

Body: <backup_json_content>

Response:
{
  "success": true,
  "data": {
    "restored_tables": ["users", "chalets", ...],
    "timestamp": "2024-01-19T12:00:00Z"
  }
}
```

### Delete Backup
```bash
DELETE /api/admin/backups/:id
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "message": "Backup deleted successfully"
}
```

## Automated Backup Schedule

### Recommended Configuration

```yaml
# Production backup schedule
backups:
  # Daily full backup at 3 AM (low traffic)
  daily:
    enabled: true
    time: "03:00"
    retention_days: 30
  
  # Hourly incremental during business hours
  hourly:
    enabled: true
    hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    retention_hours: 48
  
  # Pre-deployment backup
  pre_deployment:
    enabled: true
    retention_days: 7
```

### Cron Job Setup (Optional)

```bash
# /etc/cron.d/v2-resort-backup
# Daily backup at 3 AM
0 3 * * * curl -X POST https://api.v2resort.com/api/admin/backups \
  -H "Authorization: Bearer $BACKUP_TOKEN" \
  >> /var/log/v2-resort-backup.log 2>&1
```

## Disaster Recovery Procedures

### Scenario 1: Database Corruption
**RTO**: 1 hour | **RPO**: 1 hour (with Pro tier)

1. Identify corruption scope
2. If partial: Use soft-delete restore for affected records
3. If full: Restore from Supabase PITR or latest backup
4. Verify data integrity
5. Notify affected users

### Scenario 2: Accidental Data Deletion
**RTO**: 30 minutes | **RPO**: 0 (soft delete)

1. Check if soft-delete applied (`deleted_at IS NOT NULL`)
2. Use restore endpoint: `POST /api/admin/soft-delete/restore`
3. If hard-deleted: Restore from backup

### Scenario 3: Complete System Failure
**RTO**: 4 hours | **RPO**: 1 day (worst case)

1. Deploy new infrastructure (Render/Vercel)
2. Restore database from Supabase backup
3. Verify storage bucket integrity
4. Update DNS if needed
5. Run smoke tests
6. Notify users of any data loss window

### Scenario 4: Ransomware/Security Breach
**RTO**: 8 hours | **RPO**: 24 hours

1. Isolate compromised systems
2. Rotate all credentials (JWT secrets, API keys)
3. Restore from clean backup (verify pre-compromise)
4. Audit access logs
5. Force password reset for all users
6. File incident report

## Backup Verification

### Automated Tests
```bash
# Run backup verification (weekly)
npm run test:backup-integrity

# Tests include:
# - Backup creation
# - Backup download
# - JSON structure validation
# - Sample data restoration
# - Rollback capability
```

### Manual Verification Checklist (Monthly)
- [ ] Create test backup
- [ ] Download and inspect JSON structure
- [ ] Restore to staging environment
- [ ] Verify critical data present
- [ ] Test user login functionality
- [ ] Verify booking/order history
- [ ] Delete test backup

## Monitoring & Alerts

### Backup Health Metrics
- Last backup timestamp
- Backup size trend
- Failed backup attempts
- Storage utilization

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Backup age | > 25 hours | > 48 hours |
| Backup size drop | > 20% | > 50% |
| Failed attempts | 2 consecutive | 3 consecutive |
| Storage > | 80% | 95% |

## Data Classification

### Critical (Backup every hour in production)
- Users and authentication
- Financial transactions
- Bookings and reservations
- Order history

### Important (Daily backup)
- Menu items and categories
- Chalets and pricing
- Pool sessions
- Reviews and ratings

### Standard (Weekly backup)
- Settings and configurations
- Audit logs
- Support tickets

## Compliance

### GDPR Considerations
- Backup data subject to same retention policies
- User deletion must cascade to backups > 30 days old
- Data export requests include backup inventory

### Audit Trail
All backup operations logged:
- Who created/deleted backup
- Download requests
- Restore operations
- Timestamp and IP

---
*Last Updated: ${new Date().toISOString()}*
