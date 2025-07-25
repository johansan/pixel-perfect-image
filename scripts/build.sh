#!/bin/bash

# Main build script for notebook-navigator
# This script is checked into git

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project root directory
cd "$SCRIPT_DIR/.."

# Run the standard npm build
echo "Building notebook-navigator..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
    
    # Check for unused imports and variables (warning only)
    echo "Checking for unused imports..."
    UNUSED_COUNT=$(npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | grep -c "is declared but\|is defined but")
    if [ $UNUSED_COUNT -gt 0 ]; then
        echo "⚠️  Warning: Found $UNUSED_COUNT unused imports or variables"
        echo "Run 'npx tsc --noEmit --noUnusedLocals --noUnusedParameters' to see details"
    else
        echo "✅ No unused imports found"
    fi
    
    # Check for dead code with Knip (warning only)
    echo "Checking for dead code..."
    KNIP_OUTPUT=$(npx knip --no-progress 2>/dev/null)
    DEAD_FILES=$(echo "$KNIP_OUTPUT" | grep -c "^src/.*\.(ts|tsx)" || true)
    DEAD_EXPORTS=$(echo "$KNIP_OUTPUT" | grep -c "function\|class\|interface\|type\|const" || true)
    
    if [ $DEAD_FILES -gt 0 ] || [ $DEAD_EXPORTS -gt 0 ]; then
        echo "⚠️  Warning: Found dead code - $DEAD_FILES unused files, $DEAD_EXPORTS unused exports"
        echo "Run 'npx knip' to see details"
    else
        echo "✅ No dead code found"
    fi
    
    # Check if local post-build script exists and run it
    if [ -f "$SCRIPT_DIR/build-local.sh" ]; then
        echo "Running local post-build script..."
        "$SCRIPT_DIR/build-local.sh"
    fi
else
    echo "❌ Build failed"
    exit 1
fi