#!/bin/bash

# Text2IaC - Test Runner Script
# This script runs all tests for the Text2IaC platform

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="all"
VERBOSE=false
COVERAGE=false
PARALLEL=4
ENV="test"
REPORT_DIR="./test-reports"
FAIL_FAST=false
KEEP_CONTAINERS=false

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
    exit 1
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to run Python tests
run_python_tests() {
    local test_paths=("$@")
    local cmd=("pytest" "--color=yes")
    
    [ "$VERBOSE" = true ] && cmd+=("-v")
    [ "$COVERAGE" = true ] && cmd+=(
        "--cov=." 
        "--cov-report=term" 
        "--cov-report=html:${REPORT_DIR}/coverage"
        "--cov-report=xml:${REPORT_DIR}/coverage.xml"
    )
    
    [ "$FAIL_FAST" = true ] && cmd+=("-x")
    
    cmd+=("--junitxml=${REPORT_DIR}/junit.xml")
    cmd+=("--html=${REPORT_DIR}/report.html")
    cmd+=("--self-contained-html")
    
    if [ "${#test_paths[@]}" -eq 0 ]; then
        test_paths=("tests/")
    fi
    
    cmd+=("${test_paths[@]}")
    
    section "Running Python tests..."
    echo "Command: ${cmd[*]}"
    
    if ! "${cmd[@]}"; then
        error "Python tests failed"
    fi
}

# Function to run JavaScript tests
run_js_tests() {
    section "Running JavaScript tests..."
    
    if [ ! -d "frontend" ]; then
        warning "Frontend directory not found, skipping JavaScript tests"
        return 0
    fi
    
    pushd frontend > /dev/null || return 1
    
    if [ ! -f "package.json" ]; then
        warning "No package.json found in frontend directory"
        popd > /dev/null || return 1
        return 0
    fi
    
    local npm_cmd=("npm" "run" "test" "--")
    
    [ "$VERBOSE" = true ] && npm_cmd+=("--verbose")
    [ "$COVERAGE" = true ] && npm_cmd+=("--coverage")
    [ "$FAIL_FAST" = true ] && npm_cmd+=("--bail")
    
    npm_cmd+=("--reporters=default")
    npm_cmd+=("--reporters=jest-junit")
    npm_cmd+=("--ci")
    npm_cmd+=("--testResultsProcessor=jest-sonar-reporter")
    
    # Ensure test results directory exists
    mkdir -p "../${REPORT_DIR}"
    
    # Set environment variables for test reporting
    export JEST_JUNIT_OUTPUT_DIR="../${REPORT_DIR}"
    export JEST_JUNIT_OUTPUT_NAME="junit.xml"
    
    echo "Command: ${npm_cmd[*]}"
    
    if ! "${npm_cmd[@]}"; then
        popd > /dev/null || return 1
        error "JavaScript tests failed"
    fi
    
    # Move coverage report if it exists
    if [ -d "coverage" ] && [ "$COVERAGE" = true ]; then
        mv "coverage" "../${REPORT_DIR}/frontend-coverage"
    fi
    
    popd > /dev/null || return 1
}

# Function to run Terraform validation
run_terraform_validation() {
    section "Validating Terraform configurations..."
    
    if ! command_exists "terraform"; then
        warning "Terraform not found, skipping validation"
        return 0
    fi
    
    local tf_dirs=()
    local has_errors=false
    
    # Find all directories with Terraform files
    while IFS= read -r -d '' dir; do
        tf_dirs+=("$dir")
    done < <(find . -name "*.tf" -exec dirname {} \; | sort -u | tr '\n' '\0')
    
    if [ "${#tf_dirs[@]}" -eq 0 ]; then
        warning "No Terraform configurations found"
        return 0
    fi
    
    for dir in "${tf_dirs[@]}"; do
        echo "Validating $dir..."
        pushd "$dir" > /dev/null || continue
        
        # Initialize Terraform
        if ! terraform init -backend=false -input=false > /dev/null; then
            error "Failed to initialize Terraform in $dir"
        fi
        
        # Validate configuration
        if ! terraform validate; then
            has_errors=true
        fi
        
        # Check formatting
        if ! terraform fmt -check -diff; then
            warning "Some Terraform files in $dir need formatting. Run 'terraform fmt' to fix them."
        fi
        
        popd > /dev/null || continue
    done
    
    if [ "$has_errors" = true ]; then
        error "Terraform validation failed in one or more directories"
    fi
}

# Function to run security scans
run_security_scan() {
    section "Running security scans..."
    
    # Check for bandit (Python security scanner)
    if command_exists "bandit"; then
        echo "Running bandit (Python security scanner)..."
        if ! bandit -r . -f json -o "${REPORT_DIR}/bandit-report.json"; then
            warning "Bandit found some security issues. Check ${REPORT_DIR}/bandit-report.json for details."
        fi
    else
        warning "bandit not found, install with 'pip install bandit'"
    fi
    
    # Check for npm audit
    if [ -f "package.json" ] && command_exists "npm"; then
        echo "Running npm audit..."
        if ! npm audit --json > "${REPORT_DIR}/npm-audit-report.json" 2>/dev/null; then
            warning "npm audit found vulnerabilities. Check ${REPORT_DIR}/npm-audit-report.json for details."
        fi
    fi
    
    # Check for snyk
    if command_exists "snyk"; then
        echo "Running Snyk security scan..."
        if ! snyk test --json > "${REPORT_DIR}/snyk-report.json"; then
            warning "Snyk found vulnerabilities. Check ${REPORT_DIR}/snyk-report.json for details."
        fi
    else
        warning "Snyk not found, install with 'npm install -g snyk'"
    fi
}

# Function to run end-to-end tests
run_e2e_tests() {
    section "Running end-to-end tests..."
    
    if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
        warning "docker-compose.yml not found, skipping end-to-end tests"
        return 0
    fi
    
    # Start services in the background
    if [ "$KEEP_CONTAINERS" = false ]; then
        docker-compose down -v --remove-orphans
    fi
    
    if ! docker-compose up -d --build; then
        error "Failed to start services for end-to-end tests"
    fi
    
    # Function to clean up
    cleanup() {
        if [ "$KEEP_CONTAINERS" = false ]; then
            docker-compose down -v --remove-orphans
        fi
    }
    
    # Ensure cleanup runs on script exit
    trap cleanup EXIT
    
    # Wait for services to be ready
    echo "Waiting for services to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:8000/health >/dev/null; then
            success "Services are ready"
            break
        fi
        
        echo "Waiting for services to be ready (attempt $attempt/$max_attempts)..."
        sleep 5
        attempt=$((attempt + 1))
        
        if [ $attempt -gt $max_attempts ]; then
            error "Timed out waiting for services to be ready"
        fi
    done
    
    # Run end-to-end tests
    if [ -d "tests/e2e" ]; then
        section "Running Python end-to-end tests..."
        if ! pytest tests/e2e -v --html="${REPORT_DIR}/e2e-report.html" --self-contained-html; then
            error "End-to-end tests failed"
        fi
    fi
    
    # Run Cypress tests if they exist
    if [ -f "frontend/package.json" ] && grep -q "cypress" frontend/package.json; then
        section "Running Cypress end-to-end tests..."
        pushd frontend > /dev/null || return 1
        
        if ! npx cypress run --headless --browser chrome; then
            popd > /dev/null || return 1
            error "Cypress tests failed"
        fi
        
        # Copy Cypress reports
        if [ -d "cypress/reports" ]; then
            mkdir -p "../${REPORT_DIR}/cypress"
            cp -r cypress/reports/* "../${REPORT_DIR}/cypress/"
        fi
        
        popd > /dev/null || return 1
    fi
    
    success "All end-to-end tests passed"
}

# Function to generate test report
generate_report() {
    section "Generating test report..."
    
    local report_file="${REPORT_DIR}/test-report.txt"
    local timestamp
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    echo "Test Report - $timestamp" > "$report_file"
    echo "=========================" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "Environment:" >> "$report_file"
    echo "- OS: $(uname -a)" >> "$report_file"
    echo "- Python: $(python --version 2>&1 || echo 'Not installed')" >> "$report_file"
    echo "- Node.js: $(node --version 2>&1 || echo 'Not installed')" >> "$report_file"
    echo "- npm: $(npm --version 2>&1 || echo 'Not installed')" >> "$report_file"
    echo "- Docker: $(docker --version 2>&1 || echo 'Not installed')" >> "$report_file"
    echo "- Docker Compose: $(docker-compose --version 2>&1 || echo 'Not installed')" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "Test Summary:" >> "$report_file"
    echo "- Python tests: $(grep -c 'test_' "${REPORT_DIR}/junit.xml" 2>/dev/null || echo '0') tests" >> "$report_file"
    echo "- JavaScript tests: $(grep -c 'testcase' "${REPORT_DIR}/junit.xml" 2>/dev/null || echo '0') tests" >> "$report_file"
    echo "- Security issues: $(jq '.vulnerabilities.total' "${REPORT_DIR}/npm-audit-report.json" 2>/dev/null || echo 'N/A')" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "Detailed reports available in: $(pwd)/${REPORT_DIR}" >> "$report_file"
    
    cat "$report_file"
    
    # Generate HTML report
    if command_exists "pandoc"; then
        pandoc -f markdown -t html -o "${REPORT_DIR}/test-report.html" "$report_file"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -p|--parallel)
            PARALLEL="$2"
            shift 2
            ;;
        -r|--report-dir)
            REPORT_DIR="$2"
            shift 2
            ;;
        -x|--fail-fast)
            FAIL_FAST=true
            shift
            ;;
        -k|--keep-containers)
            KEEP_CONTAINERS=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Export environment variables
export PYTHONPATH=$(pwd):$PYTHONPATH
export TEST_ENV="$ENV"

# Run tests based on type
case "$TEST_TYPE" in
    all)
        run_terraform_validation
        run_python_tests
        run_js_tests
        run_security_scan
        run_e2e_tests
        ;;
    unit)
        run_python_tests "tests/unit"
        ;;
    integration)
        run_python_tests "tests/integration"
        ;;
    e2e)
        run_e2e_tests
        ;;
    js|javascript)
        run_js_tests
        ;;
    terraform|tf)
        run_terraform_validation
        ;;
    security)
        run_security_scan
        ;;
    *)
        error "Unknown test type: $TEST_TYPE. Use: all, unit, integration, e2e, js, terraform, security"
        ;;
esac

# Generate final report
generate_report

success "All tests completed successfully!"
