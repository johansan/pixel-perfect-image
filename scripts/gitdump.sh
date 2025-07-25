#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project root directory
cd "$SCRIPT_DIR/.."

# Get timestamp in format YYYYMMDD-HHMMSS
timestamp=$(date +"%Y%m%d-%H%M%S")

# Get current directory name only (not full path)
folder_name=$(basename "$PWD")

# Set output path in parent folder
output_file="../${folder_name}_${timestamp}.txt"

# Write diffs to the file
echo "Unstaged changes:" > "$output_file"
git diff --patch --minimal >> "$output_file"

echo "" >> "$output_file"
echo "Staged (but not yet committed) changes:" >> "$output_file"
git diff --cached --patch --minimal >> "$output_file"

echo "All diffs saved to $output_file"