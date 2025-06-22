#!/bin/bash

# Text2IaC - Model Download Script
# This script handles downloading and managing ML models for Text2IaC

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
MODEL_DIR="./models"
MODEL_LIST=("gpt2" "distilgpt2" "t5-small")
NO_CONFIRM=false
FORCE_DOWNLOAD=false

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
        return 1
    fi
    return 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--model-dir)
            MODEL_DIR="$2"
            shift 2
            ;;
        -m|--model)
            MODEL_LIST=("$2")
            shift 2
            ;;
        -y|--yes)
            NO_CONFIRM=true
            shift
            ;;
        -f|--force)
            FORCE_DOWNLOAD=true
            shift
            ;;
        --list-models)
            echo "Available models: ${MODEL_LIST[*]}"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Check for required tools
REQUIRED_TOOLS=("python3" "pip3" "git")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
        error "Required tool not found: $tool"
    fi
done

# Create model directory if it doesn't exist
mkdir -p "$MODEL_DIR"

# Function to download Hugging Face model
download_hf_model() {
    local model_name="$1"
    local model_path="$MODEL_DIR/$model_name"
    
    echo -e "\n${GREEN}Processing model: $model_name${NC}"
    
    # Check if model already exists
    if [ -d "$model_path" ] && [ "$FORCE_DOWNLOAD" = false ]; then
        echo "Model $model_name already exists at $model_path"
        if ! confirm "Do you want to re-download it?"; then
            return 0
        fi
    fi
    
    # Create temporary directory
    local temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT
    
    section "Downloading $model_name from Hugging Face"
    
    # Use the Hugging Face Hub library to download the model
    python3 -c "
import os
from huggingface_hub import snapshot_download

model_name = '$model_name'
local_dir = '$temp_dir'

print(f'Downloading {model_name}...')
snapshot_download(
    repo_id=model_name,
    local_dir=local_dir,
    local_dir_use_symlinks=False,
    ignore_patterns=['*.h5', '*.ot', '*.msgpack'],
    cache_dir=os.path.join(os.path.dirname(local_dir), '.cache')
)
print('Download complete!')
    "
    
    # Move to final location
    rm -rf "$model_path"
    mv "$temp_dir" "$model_path"
    
    echo -e "${GREEN}Successfully downloaded $model_name to $model_path${NC}"
}

# Function to download custom model
download_custom_model() {
    local model_name="$1"
    local model_url=""
    
    # Map model names to their download URLs
    case "$model_name" in
        "text2iac-base")
            model_url="https://example.com/models/text2iac-base.tar.gz"
            ;;
        "terraform-generator")
            model_url="https://example.com/models/terraform-generator.zip"
            ;;
        *)
            error "Unknown custom model: $model_name"
            ;;
    esac
    
    local model_path="$MODEL_DIR/$model_name"
    local temp_file=$(mktemp)
    
    echo -e "\n${GREEN}Downloading custom model: $model_name${NC}"
    
    # Check if model already exists
    if [ -d "$model_path" ] && [ "$FORCE_DOWNLOAD" = false ]; then
        echo "Model $model_name already exists at $model_path"
        if ! confirm "Do you want to re-download it?"; then
            return 0
        fi
    fi
    
    # Create temporary directory
    local temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT
    
    # Download the model
    echo "Downloading from $model_url..."
    if ! wget -q --show-progress -O "$temp_file" "$model_url"; then
        error "Failed to download model: $model_name"
    fi
    
    # Extract the model
    echo "Extracting model..."
    if [[ "$model_url" == *.tar.gz ]] || [[ "$model_url" == *.tgz ]]; then
        tar -xzf "$temp_file" -C "$temp_dir"
    elif [[ "$model_url" == *.zip ]]; then
        unzip -q "$temp_file" -d "$temp_dir"
    else
        error "Unsupported archive format: $model_url"
    fi
    
    # Move to final location
    rm -rf "$model_path"
    mv "$temp_dir" "$model_path"
    
    # Clean up
    rm -f "$temp_file"
    
    echo -e "${GREEN}Successfully downloaded $model_name to $model_path${NC}"
}

# Main script
section "Starting model download process"
echo "Model directory: $MODEL_DIR"
echo "Models to download: ${MODEL_LIST[*]}"

if [ "$NO_CONFIRM" = false ]; then
    confirm "Continue with these settings?" || exit 0
fi

# Install required Python packages
section "Checking Python dependencies"
if ! python3 -c "import huggingface_hub" &> /dev/null; then
    echo "Installing huggingface-hub..."
    pip3 install --upgrade huggingface-hub
fi

# Download each model
for model in "${MODEL_LIST[@]}"; do
    if [[ "$model" == *"/"* ]] || [[ "$model" == *"huggingface"* ]]; then
        # This is a Hugging Face model
        download_hf_model "$model"
    else
        # This is a custom model
        download_custom_model "$model"
    fi
done

# Set permissions
section "Setting file permissions"
chmod -R 755 "$MODEL_DIR"
find "$MODEL_DIR" -type f -exec chmod 644 {} \;

echo -e "\n${GREEN}All models have been downloaded to $MODEL_DIR${NC}"
echo -e "You can now use these models with Text2IaC."

exit 0
