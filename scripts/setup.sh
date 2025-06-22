#!/bin/bash

# Text2IaC - Setup Script
# This script sets up the development environment for Text2IaC

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
section() {
    echo -e "\n${YELLOW}==> $1${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required tools
section "Checking prerequisites"

REQUIRED_TOOLS=("docker" "docker-compose" "terraform" "aws" "python3" "pip3")
MISSING_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command_exists "$tool"; then
        MISSING_TOOLS+=("$tool")
    fi
done

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo "The following required tools are missing:"
    for tool in "${MISSING_TOOLS[@]}"; do
        echo "  - $tool"
    done
    echo "\nPlease install them before continuing."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if [[ "$(echo "$PYTHON_VERSION < 3.8" | bc -l)" -eq 1 ]]; then
    echo "Python 3.8 or higher is required. Found Python $PYTHON_VERSION"
    exit 1
fi

# Create virtual environment
section "Setting up Python virtual environment"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created."
else
    echo "Virtual environment already exists."
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
section "Installing Python dependencies"
pip install --upgrade pip
pip install -r requirements.txt

# Install pre-commit hooks
if command_exists "pre-commit"; then
    section "Installing pre-commit hooks"
    pre-commit install
fi

# Install Terraform plugins
section "Initializing Terraform"
cd terraform
terraform init
cd ..

# Build Docker images
section "Building Docker images"
docker-compose build

# Set up AWS CLI
section "AWS CLI Setup"
if ! aws configure list &> /dev/null; then
    echo "AWS CLI is not configured. Running 'aws configure'..."
    aws configure
else
    echo "AWS CLI is already configured."
fi

# Set up environment variables
section "Environment Setup"
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}Please edit the .env file with your configuration.${NC}"
else
    echo ".env file already exists."
fi

# Install Node.js dependencies
if [ -d "frontend" ]; then
    section "Installing Node.js dependencies"
    cd frontend
    npm install
    cd ..
fi

echo -e "\n${GREEN}Setup complete!${NC}"
echo -e "To get started, activate the virtual environment with: ${YELLOW}source venv/bin/activate${NC}"
echo -e "Then start the development environment with: ${YELLOW}docker-compose up${NC}"

exit 0
