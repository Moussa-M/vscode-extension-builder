#!/bin/bash

# Version Bump Script
# Usage: ./scripts/bump-version.sh [major|minor|patch|VERSION]
# Examples:
#   ./scripts/bump-version.sh patch    # 0.1.0 -> 0.1.1
#   ./scripts/bump-version.sh minor    # 0.1.0 -> 0.2.0
#   ./scripts/bump-version.sh major    # 0.1.0 -> 1.0.0
#   ./scripts/bump-version.sh 1.5.0    # Set to specific version

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current version from lib/version.ts
CURRENT_VERSION=$(grep 'export const APP_VERSION' lib/version.ts | sed -E 's/.*"([^"]+)".*/\1/')

echo -e "${BLUE}Current version: ${GREEN}$CURRENT_VERSION${NC}"

# Function to increment version
increment_version() {
    local version=$1
    local type=$2

    IFS='.' read -r major minor patch <<< "$version"

    case $type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            echo -e "${RED}Invalid version type: $type${NC}"
            exit 1
            ;;
    esac

    echo "$major.$minor.$patch"
}

# Determine new version
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 [major|minor|patch|VERSION]${NC}"
    exit 1
fi

if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # Specific version provided
    NEW_VERSION="$1"
    echo -e "${YELLOW}Setting version to: ${GREEN}$NEW_VERSION${NC}"
else
    # Increment version
    NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$1")
    echo -e "${YELLOW}Bumping $1 version to: ${GREEN}$NEW_VERSION${NC}"
fi

# Validate version format
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Invalid version format: $NEW_VERSION${NC}"
    exit 1
fi

# Check if version is greater than current
IFS='.' read -r new_major new_minor new_patch <<< "$NEW_VERSION"
IFS='.' read -r cur_major cur_minor cur_patch <<< "$CURRENT_VERSION"

if [ "$new_major" -lt "$cur_major" ] || \
   ([ "$new_major" -eq "$cur_major" ] && [ "$new_minor" -lt "$cur_minor" ]) || \
   ([ "$new_major" -eq "$cur_major" ] && [ "$new_minor" -eq "$cur_minor" ] && [ "$new_patch" -lt "$cur_patch" ]); then
    echo -e "${RED}New version ($NEW_VERSION) must be greater than current version ($CURRENT_VERSION)${NC}"
    exit 1
fi

# Confirm
echo ""
echo -e "${YELLOW}This will:${NC}"
echo -e "  1. Update lib/version.ts: ${GREEN}APP_VERSION${NC} = \"${GREEN}$NEW_VERSION${NC}\""
echo -e "  2. Update package.json: ${GREEN}version${NC} = \"${GREEN}$NEW_VERSION${NC}\""
echo -e "  3. Create a git commit"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted${NC}"
    exit 0
fi

# Update lib/version.ts
echo -e "${BLUE}Updating lib/version.ts...${NC}"
sed -i.bak "s/export const APP_VERSION = \".*\"/export const APP_VERSION = \"$NEW_VERSION\"/" lib/version.ts
rm lib/version.ts.bak

# Update package.json
echo -e "${BLUE}Updating package.json...${NC}"
npm version "$NEW_VERSION" --no-git-tag-version

# Update package-lock.json
echo -e "${BLUE}Updating package-lock.json...${NC}"
npm install --package-lock-only

# Git operations
echo -e "${BLUE}Creating git commit...${NC}"

# Check if there are changes
if ! git diff --quiet lib/version.ts package.json package-lock.json 2>/dev/null; then
    git add lib/version.ts package.json package-lock.json

    # Create commit message
    COMMIT_MSG="chore: bump version to $NEW_VERSION"

    git commit -m "$COMMIT_MSG"

    echo ""
    echo -e "${GREEN}✓${NC} Version bumped to ${GREEN}$NEW_VERSION${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Review changes: ${BLUE}git show${NC}"
    echo -e "  2. Push to remote: ${BLUE}git push origin main${NC}"
    echo -e "  3. GitHub Actions will automatically:"
    echo -e "     - Create a git tag: ${GREEN}v$NEW_VERSION${NC}"
    echo -e "     - Create a GitHub release"
    echo -e "     - Generate changelog"
    echo ""
else
    echo -e "${YELLOW}No changes detected${NC}"
fi
