import { streamText } from "ai"
import type { ExtensionConfig, Template } from "@/lib/types"
import { makefile } from "@/lib/templates"

export async function POST(req: Request) {
  const { prompt, config, template, mode, existingFiles } = (await req.json()) as {
    prompt: string
    config: ExtensionConfig
    template: Template | null
    mode: "add-feature" | "generate-scratch" | "modify"
    existingFiles?: Record<string, string>
  }

  const systemPrompt = `You are a world-class VS Code extension developer with expertise in TypeScript, the VS Code Extension API, and software architecture. You create production-ready, well-documented, and thoroughly tested VS Code extensions.

=== CURRENT PROJECT CONTEXT ===
Extension Name: "${config.displayName || config.name || "My Extension"}"
Identifier: "${config.name || "my-extension"}"
Publisher: "${config.publisher || "publisher"}"
Version: "${config.version || "0.0.1"}"
Category: "${config.category || "Other"}"
Description: "${config.description || ""}"
Base Template: ${template?.name || "Custom/Blank"}
Mode: ${mode}

${
  existingFiles && Object.keys(existingFiles).length > 0
    ? `=== EXISTING PROJECT FILES ===
${Object.entries(existingFiles)
  .map(([path, content]) => `📄 ${path}:\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}`
    : "=== NO EXISTING FILES - CREATING FROM SCRATCH ==="
}

=== YOUR MISSION ===
${
  mode === "generate-scratch"
    ? `CREATE A COMPLETE VS CODE EXTENSION from scratch based on the user's description.

IMPORTANT: If the user hasn't provided a specific extension name, you MUST infer a good name from their description.
- Analyze the user's request to understand the core functionality
- Create a concise, descriptive kebab-case name (e.g., "code-snippets-manager", "git-commit-helper", "markdown-preview-plus")
- The name should be memorable, descriptive, and follow VS Code Marketplace conventions
- Also create a proper displayName (e.g., "Code Snippets Manager", "Git Commit Helper")
- Write a compelling description that explains the extension's value proposition

You MUST generate ALL of these files:
- package.json (complete with all metadata, commands, activation events, contributes)
- src/extension.ts (main entry point with activate/deactivate)
- src/*.ts (feature-specific modules, services, utilities as needed)
- tsconfig.json (proper TypeScript configuration)
- .vscodeignore (files to exclude from package)
- README.md (comprehensive documentation with features, installation, usage)
- CHANGELOG.md (initial changelog with version 0.0.1)
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
  mode === "add-feature"
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
  mode === "modify"
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

=== COMMAND NAMING CONVENTION ===
All commands MUST use this pattern: ${config.name || "myext"}.commandName
Example: ${config.name || "myext"}.helloWorld, ${config.name || "myext"}.runTask

=== PACKAGE.JSON STRUCTURE ===
Ensure package.json includes:
- name, displayName, description, version, publisher
- engines: { "vscode": "^1.85.0" }
- categories, keywords (for marketplace discoverability)
- main: "./out/extension.js"
- activationEvents (use "*" sparingly, prefer specific events)
- contributes: commands, configuration, menus, keybindings as needed
- scripts: compile, watch, package, lint
- devDependencies: @types/vscode, @types/node, typescript, @vscode/vsce

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
   - Quotes: \\\"
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

EXAMPLE of properly escaped file content:
"src/extension.ts": "import * as vscode from 'vscode';\\n\\n/**\\n * Activates the extension\\n */\\nexport function activate(context: vscode.ExtensionContext) {\\n\\tconst disposable = vscode.commands.registerCommand('myext.hello', () => {\\n\\t\\tvscode.window.showInformationMessage('Hello!');\\n\\t});\\n\\tcontext.subscriptions.push(disposable);\\n}"

Remember: The ENTIRE response must be valid JSON. Test mentally that JSON.parse() would succeed on your output.`

  try {
    const result = streamText({
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      maxTokens: 16000,
      temperature: 0.7,
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
