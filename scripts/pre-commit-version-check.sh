#!/bin/bash

# Pre-commit hook to ensure version consistency
# This prevents commits where lib/version.ts and package.json versions don't match

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Extract version from lib/version.ts
LIB_VERSION=$(grep 'export const APP_VERSION' lib/version.ts | sed -E 's/.*"([^"]+)".*/\1/')

# Extract version from package.json
PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null)

if [ -z "$LIB_VERSION" ] || [ -z "$PKG_VERSION" ]; then
    echo -e "${RED}Error: Could not extract versions${NC}"
    exit 1
fi

if [ "$LIB_VERSION" != "$PKG_VERSION" ]; then
    echo -e "${RED}✗ Version mismatch detected!${NC}"
    echo -e "  lib/version.ts: ${YELLOW}$LIB_VERSION${NC}"
    echo -e "  package.json:   ${YELLOW}$PKG_VERSION${NC}"
    echo ""
    echo -e "${YELLOW}Please sync versions before committing:${NC}"
    echo -e "  1. Run: ${GREEN}./scripts/bump-version.sh $LIB_VERSION${NC}"
    echo -e "  2. Or manually update package.json to match lib/version.ts"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Version check passed: ${GREEN}$LIB_VERSION${NC}"
exit 0
