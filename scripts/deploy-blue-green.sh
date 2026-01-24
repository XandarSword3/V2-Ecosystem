#!/bin/bash

# V2 Resort - Blue-Green Deployment Script
# Zero-downtime deployment with automatic rollback capability

set -e  # Exit on error

# Configuration
BLUE_CONTAINER="v2-resort-blue"
GREEN_CONTAINER="v2-resort-green"
NGINX_CONTAINER="v2-resort-nginx"
HEALTH_CHECK_URL="http://localhost:3001/health"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=2
TRAFFIC_SHIFT_STEPS=(10 25 50 75 100)
TRAFFIC_SHIFT_INTERVAL=30  # seconds between shifts
ROLLBACK_THRESHOLD=5  # error percentage to trigger rollback

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Determine which environment is currently active
get_active_environment() {
    # Check nginx upstream config
    local active=$(docker exec $NGINX_CONTAINER cat /etc/nginx/conf.d/upstream.conf 2>/dev/null | grep -oP '(?<=upstream backend \{ server )[^:]+' || echo "blue")
    if [[ "$active" == *"green"* ]]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Get the inactive environment
get_inactive_environment() {
    local active=$(get_active_environment)
    if [ "$active" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Health check function
health_check() {
    local url=$1
    local retries=$2
    local interval=$3
    
    log_info "Performing health check on $url"
    
    for ((i=1; i<=retries; i++)); do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_success "Health check passed (attempt $i/$retries)"
            return 0
        fi
        log_warning "Health check failed (attempt $i/$retries), retrying in ${interval}s..."
        sleep $interval
    done
    
    log_error "Health check failed after $retries attempts"
    return 1
}

# Deploy new version to inactive environment
deploy_to_environment() {
    local env=$1
    local container_name="v2-resort-$env"
    local port
    
    if [ "$env" = "blue" ]; then
        port=3001
    else
        port=3002
    fi
    
    log_info "Deploying new version to $env environment"
    
    # Stop existing container if running
    if docker ps -q -f name=$container_name | grep -q .; then
        log_info "Stopping existing $env container..."
        docker stop $container_name || true
        docker rm $container_name || true
    fi
    
    # Pull latest image
    log_info "Pulling latest Docker image..."
    docker pull v2resort/backend:latest
    
    # Start new container
    log_info "Starting new $env container on port $port..."
    docker run -d \
        --name $container_name \
        --network v2-resort-network \
        -p $port:3000 \
        -e NODE_ENV=production \
        -e DATABASE_URL="$DATABASE_URL" \
        -e REDIS_URL="$REDIS_URL" \
        -e JWT_SECRET="$JWT_SECRET" \
        --restart unless-stopped \
        v2resort/backend:latest
    
    # Wait for container to be ready
    sleep 5
    
    # Perform health check
    if ! health_check "http://localhost:$port/health" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL; then
        log_error "New deployment failed health check"
        docker logs $container_name
        docker stop $container_name
        docker rm $container_name
        return 1
    fi
    
    log_success "Deployment to $env environment successful"
    return 0
}

# Update nginx to shift traffic
shift_traffic() {
    local blue_weight=$1
    local green_weight=$2
    
    log_info "Shifting traffic: Blue=$blue_weight%, Green=$green_weight%"
    
    # Generate new upstream config
    cat > /tmp/upstream.conf << EOF
upstream backend {
    server v2-resort-blue:3000 weight=$blue_weight;
    server v2-resort-green:3000 weight=$green_weight;
}
EOF
    
    # Copy to nginx container and reload
    docker cp /tmp/upstream.conf $NGINX_CONTAINER:/etc/nginx/conf.d/upstream.conf
    docker exec $NGINX_CONTAINER nginx -s reload
    
    log_success "Traffic shifted successfully"
}

# Switch all traffic to target environment
switch_to_environment() {
    local env=$1
    
    log_info "Switching all traffic to $env environment"
    
    if [ "$env" = "blue" ]; then
        shift_traffic 100 0
    else
        shift_traffic 0 100
    fi
    
    log_success "All traffic now routed to $env environment"
}

# Gradual traffic shift with monitoring
gradual_traffic_shift() {
    local target_env=$1
    local source_env
    
    if [ "$target_env" = "blue" ]; then
        source_env="green"
    else
        source_env="blue"
    fi
    
    log_info "Starting gradual traffic shift to $target_env"
    
    local initial_error_rate=$(get_error_rate)
    
    for percentage in "${TRAFFIC_SHIFT_STEPS[@]}"; do
        local source_percentage=$((100 - percentage))
        
        if [ "$target_env" = "blue" ]; then
            shift_traffic $percentage $source_percentage
        else
            shift_traffic $source_percentage $percentage
        fi
        
        log_info "Waiting ${TRAFFIC_SHIFT_INTERVAL}s before next shift..."
        sleep $TRAFFIC_SHIFT_INTERVAL
        
        # Check error rate
        local current_error_rate=$(get_error_rate)
        local error_increase=$(echo "$current_error_rate - $initial_error_rate" | bc)
        
        if (( $(echo "$error_increase > $ROLLBACK_THRESHOLD" | bc -l) )); then
            log_error "Error rate increased by ${error_increase}%, initiating rollback!"
            rollback $source_env
            return 1
        fi
        
        log_success "Traffic at ${percentage}% - Error rate acceptable"
    done
    
    log_success "Gradual traffic shift completed successfully"
    return 0
}

# Get current error rate from monitoring
get_error_rate() {
    # In production, this would query your monitoring system
    # For now, return a mock value
    echo "0.5"
}

# Rollback to previous version
rollback() {
    local env=$1
    
    log_warning "Initiating rollback to $env environment"
    switch_to_environment $env
    log_success "Rollback completed"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Run migrations against the database
    docker exec $BLUE_CONTAINER npm run migrate 2>&1 || {
        log_error "Migration failed!"
        return 1
    }
    
    log_success "Migrations completed successfully"
    return 0
}

# Main deployment function
deploy() {
    local active_env=$(get_active_environment)
    local target_env=$(get_inactive_environment)
    
    log_info "=========================================="
    log_info "V2 Resort Blue-Green Deployment"
    log_info "=========================================="
    log_info "Active environment: $active_env"
    log_info "Target environment: $target_env"
    log_info "=========================================="
    
    # Step 1: Deploy to inactive environment
    if ! deploy_to_environment $target_env; then
        log_error "Deployment failed, aborting"
        exit 1
    fi
    
    # Step 2: Run migrations (if needed)
    if [ "$RUN_MIGRATIONS" = "true" ]; then
        if ! run_migrations; then
            log_error "Migrations failed, keeping traffic on $active_env"
            exit 1
        fi
    fi
    
    # Step 3: Gradual traffic shift
    if ! gradual_traffic_shift $target_env; then
        log_error "Traffic shift failed, rolled back to $active_env"
        exit 1
    fi
    
    # Step 4: Cleanup old environment (optional)
    if [ "$CLEANUP_OLD" = "true" ]; then
        log_info "Stopping old $active_env environment..."
        docker stop "v2-resort-$active_env" || true
    fi
    
    log_info "=========================================="
    log_success "Deployment completed successfully!"
    log_info "Active environment: $target_env"
    log_info "=========================================="
}

# Rollback command
rollback_command() {
    local active_env=$(get_active_environment)
    local previous_env=$(get_inactive_environment)
    
    log_warning "Rolling back from $active_env to $previous_env"
    
    # Check if previous environment is healthy
    local port
    if [ "$previous_env" = "blue" ]; then
        port=3001
    else
        port=3002
    fi
    
    if ! health_check "http://localhost:$port/health" 5 2; then
        log_error "Previous environment is not healthy, cannot rollback"
        exit 1
    fi
    
    switch_to_environment $previous_env
    
    log_success "Rollback completed successfully"
}

# Status command
status() {
    local active_env=$(get_active_environment)
    
    echo ""
    echo "V2 Resort Deployment Status"
    echo "==========================="
    echo "Active Environment: $active_env"
    echo ""
    echo "Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAME|v2-resort)"
    echo ""
}

# Print usage
usage() {
    echo "Usage: $0 {deploy|rollback|status|help}"
    echo ""
    echo "Commands:"
    echo "  deploy    - Deploy new version using blue-green strategy"
    echo "  rollback  - Rollback to previous version"
    echo "  status    - Show current deployment status"
    echo "  help      - Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  RUN_MIGRATIONS=true  - Run database migrations"
    echo "  CLEANUP_OLD=true     - Stop old environment after deployment"
}

# Main entry point
case "$1" in
    deploy)
        deploy
        ;;
    rollback)
        rollback_command
        ;;
    status)
        status
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        usage
        exit 1
        ;;
esac
