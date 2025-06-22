#!/bin/bash

# Text2IaC - Deployment Script
# This script handles the deployment of Text2IaC infrastructure and applications

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
NO_CONFIRM=false
SKIP_TESTS=false
FORCE=false

# Function to print section headers
section() {
    echo -e "\n${YELLOW}==> $1${NC}"
}

# Function to print error messages
error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

# Function to confirm action
confirm() {
    if [ "$NO_CONFIRM" = true ]; then
        return 0
    fi
    
    local message="${1:-Are you sure?}"
    read -p "$message [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
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
        -y|--yes)
            NO_CONFIRM=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate environment
VALID_ENVS=("dev" "staging" "prod")
if [[ ! " ${VALID_ENVS[*]} " =~ " ${ENV} " ]]; then
    error "Invalid environment: $ENV. Must be one of: ${VALID_ENVS[*]}"
fi

# Set AWS profile
export AWS_PROFILE="$PROFILE"
export AWS_REGION="$REGION"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS CLI is not properly configured. Run 'aws configure' first."
fi

# Check for required tools
REQUIRED_TOOLS=("docker" "docker-compose" "terraform" "aws")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
        error "Required tool not found: $tool"
    fi
done

# Load environment variables
if [ -f ".env.$ENV" ]; then
    section "Loading environment variables from .env.$ENV"
    export $(grep -v '^#' .env.$ENV | xargs)
elif [ -f ".env" ]; then
    section "Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
else
    echo "No .env file found. Using default values."
fi

# Check for uncommitted changes
if [ "$FORCE" = false ]; then
    section "Checking for uncommitted changes"
    if ! git diff --exit-code || ! git diff --cached --exit-code; then
        error "There are uncommitted changes. Please commit or stash them before deploying."
    fi

    # Check if on the correct branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$ENV" = "prod" ] && [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
        error "Production deployments must be made from the main/master branch. Current branch: $CURRENT_BRANCH"
    fi
fi

# Run tests if not skipped
if [ "$SKIP_TESTS" = false ]; then
    section "Running tests"
    if ! ./scripts/run-tests.sh; then
        error "Tests failed. Aborting deployment."
    fi
else
    echo "Skipping tests as requested."
fi

# Build Docker images
section "Building Docker images"
if ! docker-compose build; then
    error "Failed to build Docker images."
fi

# Push images to ECR if needed
if [ "$PUSH_TO_ECR" = "true" ]; then
    section "Pushing Docker images to ECR"
    if ! ./scripts/push-to-ecr.sh --env "$ENV"; then
        error "Failed to push Docker images to ECR."
    fi
fi

# Terraform deployment
section "Deploying infrastructure with Terraform"
cd terraform

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    terraform init
fi

# Select workspace
if ! terraform workspace select "$ENV" 2> /dev/null; then
    echo "Workspace '$ENV' does not exist. Creating..."
    terraform workspace new "$ENV"
fi

# Plan changes
section "Planning Terraform changes"
if ! terraform plan -var="environment=$ENV" -out=tfplan; then
    error "Terraform plan failed."
fi

# Show plan and confirm
if [ "$NO_CONFIRM" = false ]; then
    terraform show tfplan
    confirm "Do you want to apply these changes?"
fi

# Apply changes
section "Applying Terraform changes"
if ! terraform apply -auto-approve -var="environment=$ENV"; then
    error "Terraform apply failed."
fi

# Get outputs
section "Deployment outputs"
terraform output

# Update Kubernetes configuration if needed
if [ -d "../kubernetes" ]; then
    section "Updating Kubernetes configuration"
    cd ../kubernetes
    ./update-config.sh --env "$ENV"
    cd ..
fi

# Run database migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
    section "Running database migrations"
    if ! docker-compose run --rm api python manage.py migrate; then
        error "Database migrations failed."
    fi
fi

# Run any post-deployment scripts
if [ -f "scripts/post-deploy.sh" ]; then
    section "Running post-deployment scripts"
    if ! ./scripts/post-deploy.sh --env "$ENV"; then
        error "Post-deployment scripts failed."
    fi
fi

# Show deployment summary
section "Deployment Summary"
echo -e "${GREEN}Deployment to $ENV environment completed successfully!${NC}"
echo "Environment: $ENV"
echo "Region: $REGION"
echo "AWS Profile: $PROFILE"
echo "Deployment Time: $(date)"

# If this is a production deployment, create a git tag
if [ "$ENV" = "prod" ]; then
    VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.1.0")
    NEW_VERSION=$(echo $VERSION | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
    
    confirm "Create git tag $NEW_VERSION for this production release?"
    
    git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"
    git push origin "$NEW_VERSION"
    
    echo -e "${GREEN}Created and pushed tag $NEW_VERSION${NC}"
fi

exit 0
