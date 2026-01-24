#!/bin/bash
# V2 Resort - Database Backup and Restore Script
# For disaster recovery operations

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/v2resort}"
S3_BUCKET="${S3_BUCKET:-v2resort-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure backup directory exists
ensure_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/daily"
    mkdir -p "$BACKUP_DIR/weekly"
    mkdir -p "$BACKUP_DIR/monthly"
}

# Create a database backup
backup_database() {
    local backup_type="${1:-daily}"
    local backup_file="$BACKUP_DIR/$backup_type/v2resort_${backup_type}_${TIMESTAMP}.sql.gz"
    
    log_info "Starting $backup_type database backup..."
    
    # Check if we have database credentials
    if [ -z "${DATABASE_URL:-}" ]; then
        log_error "DATABASE_URL not set"
        exit 1
    fi
    
    # Parse DATABASE_URL
    # Format: postgres://user:password@host:port/database
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    # Create backup with pg_dump
    PGPASSWORD="$DB_PASS" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        --verbose \
        --no-owner \
        --no-privileges \
        | gzip > "$backup_file"
    
    if [ $? -eq 0 ]; then
        log_info "Backup created: $backup_file"
        
        # Calculate checksum
        sha256sum "$backup_file" > "${backup_file}.sha256"
        
        # Upload to S3
        if command -v aws &> /dev/null; then
            log_info "Uploading to S3..."
            aws s3 cp "$backup_file" "s3://$S3_BUCKET/$backup_type/"
            aws s3 cp "${backup_file}.sha256" "s3://$S3_BUCKET/$backup_type/"
            log_info "Uploaded to s3://$S3_BUCKET/$backup_type/"
        fi
        
        return 0
    else
        log_error "Backup failed!"
        return 1
    fi
}

# Restore database from backup
restore_database() {
    local backup_file="$1"
    local target_db="${2:-}"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "WARNING: This will restore the database from backup!"
    log_warn "All current data will be replaced."
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    # Verify checksum if available
    if [ -f "${backup_file}.sha256" ]; then
        log_info "Verifying backup checksum..."
        sha256sum -c "${backup_file}.sha256"
        if [ $? -ne 0 ]; then
            log_error "Checksum verification failed!"
            exit 1
        fi
    fi
    
    log_info "Starting database restore..."
    
    # Parse DATABASE_URL
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME="${target_db:-$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')}"
    
    # Decompress and restore
    gunzip -c "$backup_file" | PGPASSWORD="$DB_PASS" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists
    
    if [ $? -eq 0 ]; then
        log_info "Database restored successfully!"
    else
        log_error "Restore completed with warnings (some objects may have been skipped)"
    fi
}

# Point-in-time recovery using Supabase
pitr_restore() {
    local target_time="$1"
    
    log_info "Initiating point-in-time recovery to: $target_time"
    
    # This would use Supabase CLI or API
    # supabase db restore --point-in-time "$target_time"
    
    log_warn "Point-in-time recovery requires Supabase CLI"
    log_warn "Run: supabase db restore --point-in-time \"$target_time\""
}

# List available backups
list_backups() {
    local location="${1:-local}"
    
    if [ "$location" == "local" ]; then
        log_info "Local backups:"
        echo ""
        echo "Daily:"
        ls -lh "$BACKUP_DIR/daily/" 2>/dev/null || echo "  No daily backups"
        echo ""
        echo "Weekly:"
        ls -lh "$BACKUP_DIR/weekly/" 2>/dev/null || echo "  No weekly backups"
        echo ""
        echo "Monthly:"
        ls -lh "$BACKUP_DIR/monthly/" 2>/dev/null || echo "  No monthly backups"
    elif [ "$location" == "s3" ]; then
        if command -v aws &> /dev/null; then
            log_info "S3 backups:"
            aws s3 ls "s3://$S3_BUCKET/" --recursive
        else
            log_error "AWS CLI not installed"
        fi
    fi
}

# Download backup from S3
download_backup() {
    local backup_path="$1"
    local local_path="${2:-$BACKUP_DIR/downloaded/}"
    
    mkdir -p "$local_path"
    
    log_info "Downloading from s3://$S3_BUCKET/$backup_path..."
    
    aws s3 cp "s3://$S3_BUCKET/$backup_path" "$local_path"
    aws s3 cp "s3://$S3_BUCKET/${backup_path}.sha256" "$local_path" 2>/dev/null || true
    
    log_info "Downloaded to $local_path"
}

# Cleanup old backups
cleanup_old_backups() {
    local retention="${1:-$RETENTION_DAYS}"
    
    log_info "Cleaning up backups older than $retention days..."
    
    # Local cleanup
    find "$BACKUP_DIR/daily" -type f -mtime +"$retention" -delete 2>/dev/null || true
    find "$BACKUP_DIR/weekly" -type f -mtime +90 -delete 2>/dev/null || true
    find "$BACKUP_DIR/monthly" -type f -mtime +365 -delete 2>/dev/null || true
    
    log_info "Local cleanup complete"
    
    # S3 lifecycle policies handle S3 cleanup
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log_info "Verifying backup: $backup_file"
    
    # Check file exists and is not empty
    if [ ! -s "$backup_file" ]; then
        log_error "Backup file is empty or missing"
        return 1
    fi
    
    # Verify checksum
    if [ -f "${backup_file}.sha256" ]; then
        sha256sum -c "${backup_file}.sha256"
        if [ $? -ne 0 ]; then
            log_error "Checksum verification failed!"
            return 1
        fi
        log_info "Checksum verified"
    fi
    
    # Try to read the backup header
    gunzip -c "$backup_file" | head -c 1000 > /dev/null
    if [ $? -eq 0 ]; then
        log_info "Backup file is readable"
    else
        log_error "Backup file appears to be corrupted"
        return 1
    fi
    
    log_info "Backup verification passed"
    return 0
}

# Create schema-only backup
backup_schema() {
    local backup_file="$BACKUP_DIR/schema_${TIMESTAMP}.sql"
    
    log_info "Creating schema-only backup..."
    
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    PGPASSWORD="$DB_PASS" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --schema-only \
        > "$backup_file"
    
    log_info "Schema backup created: $backup_file"
}

# Show help
show_help() {
    cat << EOF
V2 Resort Database Backup/Restore Script

Usage: $0 <command> [options]

Commands:
  backup [type]       Create a database backup
                      type: daily (default), weekly, monthly
  
  restore <file>      Restore database from backup file
  
  pitr <timestamp>    Point-in-time recovery to specified time
                      Format: "2024-01-15T10:30:00Z"
  
  list [location]     List available backups
                      location: local (default), s3
  
  download <path>     Download backup from S3
  
  verify <file>       Verify backup file integrity
  
  schema              Create schema-only backup
  
  cleanup [days]      Remove old backups (default: 30 days)

Environment Variables:
  DATABASE_URL        PostgreSQL connection string (required)
  BACKUP_DIR          Local backup directory (default: /var/backups/v2resort)
  S3_BUCKET           S3 bucket for remote backups
  RETENTION_DAYS      Days to keep daily backups (default: 30)

Examples:
  $0 backup daily
  $0 restore /var/backups/v2resort/daily/v2resort_daily_20240115.sql.gz
  $0 pitr "2024-01-15T10:30:00Z"
  $0 list s3
  $0 verify /path/to/backup.sql.gz
EOF
}

# Main entry point
main() {
    ensure_backup_dir
    
    local command="${1:-help}"
    
    case "$command" in
        backup)
            backup_database "${2:-daily}"
            ;;
        restore)
            if [ -z "${2:-}" ]; then
                log_error "Please specify backup file to restore"
                exit 1
            fi
            restore_database "$2" "${3:-}"
            ;;
        pitr)
            if [ -z "${2:-}" ]; then
                log_error "Please specify target timestamp"
                exit 1
            fi
            pitr_restore "$2"
            ;;
        list)
            list_backups "${2:-local}"
            ;;
        download)
            if [ -z "${2:-}" ]; then
                log_error "Please specify S3 path to download"
                exit 1
            fi
            download_backup "$2" "${3:-}"
            ;;
        verify)
            if [ -z "${2:-}" ]; then
                log_error "Please specify backup file to verify"
                exit 1
            fi
            verify_backup "$2"
            ;;
        schema)
            backup_schema
            ;;
        cleanup)
            cleanup_old_backups "${2:-$RETENTION_DAYS}"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
