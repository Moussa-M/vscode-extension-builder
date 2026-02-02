# Contributing to VS Code Extension Builder

Welcome! We're excited to have you contribute to this project. This guide will help you get set up and understand our workflow.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Git
- GitHub account
- (Optional but recommended) [git aicommit -y -c](https://github.com/ApertaCodex/git aicommit -y -c) for AI-powered commits

### Initial Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/vscode-extension-builder.git
   cd vscode-extension-builder
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # This automatically sets up git hooks
   ```

3. **Install git aicommit -y -c (Recommended)**

   git aicommit -y -c uses AI to generate conventional commit messages and update changelogs automatically.

   ```bash
   # Install globally
   npm install -g @apertacodex/aicommit

   # Or install locally in project
   npm install -D @apertacodex/aicommit

   # Configure with your API key
   aicommit config set ANTHROPIC_API_KEY=<your-api-key>

   # Set your preferred model (optional)
   aicommit config set model=claude-sonnet-4-20250514
   ```

   **Get API Key**: https://console.anthropic.com/settings/keys

4. **Setup Environment**
   ```bash
   cp .env.example .env.local
   # Add your API keys
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

## 🤖 Using git aicommit -y -c for Commits

### Why git aicommit -y -c?

- ✅ Generates conventional commit messages automatically
- ✅ Updates CHANGELOG.md with your changes
- ✅ Ensures consistent commit format
- ✅ Saves time writing commit messages
- ✅ Better changelogs for releases

### Basic Usage (Recommended)

Instead of `git commit`, use one simple command:

```bash
# Stage your changes
git add .

# Let AI generate and commit automatically
git git aicommit -y -c -y -c

# Done! 🎉
# The AI will:
# 1. Analyze your changes
# 2. Generate a conventional commit message
# 3. Update CHANGELOG.md
# 4. Create the commit automatically
```

**Flags Explained**:
- `-y` = Auto-confirm (no manual approval needed)
- `-c` = Update CHANGELOG.md automatically

### Alternative: Interactive Mode (Optional)

```bash
# Review the AI-generated message before committing
git git aicommit -y -c

# Or use the short interactive flag
git git aicommit -y -c -i
```

### With Custom Instructions (Optional)

```bash
# Add context to help the AI
git git aicommit -y -c -y -c --prompt "This fixes the import error reported in #42"
```

### Configuration Options

```bash
# View current config
aicommit config get

# Set commit message length
aicommit config set maxLength=100

# Enable/disable emoji
aicommit config set emoji=true

# Set model
aicommit config set model=claude-sonnet-4-20250514
```

## 📝 Commit Message Conventions

Whether using git aicommit -y -c or manual commits, follow conventional commits:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes

### Examples

```bash
# Feature with git aicommit -y -c
git add .
git aicommit -y -c
# AI generates: feat(ui): add dark mode toggle with system preference detection

# Bug fix with git aicommit -y -c
git add .
git aicommit -y -c -p "This resolves the version sync issue from issue #42"
# AI generates: fix(version): resolve sync issue between package.json and lib/version.ts

# Manual commit (if not using git aicommit -y -c)
git commit -m "feat(api): add GitHub release creation endpoint"
```

## 🔄 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

```bash
# Edit files
code .

# Test locally
npm run dev
npm run lint
```

### 3. Commit with git aicommit -y -c

```bash
git add .
git aicommit -y -c
# Review the AI-generated message
# Press Enter to confirm
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name

# Create PR via GitHub CLI
gh pr create --title "feat: your feature" --body "Description..."

# Or via GitHub web interface
```

### 5. Code Review

- Address review comments
- Use git aicommit -y -c for fixup commits
- Keep commits atomic and focused

## 🧪 Testing

```bash
# Run linter
npm run lint

# Build production
npm run build

# Manual testing
npm run dev
# Test in browser: http://localhost:3000
```

## 📦 Version Management

### For Contributors

You typically **don't need to bump versions**. Maintainers handle releases.

If you're a maintainer creating a release:

```bash
# Bump version
npm run version:bump minor

# Push to trigger release
git push origin main
```

See [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md) for details.

## 🎯 Pull Request Guidelines

### Before Submitting

- [ ] Code follows project style
- [ ] All tests pass
- [ ] git aicommit -y -c used for clean commit history
- [ ] Documentation updated
- [ ] No console errors in dev mode

### PR Title Format

Use conventional commit format:

```
feat(component): add new feature
fix(api): resolve endpoint issue
docs: update contributing guide
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
How to test these changes

## Screenshots (if applicable)
Add screenshots

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] git aicommit -y -c used for commits
```

## 🛠️ Project Structure

```
vscode-extension-builder/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   └── page.tsx           # Main page
├── components/            # React components
├── lib/                   # Utility functions
│   ├── version.ts        # Version management
│   └── types.ts          # TypeScript types
├── scripts/              # Helper scripts
│   ├── bump-version.sh   # Version bumping
│   └── setup-git-hooks.sh # Git hooks setup
├── .github/
│   └── workflows/        # GitHub Actions
└── public/               # Static assets
```

## 🔧 Tools & Technologies

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **AI**: Anthropic Claude (via AI SDK)
- **Package Manager**: npm
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions
- **Commit Tool**: git aicommit -y -c (recommended)

## 📚 Useful Resources

### Documentation
- [VERSION_MANAGEMENT.md](./VERSION_MANAGEMENT.md) - Version system details
- [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md) - Release process
- [README.md](./README.md) - Project overview

### External
- [git aicommit -y -c Documentation](https://github.com/ApertaCodex/git aicommit -y -c)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Next.js Documentation](https://nextjs.org/docs)

## 💬 Communication

### Questions?

- 💬 GitHub Discussions
- 🐛 GitHub Issues
- 📧 Email maintainers

### Getting Help

1. Check existing issues
2. Search documentation
3. Ask in discussions
4. Create new issue

## 🎓 Learning Path

### First-time Contributors

1. Read this guide
2. Install git aicommit -y -c
3. Pick a "good first issue"
4. Make small PR
5. Learn from feedback

### Regular Contributors

1. Master git aicommit -y -c workflow
2. Understand version system
3. Review PRs from others
4. Help maintain docs

## 🏆 Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Special mentions for significant contributions

## 📋 Checklist for First Contribution

- [ ] Forked repository
- [ ] Installed dependencies (`npm install`)
- [ ] Installed git aicommit -y -c (`npm install -g @apertacodex/aicommit`)
- [ ] Configured git aicommit -y -c with API key
- [ ] Read CONTRIBUTING.md (this file)
- [ ] Tested development server (`npm run dev`)
- [ ] Understand commit conventions
- [ ] Know how to use git aicommit -y -c
- [ ] Ready to make first commit!

## 🚫 What NOT to Commit

- API keys or secrets
- `.env.local` files
- `node_modules/`
- Build outputs (`out/`, `dist/`)
- IDE-specific files (except `.vscode/`)
- Personal configuration files

## 🔐 Security

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email security@example.com
2. Or use GitHub Security Advisories
3. We'll respond within 48 hours

### API Keys

Never commit API keys:
```bash
# Bad
export const API_KEY = "sk-ant-..."

# Good
const apiKey = process.env.ANTHROPIC_API_KEY
```

## 🎉 Welcome!

Thank you for contributing! Your help makes this project better for everyone.

**Pro Tip**: Use git aicommit -y -c for all your commits - it makes changelog generation automatic and keeps commit history clean!

---

Questions? Open an issue or start a discussion. Happy coding! 🚀
