import { streamText } from "ai"
import type { ExtensionConfig, Template } from "@/lib/types"
import { makefile } from "@/lib/templates"

export async function POST(req: Request) {
  const { prompt, config, template, mode, existingFiles, recoveredFiles, validationErrors, isFixAttempt } =
    (await req.json()) as {
      prompt: string
      config?: ExtensionConfig
      template?: Template | null
      mode?: "add-feature" | "generate-scratch" | "modify"
      existingFiles?: Record<string, string>
      recoveredFiles?: Record<string, string>
      validationErrors?: Array<{ file: string; line: number; column: number; message: string }>
      isFixAttempt?: boolean
    }
  
  // If config is not provided (e.g., for simple prompt generation), use defaults
  const safeConfig = config || {
    name: "my-extension",
    displayName: "My Extension",
    description: "",
    publisher: "publisher",
    version: "0.0.1",
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

=== CURRENT PROJECT CONTEXT ===
Extension Name: "${safeConfig.displayName || safeConfig.name || "My Extension"}"
Identifier: "${safeConfig.name || "my-extension"}"
Publisher: "${safeConfig.publisher || "publisher"}"
Version: "${safeConfig.version || "0.0.1"}"
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
1. Use modern TypeScript (ES2022+) with strict typing - no 'any' types unless absolutely necessary
2. Import VS Code API correctly: import * as vscode from 'vscode'
3. Use async/await for all asynchronous operations
4. Implement comprehensive error handling with try/catch and user-friendly error messages
5. Add detailed JSDoc comments for all public functions, classes, and interfaces
6. Use meaningful, descriptive variable and function names
7. Implement proper disposal patterns (context.subscriptions.push for all disposables)
8. Follow VS Code extension best practices and design patterns
9. Include user-configurable settings where appropriate (contributes.configuration)
10. Add helpful status bar items, notifications, progress indicators, or output channels
11. Organize code into logical modules (services, utils, commands, etc.)
12. Use constants for repeated strings (command IDs, config keys, etc.)

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
- engines: { "vscode": "^1.96.0" }
- categories, keywords (for marketplace discoverability)
- main: "./out/extension.js"
- activationEvents (use "*" sparingly, prefer specific events)
- contributes: commands, configuration, menus, keybindings as needed
- scripts: compile, watch, package, lint, test
- devDependencies with LATEST versions:
  - "@types/vscode": "^1.96.0"
  - "@types/node": "^22.x"
  - "@typescript-eslint/eslint-plugin": "^8.18.0"
  - "@typescript-eslint/parser": "^8.18.0"
  - "eslint": "^9.17.0"
  - "typescript": "^5.7.0"
  - "@vscode/vsce": "^3.2.0"
  - "@vscode/test-cli": "^0.0.10"
  - "@vscode/test-electron": "^2.4.1"

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

  try {
    const result = streamText({
      model: "anthropic/sonnet-4-20250514",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: isFixAttempt ? "Fix the syntax errors listed above." : prompt },
      ],
      maxTokens: 16000,
      temperature: isFixAttempt ? 0.3 : 0.7,
    })

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
