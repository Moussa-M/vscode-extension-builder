#!/bin/bash

# Setup Git Hooks for Version Management

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Setting up Git hooks...${NC}"

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Auto-generated pre-commit hook for version management
exec ./scripts/pre-commit-version-check.sh
EOF

# Make it executable
chmod +x .git/hooks/pre-commit

echo -e "${GREEN}✓${NC} Pre-commit hook installed"
echo -e "${BLUE}The hook will verify version consistency before each commit${NC}"
echo ""
echo -e "Git hooks installed successfully!"
