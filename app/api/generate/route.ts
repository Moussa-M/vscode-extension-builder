import { streamText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { ExtensionConfig, Template } from "@/lib/types"
import { makefile } from "@/lib/templates"
import { DEFAULT_EXTENSION_VERSION } from "@/lib/version"

export async function POST(req: Request) {
  const { prompt, config, template, mode, existingFiles, recoveredFiles, validationErrors, isFixAttempt, apiKey } =
    (await req.json()) as {
      prompt: string
      config?: ExtensionConfig
      template?: Template | null
      mode?: "add-feature" | "generate-scratch" | "modify"
      existingFiles?: Record<string, string>
      recoveredFiles?: Record<string, string>
      validationErrors?: Array<{ file: string; line: number; column: number; message: string }>
      isFixAttempt?: boolean
      apiKey?: string
    }
  
  // If config is not provided (e.g., for simple prompt generation), use defaults
  const safeConfig = config || {
    name: "my-extension",
    displayName: "My Extension",
    description: "",
    publisher: "publisher",
    version: DEFAULT_EXTENSION_VERSION,
    category: "Other",
  }
  
  const safeMode = mode || "generate-scratch"

  const recoveryContext =
    recoveredFiles && Object.keys(recoveredFiles).length > 0
      ? `
=== RECOVERY CONTEXT ===
The previous generation was interrupted. The following files were already generated and saved:
${Object.entries(recoveredFiles)
  .map(([path, content]) => `✅ ${path} (${content.length} chars)`)
  .join("\n")}

IMPORTANT: These files are already saved. Continue generating ONLY the remaining files.
Do NOT regenerate the files listed above unless the user specifically asks for changes.
Focus on completing any missing files that would be needed for a complete extension.
`
      : ""

  const validationContext =
    validationErrors && validationErrors.length > 0
      ? `
=== SYNTAX ERRORS TO FIX ===
The following syntax errors were detected in the generated code. You MUST fix ALL of them:

${validationErrors.map((err) => `❌ ${err.file}:${err.line}:${err.column} - ${err.message}`).join("\n")}

INSTRUCTIONS FOR FIXING:
1. Analyze each error carefully
2. Output ONLY the files that need to be fixed (not all files)
3. Ensure the fixed code has:
   - Balanced braces, brackets, and parentheses
   - Proper string escaping
   - Valid TypeScript/JSON syntax
   - No missing semicolons or commas
4. Double-check your fix before outputting

Think step by step:
1. What is the root cause of each error?
2. What specific change fixes it?
3. Are there any related issues in nearby code?
`
      : ""

  const fixAttemptPrompt = `You are a TypeScript syntax expert. Your task is to fix syntax errors in VS Code extension code.

${validationContext}

=== EXISTING FILES WITH ERRORS ===
${Object.entries(existingFiles || {})
  .filter(([path]) => validationErrors?.some((e) => e.file === path))
  .map(([path, content]) => `📄 ${path}:\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}

=== OUTPUT FORMAT ===
Respond with ONLY a valid JSON object containing the fixed files:
{
  "message": "Fixed X syntax errors in Y files",
  "files": {
    "path/to/fixed-file.ts": "...corrected content with proper escaping..."
  },
  "commands": [],
  "activationEvents": []
}

ESCAPING RULES:
- Newlines: \\n
- Tabs: \\t  
- Quotes inside strings: \\"
- Backslashes: \\\\

Output ONLY the files that needed fixes, not the entire project.`

  const mainPrompt = `You are a world-class VS Code extension developer with expertise in TypeScript, the VS Code Extension API, and software architecture. You create production-ready, well-documented, and thoroughly tested VS Code extensions.

=== PROFESSIONAL EXTENSION STRUCTURE ===
Create extensions following this proven, professional architecture:

**ACTIVATION**: Use "onStartupFinished" for extensions that need to load on startup, or specific activation events like "onCommand:*" or "onView:*" for better performance.

**SIDEBAR PANEL** (if the extension needs UI):
- Create a custom Activity Bar icon with viewsContainers
- Register tree data providers with views
- Add commands to the view/title menu for toolbar actions
- Use view/item/context menus for item actions

**COMMANDS & MENUS**:
- Register all commands in contributes.commands with icons (e.g., "$(refresh)", "$(add)", "$(database)")
- Add keybindings for frequently used commands
- Use context menus intelligently (view/title, view/item/context, explorer/context)
- Set "when" clauses to show/hide commands contextually

**CONFIGURATION**:
- Add user-configurable settings in contributes.configuration
- Use workspace.getConfiguration() to read settings
- Support both global and workspace-level configuration

**CODE ORGANIZATION**:
- src/extension.ts - Main activation logic, command registration
- src/logger.ts - Centralized logging with output channel
- src/<Feature>Manager.ts - Business logic for major features
- src/<Feature>Provider.ts - Tree data providers, custom editors
- Dynamic imports for heavy dependencies to speed up activation

=== CURRENT PROJECT CONTEXT ===
Extension Name: "${safeConfig.displayName || safeConfig.name || "My Extension"}"
Identifier: "${safeConfig.name || "my-extension"}"
Publisher: "${safeConfig.publisher || "publisher"}"
Version: "${safeConfig.version || DEFAULT_EXTENSION_VERSION}"
Category: "${safeConfig.category || "Other"}"
Description: "${safeConfig.description || ""}"
Base Template: ${template?.name || "Custom/Blank"}
Mode: ${safeMode}
${recoveryContext}
${validationContext}
${
  existingFiles && Object.keys(existingFiles).length > 0
    ? `=== EXISTING PROJECT FILES ===
${Object.entries(existingFiles)
  .map(([path, content]) => `📄 ${path}:\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}`
    : "=== NO EXISTING FILES - CREATING FROM SCRATCH ==="
}

${
  safeMode === "generate-scratch"
    ? `CREATE A COMPLETE VS CODE EXTENSION from scratch based on the user's description.

IMPORTANT: If the user hasn't provided a specific extension name, you MUST infer a good name from their description.
- Analyze the user's request to understand the core functionality
- Create a concise, descriptive kebab-case name (e.g., "code-snippets-manager", "git-commit-helper", "markdown-preview-plus")
- The name should be memorable, descriptive, and follow VS Code Marketplace conventions
- Also create a proper displayName (e.g., "Code Snippets Manager", "Git Commit Helper")
- Write a compelling description that explains the extension's value proposition

You MUST generate ALL of these files:
- package.json (complete with all metadata, commands, activation events, contributes, AND "license": "MIT")
- src/extension.ts (main entry point with activate/deactivate)
- src/*.ts (feature-specific modules, services, utilities as needed)
- tsconfig.json (proper TypeScript configuration)
- .vscodeignore (files to exclude from package)
- README.md (comprehensive documentation with features, installation, usage)
- CHANGELOG.md (initial changelog with version 0.0.1)
- LICENSE (MIT license text - REQUIRED for OpenVSX registry)
- .gitignore (standard ignores for Node.js/TypeScript)
- .vscode/launch.json (debugging configuration for extension development)
- .vscode/tasks.json (build tasks for npm scripts)
- Makefile (build, install, and publish automation - use the exact content provided below)

=== MAKEFILE CONTENT (USE EXACTLY AS-IS) ===
${makefile}

Make the extension FEATURE-RICH and PRODUCTION-READY. Add thoughtful extras that enhance user experience.
Think about edge cases, error states, and user feedback mechanisms.
Include progress indicators, status bar items, and informative notifications where appropriate.`
    : ""
}
${
  safeMode === "add-feature"
    ? `ADD A NEW FEATURE to the existing extension.
- Analyze the existing code structure carefully
- Create new files or modify existing ones as needed
- Ensure full compatibility with existing functionality
- Update package.json if new commands/settings/menus are needed
- Follow the existing code style, patterns, and naming conventions
- Add proper TypeScript types and JSDoc documentation
- Include user-facing feedback (notifications, status bar, etc.)`
    : ""
}
${
  safeMode === "modify"
    ? `MODIFY the existing extension based on the user's specific request.
- Make targeted, precise changes while preserving other functionality
- Update related files and imports as necessary
- Ensure all references, imports, and types remain valid
- Test edge cases and error handling in your changes`
    : ""
}

=== CODE QUALITY REQUIREMENTS ===
1. **TypeScript Configuration** - Use tsconfig.json with these settings:
   - "module": "commonjs" (required for VS Code extensions)
   - "target": "ES2020"
   - "moduleResolution": "node"
   - "strict": true
   - "esModuleInterop": true

2. **Imports**: Always use: import * as vscode from 'vscode'

3. **Activation Pattern**:
   - Store extensionContext globally if needed across modules
   - Use dynamic imports for heavy dependencies
   - Register all commands and disposables immediately in activate()
   - Create output channel for logging

4. **Tree Data Providers** (for sidebar views):
   - Implement vscode.TreeDataProvider<T>
   - Use EventEmitter for _onDidChangeTreeData
   - Provide refresh() method
   - Use TreeItem with contextValue for context menus

5. **Error Handling**:
   - Wrap async operations in try/catch
   - Show user-friendly error messages with vscode.window.showErrorMessage()
   - Log detailed errors to output channel
   - Never crash the extension

6. **Performance**:
   - Use "onStartupFinished" activation event when possible
   - Lazy-load heavy modules
   - Cache data when appropriate
   - Dispose resources properly

7. **User Experience**:
   - Add icons to commands (use VS Code icon IDs like "$(refresh)", "$(add)", "$(database)")
   - Show progress for long operations
   - Provide informative notifications
   - Add keyboard shortcuts for common actions
   - Use "when" clauses to show/hide commands contextually

8. **Code Organization**:
   - src/extension.ts: Main entry point, command registration
   - src/logger.ts: Centralized logging
   - src/*Manager.ts: Business logic classes
   - src/*Provider.ts: VS Code providers (TreeDataProvider, etc.)
   - Keep activate() clean and focused on registration

=== SYNTAX VALIDATION ===
CRITICAL: Your code will be validated for syntax errors. Ensure:
- All braces {}, brackets [], and parentheses () are balanced
- All strings are properly terminated
- No trailing commas in JSON
- Proper TypeScript syntax throughout
- Valid JSON in package.json and other .json files

=== COMMAND NAMING CONVENTION ===
All commands MUST use this pattern: ${safeConfig.name || "myext"}.commandName
Example: ${safeConfig.name || "myext"}.helloWorld, ${safeConfig.name || "myext"}.runTask

=== PACKAGE.JSON STRUCTURE ===
Ensure package.json includes:
- name, displayName, description, version, publisher
- license: "MIT" (REQUIRED for OpenVSX registry - do NOT omit this)
- repository: { "type": "git", "url": "https://github.com/PUBLISHER/EXT_NAME.git" }
- bugs: { "url": "https://github.com/PUBLISHER/EXT_NAME/issues" }
- homepage: "https://github.com/PUBLISHER/EXT_NAME#readme"
- engines: { "vscode": "^1.108.0" }  ← Use this version for maximum compatibility
- categories, keywords (for marketplace discoverability)
- main: "./out/extension.js"
- activationEvents: Use "onStartupFinished" for background extensions, or specific events for better performance
- contributes: Include these when relevant:
  * commands: All user-facing commands with icons
  * views: Tree views in sidebar
  * viewsContainers: Custom activity bar panels
  * menus: view/title, view/item/context, explorer/context
  * keybindings: Keyboard shortcuts with "when" clauses
  * configuration: User settings
  * customEditors: File type handlers (if needed)
  * fileAssociations: Link file extensions (if needed)
- scripts:
  * "vscode:prepublish": "npm run compile"
  * "compile": "tsc -p ./"
  * "watch": "tsc -watch -p ./"
  * "package": "vsce package"
- devDependencies:
  - "@types/vscode": "^1.108.1"
  - "@types/node": "^25.0.9"
  - "typescript": "^5.9.3"
  - "ovsx": "^0.10.8" (for Open VSX publishing)
- dependencies: Add only what's actually needed for runtime

=== CRITICAL: OUTPUT FORMAT ===
Your response MUST be a valid JSON object that can be parsed with JSON.parse().

RULES:
1. Start IMMEDIATELY with { and end with } - NO other text before or after
2. NO markdown code blocks (no \`\`\`json)
3. NO preamble text like "Here's the JSON:" 
4. NO explanation text after the JSON
5. All string values MUST have special characters escaped:
   - Newlines: \\n
   - Tabs: \\t  
   - Quotes: \\"
   - Backslashes: \\\\
   - Carriage returns: \\r

REQUIRED JSON STRUCTURE:
{
  "message": "Brief description of what was generated",
  "files": {
    "package.json": "{\\"name\\": \\"example\\", ...escaped JSON content...}",
    "src/extension.ts": "import * as vscode from 'vscode';\\n\\nexport function activate...",
    "README.md": "# Extension Name\\n\\nDescription here..."
  },
  "commands": ["command1", "command2"],
  "activationEvents": ["onCommand:ext.cmd"]
}

Remember: The ENTIRE response must be valid JSON. Test mentally that JSON.parse() would succeed on your output.`

  const systemPrompt = isFixAttempt ? fixAttemptPrompt : mainPrompt

  // Validate API key
  if (!apiKey) {
    return Response.json(
      {
        message: "API key is required. Please add your Anthropic API key in settings.",
        files: {},
        commands: [],
        activationEvents: [],
      },
      { status: 401 },
    )
  }

  // Create Anthropic client with user's API key
  const anthropic = createAnthropic({
    apiKey: apiKey,
  })

  try {
    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: isFixAttempt ? "Fix the syntax errors listed above." : prompt },
      ],
      maxTokens: 16000,
      temperature: isFixAttempt ? 0.3 : 0.7,
    } as any)

    return result.toTextStreamResponse()
  } catch (error) {
    console.error("AI generation error:", error)
    return Response.json(
      {
        message: "Failed to generate code. Please try again.",
        files: {},
        commands: [],
        activationEvents: [],
      },
      { status: 500 },
    )
  }
}
