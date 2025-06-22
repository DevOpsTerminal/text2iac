#!/bin/bash

# Text2IaC - Health Check Script
# This script checks the health of Text2IaC services and infrastructure

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
ENV="dev"
REGION="us-west-2"
PROFILE="default"
CHECK_ALL=true
CHECK_CONTAINERS=false
CHECK_K8S=false
CHECK_DB=false
CHECK_API=false
CHECK_FRONTEND=false
VERBOSE=false
TIMEOUT=30

# Function to print section headers
section() {
    echo -e "\n${YELLOW}==> $1${NC}"
}

# Function to print success messages
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warnings
warning() {
    echo -e "${YELLOW}⚠  $1${NC}" >&2
}

# Function to print errors
error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a service is responding
check_http_service() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    if [ "$VERBOSE" = true ]; then
        echo "Checking $name at $url..."
    fi
    
    if command_exists "curl"; then
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -m "$TIMEOUT" "$url" 2>/dev/null || echo "000")
        
        if [ "$status_code" -eq "$expected_status" ]; then
            success "$name is healthy (Status: $status_code)"
            return 0
        else
            error "$name is not healthy (Status: $status_code, Expected: $expected_status)"
            return 1
        fi
    else
        warning "curl not found, skipping HTTP check for $name"
        return 2
    fi
}

# Function to check if a container is running
check_container() {
    local name="$1"
    
    if [ "$VERBOSE" = true ]; then
        echo "Checking container $name..."
    fi
    
    if ! command_exists "docker"; then
        warning "Docker not found, skipping container checks"
        return 2
    fi
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
        error "Container $name is not running"
        return 1
    else
        local status
        status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo "unknown")
        
        if [ "$status" = "running" ]; then
            success "Container $name is running"
            return 0
        else
            error "Container $name is not running (Status: $status)"
            return 1
        fi
    fi
}

# Function to check Kubernetes resources
check_k8s() {
    if ! command_exists "kubectl"; then
        warning "kubectl not found, skipping Kubernetes checks"
        return 2
    fi
    
    section "Kubernetes Cluster Status"
    if ! kubectl cluster-info; then
        error "Failed to connect to Kubernetes cluster"
        return 1
    fi
    
    echo -e "\n${YELLOW}Nodes:${NC}"
    kubectl get nodes
    
    echo -e "\n${YELLOW}Pods:${NC}"
    kubectl get pods --all-namespaces
    
    echo -e "\n${YELLOW}Services:${NC}"
    kubectl get services --all-namespaces
    
    # Check for any pods in error state
    local error_pods
    error_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded -o json | jq -r '.items[] | "\(.metadata.namespace)/\(.metadata.name): \(.status.phase)' 2>/dev/null)
    
    if [ -n "$error_pods" ]; then
        echo -e "\n${RED}Error: The following pods are not running:${NC}"
        echo "$error_pods"
        return 1
    fi
}

# Function to check database connection
check_database() {
    section "Database Health Check"
    
    # Check if database host is set
    if [ -z "${DB_HOST:-}" ] || [ -z "${DB_PORT:-}" ]; then
        warning "Database connection details not provided, skipping database checks"
        return 2
    fi
    
    # Check if database is reachable
    if command_exists "nc"; then
        if nc -z -w "$TIMEOUT" "$DB_HOST" "$DB_PORT"; then
            success "Database is reachable at $DB_HOST:$DB_PORT"
        else
            error "Cannot connect to database at $DB_HOST:$DB_PORT"
            return 1
        fi
    else
        warning "netcat (nc) not found, skipping database connectivity check"
    fi
    
    # Check database migrations if possible
    if [ -f "manage.py" ] && [ -n "${DATABASE_URL:-}" ]; then
        echo -e "\n${YELLOW}Checking database migrations...${NC}"
        if python manage.py showmigrations --plan | grep -q "\[ \]"; then
            warning "There are unapplied migrations"
            python manage.py showmigrations --plan | grep "\[ \]"
            return 1
        else
            success "All migrations have been applied"
        fi
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        --containers)
            CHECK_ALL=false
            CHECK_CONTAINERS=true
            shift
            ;;
        --k8s)
            CHECK_ALL=false
            CHECK_K8S=true
            shift
            ;;
        --db)
            CHECK_ALL=false
            CHECK_DB=true
            shift
            ;;
        --api)
            CHECK_ALL=false
            CHECK_API=true
            shift
            ;;
        --frontend)
            CHECK_ALL=false
            CHECK_FRONTEND=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Set AWS profile if specified
if [ -n "${PROFILE}" ]; then
    export AWS_PROFILE="$PROFILE"
    export AWS_REGION="$REGION"
fi

# Load environment variables
if [ -f ".env.$ENV" ]; then
    section "Loading environment from .env.$ENV"
    export $(grep -v '^#' ".env.$ENV" | xargs)
elif [ -f ".env" ]; then
    section "Loading environment from .env"
    export $(grep -v '^#' .env | xargs)
fi

# Main script execution
section "Text2IaC Health Check"
echo "Environment: $ENV"
echo "Region: $REGION"
[ -n "${AWS_PROFILE:-}" ] && echo "AWS Profile: $AWS_PROFILE"
echo "Timestamp: $(date)"

# Check system resources
section "System Resources"
if command_exists "free"; then
    free -h
else
    warning "'free' command not found, skipping memory check"
fi

if command_exists "df"; then
    df -h
else
    warning "'df' command not found, skipping disk space check"
fi

# Check Docker containers
if [ "$CHECK_ALL" = true ] || [ "$CHECK_CONTAINERS" = true ]; then
    section "Docker Containers"
    if command_exists "docker"; then
        echo "Docker version: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
        echo "Docker Compose version: $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)"
        echo ""
        
        # Check if Docker is running
        if ! docker info &>/dev/null; then
            error "Docker daemon is not running"
        else
            success "Docker daemon is running"
            
            # List all containers
            echo -e "\n${YELLOW}Running containers:${NC}"
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            
            # Check for exited containers
            local exited_containers
            exited_containers=$(docker ps -a --filter "status=exited" --format "{{.Names}}")
            if [ -n "$exited_containers" ]; then
                warning "The following containers have exited:"
                echo "$exited_containers"
            fi
        fi
    else
        warning "Docker is not installed"
    fi
fi

# Check Kubernetes
if [ "$CHECK_ALL" = true ] || [ "$CHECK_K8S" = true ]; then
    check_k8s
fi

# Check database
if [ "$CHECK_ALL" = true ] || [ "$CHECK_DB" = true ]; then
    check_database
fi

# Check API
if [ "$CHECK_ALL" = true ] || [ "$CHECK_API" = true ]; then
    section "API Health Check"
    if [ -z "${API_URL:-}" ]; then
        warning "API_URL not set, skipping API health check"
    else
        check_http_service "API" "$API_URL/health"
    fi
fi

# Check Frontend
if [ "$CHECK_ALL" = true ] || [ "$CHECK_FRONTEND" = true ]; then
    section "Frontend Health Check"
    if [ -z "${FRONTEND_URL:-}" ]; then
        warning "FRONTEND_URL not set, skipping frontend health check"
    else
        check_http_service "Frontend" "$FRONTEND_URL"
    fi
fi

# Final status
section "Health Check Summary"
if [ "${#failed_checks[@]}" -gt 0 ]; then
    error "Health check completed with ${#failed_checks[@]} issue(s) found"
    for check in "${failed_checks[@]}"; do
        echo "- $check"
    done
    exit 1
else
    success "All health checks passed!"
    exit 0
fi
