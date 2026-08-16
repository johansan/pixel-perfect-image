#!/bin/bash

# Main build script for pixel-perfect-image
# This script is checked into git

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project root directory
cd "$SCRIPT_DIR/.."

# Track overall status
BUILD_WARNINGS=0
BUILD_ERRORS=0

# Step 1: Run ESLint
echo "Running ESLint..."
if command -v eslint &> /dev/null || [ -f "node_modules/.bin/eslint" ]; then
    ESLINT_OUTPUT=$(npm run lint 2>&1)
    ESLINT_STATUS=$?
    echo "$ESLINT_OUTPUT"

    # Count ESLint errors and warnings from the summary line
    ESLINT_SUMMARY=$(echo "$ESLINT_OUTPUT" | grep "✖" | grep "problem")
    if [ -n "$ESLINT_SUMMARY" ]; then
        # Extract error count
        ESLINT_ERROR_COUNT=$(echo "$ESLINT_SUMMARY" | sed -n 's/.*(\([0-9]*\) error.*/\1/p')
        if [ -z "$ESLINT_ERROR_COUNT" ]; then
            ESLINT_ERROR_COUNT=0
        fi
        
        # Extract warning count
        ESLINT_WARNING_COUNT=$(echo "$ESLINT_SUMMARY" | sed -n 's/.* \([0-9]*\) warning.*/\1/p')
        if [ -z "$ESLINT_WARNING_COUNT" ]; then
            ESLINT_WARNING_COUNT=0
        fi
        
        if [ $ESLINT_ERROR_COUNT -gt 0 ]; then
            echo "❌ ESLint found $ESLINT_ERROR_COUNT errors"
            BUILD_ERRORS=$((BUILD_ERRORS + 1))
        elif [ $ESLINT_WARNING_COUNT -gt 0 ]; then
            echo "⚠️  ESLint found $ESLINT_WARNING_COUNT warnings"
            BUILD_WARNINGS=$((BUILD_WARNINGS + 1))
        fi
    elif [ $ESLINT_STATUS -ne 0 ]; then
        echo "❌ ESLint failed"
        BUILD_ERRORS=$((BUILD_ERRORS + 1))
    else
        echo "✅ ESLint passed"
    fi
else
    echo "⚠️  ESLint not configured - skipping linting"
    BUILD_WARNINGS=$((BUILD_WARNINGS + 1))
fi

# Step 2: Run TypeScript type checking
echo -e "\nChecking TypeScript types..."
npx tsc --noEmit --skipLibCheck
TSC_STATUS=$?
if [ $TSC_STATUS -ne 0 ]; then
    echo "❌ TypeScript type checking failed"
    BUILD_ERRORS=$((BUILD_ERRORS + 1))
else
    echo "✅ TypeScript types are valid"
    
    # Check for unused imports and variables (warning only)
    echo "Checking for unused imports..."
    UNUSED_COUNT=$(npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | grep -c "is declared but\|is defined but")
    if [ $UNUSED_COUNT -gt 0 ]; then
        echo "⚠️  Warning: Found $UNUSED_COUNT unused imports or variables"
        echo "Run 'npx tsc --noEmit --noUnusedLocals --noUnusedParameters' to see details"
        BUILD_WARNINGS=$((BUILD_WARNINGS + 1))
    else
        echo "✅ No unused imports found"
    fi
fi

# Step 3: Run unit tests
echo -e "\nRunning unit tests..."
if [ -f "node_modules/.bin/vitest" ]; then
    TEST_OUTPUT=$(npm test 2>&1)
    TEST_STATUS=$?
    if [ $TEST_STATUS -ne 0 ]; then
        echo "$TEST_OUTPUT"
        echo "❌ Unit tests failed"
        BUILD_ERRORS=$((BUILD_ERRORS + 1))
    else
        TEST_COUNT=$(echo "$TEST_OUTPUT" | sed -n 's/.*Tests[[:space:]]*\([0-9]*\) passed.*/\1/p' | head -1)
        if [ -n "$TEST_COUNT" ]; then
            echo "✅ Unit tests passed ($TEST_COUNT tests)"
        else
            echo "✅ Unit tests passed"
        fi
    fi
else
    echo "ℹ️  Vitest not installed - skipping unit tests"
fi

# Step 4: Check for dead code with Knip
echo -e "\nChecking for dead code..."
if command -v knip &> /dev/null || [ -f "node_modules/.bin/knip" ]; then
    KNIP_OUTPUT=$(npx knip --no-progress 2>&1)
    KNIP_STATUS=$?

    if [ $KNIP_STATUS -ne 0 ]; then
        echo "$KNIP_OUTPUT"
        echo "❌ Knip reported dead code or failed to run"
        BUILD_ERRORS=$((BUILD_ERRORS + 1))
    else
        echo "✅ No dead code found"
    fi
else
    echo "ℹ️  Knip not installed - skipping dead code check"
fi

# Step 5: Fix formatting with Prettier
echo -e "\nChecking code formatting..."
if command -v prettier &> /dev/null || [ -f "node_modules/.bin/prettier" ]; then
    # Run prettier on the whole repo (respects .prettierignore) and capture output
    PRETTIER_OUTPUT=$(npx prettier --write . 2>&1)
    PRETTIER_STATUS=$?

    if [ $PRETTIER_STATUS -ne 0 ]; then
        echo "❌ Failed to fix code formatting"
        echo "$PRETTIER_OUTPUT"
        BUILD_ERRORS=$((BUILD_ERRORS + 1))
    else
        # Check if any files were changed
        if echo "$PRETTIER_OUTPUT" | grep -q "(unchanged)"; then
            # Count changed vs unchanged files
            CHANGED_COUNT=$(echo "$PRETTIER_OUTPUT" | grep -v "(unchanged)" | grep -E "\.(ts|tsx|js|jsx|mjs|mts|json|md|css|yml|yaml).*[0-9]+ms$" | wc -l | tr -d ' ')
            UNCHANGED_COUNT=$(echo "$PRETTIER_OUTPUT" | grep -c "(unchanged)" || true)
            
            if [ $CHANGED_COUNT -eq 0 ]; then
                echo "✅ Code formatting is already correct (all $UNCHANGED_COUNT files unchanged)"
            else
                echo "✅ Code formatting fixed ($CHANGED_COUNT files updated, $UNCHANGED_COUNT unchanged)"
            fi
        else
            # Old prettier version or different output format
            echo "✅ Code formatting complete"
        fi
    fi
else
    echo "ℹ️  Prettier not installed - skipping formatting check"
fi

# Only run the build if there are zero errors AND zero warnings
if [ $BUILD_ERRORS -eq 0 ] && [ $BUILD_WARNINGS -eq 0 ]; then
    # Run the standard npm build
    echo -e "\nBuilding pixel-perfect-image..."
    npm run build
    
    # Check if build was successful
    if [ $? -eq 0 ]; then
        echo "✅ Build completed successfully"
        
        # Verify output files exist
        if [ -f "main.js" ] && [ -f "manifest.json" ]; then
            echo "✅ Output files verified (main.js, manifest.json)"
            
            # Show file sizes
            echo -e "\nBuild output:"
            ls -lh main.js | awk '{print "  main.js: " $5}'
            
            # Check plugin manifest version matches package.json
            PACKAGE_VERSION=$(node -p "require('./package.json').version")
            MANIFEST_VERSION=$(node -p "require('./manifest.json').version")
            
            if [ "$PACKAGE_VERSION" = "$MANIFEST_VERSION" ]; then
                echo "✅ Version consistency verified ($PACKAGE_VERSION)"
            else
                echo "⚠️  Version mismatch: package.json ($PACKAGE_VERSION) vs manifest.json ($MANIFEST_VERSION)"
            fi
        else
            echo "❌ Build output files missing"
            exit 1
        fi
        
        # Check if local post-build script exists and run it
        if [ -f "$SCRIPT_DIR/build-local.sh" ]; then
            echo -e "\nRunning local post-build script..."
            "$SCRIPT_DIR/build-local.sh"
        fi
        
        # Summary
        echo -e "\n=== Build Summary ==="
        echo "✅ Build successful"
        echo "✅ No warnings"
        echo "📦 Ready for Obsidian plugin installation"
    else
        echo "❌ Build failed"
        exit 1
    fi
else
    echo -e "\n=== Build Summary ==="
    if [ $BUILD_ERRORS -gt 0 ] && [ $BUILD_WARNINGS -gt 0 ]; then
        echo "❌ Build aborted due to $BUILD_ERRORS error(s) and $BUILD_WARNINGS warning(s)"
    elif [ $BUILD_ERRORS -gt 0 ]; then
        echo "❌ Build aborted due to $BUILD_ERRORS error(s)"
    else
        echo "❌ Build aborted due to $BUILD_WARNINGS warning(s)"
    fi
    exit 1
fi