"use client"

import type { Template } from "./types"

export const makefile = `.PHONY: build patch-version install install-code install-code-insiders install-windsurf install-cursor install-code-server clean publish

# Default target
all: build

# Patch version and build
build: patch-version
	npm run compile && vsce package

# Patch version number
patch-version:
	@echo "Patching version..."
	@python3 -c "import json; import sys; data=json.load(open('package.json')); v=data['version'].split('.'); v[2]=str(int(v[2])+1); data['version']='.'.join(v); json.dump(data, open('package.json', 'w'), indent=4)"

# Install extension in all VS Code instances
install: build
	@echo "Installing extension..."
	@if command -v code-insiders >/dev/null 2>&1; then \\
		echo "Installing to VS Code Insiders..."; \\
		code-insiders --install-extension ./*.vsix --force; \\
	fi
	@if command -v code >/dev/null 2>&1; then \\
		echo "Installing to VS Code..."; \\
		code --install-extension ./*.vsix --force; \\
	fi
	@if command -v windsurf >/dev/null 2>&1; then \\
		echo "Installing to Windsurf..."; \\
		windsurf --install-extension ./*.vsix --force; \\
	fi
	@if command -v cursor >/dev/null 2>&1; then \\
		echo "Installing to Cursor..."; \\
		cursor --install-extension ./*.vsix --force; \\
	fi
	@if command -v code-server >/dev/null 2>&1; then \\
		echo "Installing to code-server..."; \\
		code-server --install-extension ./*.vsix --force; \\
	fi
	@echo "Extension installation completed for available IDEs"

# Install to specific IDE
install-code-insiders: build
	@echo "Installing to VS Code Insiders..."
	code-insiders --install-extension ./*.vsix --force

install-code: build
	@echo "Installing to VS Code..."
	code --install-extension ./*.vsix --force

install-windsurf: build
	@echo "Installing to Windsurf..."
	windsurf --install-extension ./*.vsix --force

install-cursor: build
	@echo "Installing to Cursor..."
	cursor --install-extension ./*.vsix --force

install-code-server: build
	@echo "Installing to code-server..."
	code-server --install-extension ./*.vsix --force

# Publish to VS Code Marketplace
publish: build
	@echo "Publishing extension to VS Code Marketplace..."
	vsce publish
	@echo "Extension published successfully"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f ./*.vsix
	rm -rf ./out
	@echo "Clean completed"

# Help
help:
	@echo "Available targets:"
	@echo "  build                  - Patch version and build extension"
	@echo "  patch-version          - Increment patch version number"
	@echo "  install                - Build and install in all available IDEs"
	@echo "                          (VS Code, VS Code Insiders, Windsurf, Cursor, code-server)"
	@echo "  install-code           - Build and install to VS Code only"
	@echo "  install-code-insiders  - Build and install to VS Code Insiders only"
	@echo "  install-windsurf       - Build and install to Windsurf only"
	@echo "  install-cursor         - Build and install to Cursor only"
	@echo "  install-code-server    - Build and install to code-server only"
	@echo "  publish                - Build and publish to VS Code Marketplace"
	@echo "  clean                  - Remove build artifacts"
	@echo "  help                   - Show this help message"
`

export const templates: Template[] = [
  {
    id: "scratch",
    name: "Start from Scratch",
    description: "Use AI to generate a completely custom extension from your description",
    icon: "✨",
    tags: ["AI", "Custom", "Flexible"],
    defaultConfig: {
      activationEvents: [],
      contributes: {},
    },
    boilerplate: {},
    suggestedConfig: {
      name: "my-extension",
      displayName: "My Extension",
      description: "Describe your extension to the AI generator...",
      publisher: "your-publisher",
      category: "Other",
    },
  },
  {
    id: "command",
    name: "Command Extension",
    description: "Create commands that users can run from the command palette",
    icon: "⌘",
    tags: ["Commands", "Keybindings", "Menus"],
    defaultConfig: {
      activationEvents: ["onCommand:extension.helloWorld"],
      contributes: {
        commands: [
          {
            command: "extension.helloWorld",
            title: "Hello World",
          },
        ],
      },
    },
    boilerplate: {
      "src/extension.ts": `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "command-extension" is now active!');

  const helloCommand = vscode.commands.registerCommand('extension.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Command Extension!');
  });

  context.subscriptions.push(helloCommand);
}

export function deactivate() {}`,
      "tsconfig.json": `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}`,
      ".vscode/launch.json": `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=\${workspaceFolder}"],
      "outFiles": ["\${workspaceFolder}/out/**/*.js"]
    }
  ]
}`,
      "README.md": `# Command Extension

A VS Code extension that adds custom commands.

## Features

- Hello World command accessible from Command Palette

## Usage

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Hello World"
3. Press Enter`,
      Makefile: makefile,
    },
    suggestedConfig: {
      name: "command-helper",
      displayName: "Command Helper",
      description: "Adds powerful commands to your VS Code workflow",
      publisher: "your-publisher",
      category: "Other",
    },
  },
  {
    id: "theme",
    name: "Color Theme",
    description: "Design a custom color theme for the editor",
    icon: "🎨",
    tags: ["Theme", "Colors", "UI"],
    defaultConfig: {
      activationEvents: [],
      contributes: {
        themes: [
          {
            label: "My Theme",
            uiTheme: "vs-dark",
            path: "./themes/my-theme.json",
          },
        ],
      },
    },
    boilerplate: {
      "themes/my-theme.json": `{
  "name": "My Theme",
  "type": "dark",
  "colors": {
    "editor.background": "#1a1a2e",
    "editor.foreground": "#eaeaea",
    "activityBar.background": "#16213e",
    "activityBar.foreground": "#e94560",
    "sideBar.background": "#1a1a2e",
    "sideBar.foreground": "#eaeaea",
    "statusBar.background": "#0f3460",
    "statusBar.foreground": "#eaeaea",
    "titleBar.activeBackground": "#16213e",
    "titleBar.activeForeground": "#eaeaea",
    "tab.activeBackground": "#1a1a2e",
    "tab.inactiveBackground": "#16213e",
    "terminal.background": "#1a1a2e",
    "terminal.foreground": "#eaeaea"
  },
  "tokenColors": [
    {
      "scope": ["comment", "punctuation.definition.comment"],
      "settings": { "foreground": "#6a6a8a", "fontStyle": "italic" }
    },
    {
      "scope": ["string", "string.quoted"],
      "settings": { "foreground": "#a7e9af" }
    },
    {
      "scope": ["constant.numeric", "constant.language"],
      "settings": { "foreground": "#f9b4ab" }
    },
    {
      "scope": ["keyword", "storage.type", "storage.modifier"],
      "settings": { "foreground": "#e94560" }
    },
    {
      "scope": ["entity.name.function", "support.function"],
      "settings": { "foreground": "#00d9ff" }
    },
    {
      "scope": ["entity.name.type", "entity.name.class"],
      "settings": { "foreground": "#ffd369" }
    },
    {
      "scope": ["variable", "variable.other"],
      "settings": { "foreground": "#eaeaea" }
    }
  ]
}`,
      "README.md": `# My Theme

A beautiful dark theme for VS Code.

## Installation

1. Install the extension
2. Go to File > Preferences > Color Theme
3. Select "My Theme"`,
      Makefile: makefile,
    },
    suggestedConfig: {
      name: "midnight-aurora-theme",
      displayName: "Midnight Aurora Theme",
      description: "A stunning dark theme with vibrant accent colors inspired by the northern lights",
      publisher: "your-publisher",
      category: "Themes",
    },
  },
  {
    id: "snippets",
    name: "Code Snippets",
    description: "Create reusable code snippets for any language",
    icon: "📝",
    tags: ["Snippets", "Productivity", "Templates"],
    defaultConfig: {
      activationEvents: [],
      contributes: {
        snippets: [
          {
            language: "typescript",
            path: "./snippets/typescript.json",
          },
          {
            language: "javascript",
            path: "./snippets/javascript.json",
          },
        ],
      },
    },
    boilerplate: {
      "snippets/typescript.json": `{
  "React Functional Component": {
    "prefix": "rfc",
    "body": [
      "import React from 'react';",
      "",
      "interface \${1:ComponentName}Props {",
      "  $2",
      "}",
      "",
      "export const \${1:ComponentName}: React.FC<\${1:ComponentName}Props> = ({ $3 }) => {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "};",
      ""
    ],
    "description": "Create a React functional component with TypeScript"
  },
  "useState Hook": {
    "prefix": "ush",
    "body": [
      "const [\${1:state}, set\${1/(.*)/$\{1:/capitalize}/}] = useState<\${2:type}>(\${3:initialValue});"
    ],
    "description": "Create a useState hook with TypeScript"
  },
  "useEffect Hook": {
    "prefix": "ueh",
    "body": [
      "useEffect(() => {",
      "  $1",
      "",
      "  return () => {",
      "    $2",
      "  };",
      "}, [\${3:dependencies}]);"
    ],
    "description": "Create a useEffect hook with cleanup"
  },
  "Async Function": {
    "prefix": "afn",
    "body": [
      "async function \${1:functionName}(\${2:params}): Promise<\${3:ReturnType}> {",
      "  try {",
      "    $0",
      "  } catch (error) {",
      "    console.error('Error in \${1:functionName}:', error);",
      "    throw error;",
      "  }",
      "}"
    ],
    "description": "Create an async function with error handling"
  }
}`,
      "snippets/javascript.json": `{
  "Console Log": {
    "prefix": "clg",
    "body": ["console.log('\${1:label}:', \${2:value});"],
    "description": "Console log with label"
  },
  "Arrow Function": {
    "prefix": "af",
    "body": ["const \${1:name} = (\${2:params}) => {", "  $0", "};"],
    "description": "Create an arrow function"
  },
  "Try Catch": {
    "prefix": "tc",
    "body": [
      "try {",
      "  $1",
      "} catch (error) {",
      "  console.error(error);",
      "  $0",
      "}"
    ],
    "description": "Try catch block"
  },
  "Import": {
    "prefix": "imp",
    "body": ["import { $2 } from '\${1:module}';"],
    "description": "Import statement"
  }
}`,
      "README.md": `# Code Snippets Extension

A collection of useful code snippets for TypeScript and JavaScript.

## Snippets

### TypeScript
- \`rfc\` - React Functional Component
- \`ush\` - useState Hook
- \`ueh\` - useEffect Hook
- \`afn\` - Async Function

### JavaScript
- \`clg\` - Console Log
- \`af\` - Arrow Function
- \`tc\` - Try Catch
- \`imp\` - Import Statement`,
      Makefile: makefile,
    },
    suggestedConfig: {
      name: "react-ts-snippets",
      displayName: "React TypeScript Snippets",
      description: "Essential React and TypeScript snippets for faster development",
      publisher: "your-publisher",
      category: "Snippets",
    },
  },
  {
    id: "webview",
    name: "Webview Panel",
    description: "Build custom UI panels with HTML/CSS/JS",
    icon: "🖼️",
    tags: ["Webview", "UI", "Custom Panel"],
    defaultConfig: {
      activationEvents: ["onCommand:extension.openWebview"],
      contributes: {
        commands: [
          {
            command: "extension.openWebview",
            title: "Open Custom Panel",
          },
        ],
      },
    },
    boilerplate: {
      "src/extension.ts": `import * as vscode from 'vscode';
import { WebviewPanel } from './webview/panel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Webview extension is now active!');

  const openWebviewCommand = vscode.commands.registerCommand(
    'extension.openWebview',
    () => {
      WebviewPanel.createOrShow(context.extensionUri);
    }
  );

  context.subscriptions.push(openWebviewCommand);

  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(WebviewPanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
        WebviewPanel.revive(webviewPanel, context.extensionUri);
      }
    });
  }
}

export function deactivate() {}`,
      "src/webview/panel.ts": `import * as vscode from 'vscode';
import { getWebviewContent } from './content';

export class WebviewPanel {
  public static currentPanel: WebviewPanel | undefined;
  public static readonly viewType = 'customWebview';
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WebviewPanel.currentPanel) {
      WebviewPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      WebviewPanel.viewType,
      'Custom Panel',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    WebviewPanel.currentPanel = new WebviewPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    WebviewPanel.currentPanel = new WebviewPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'alert':
            vscode.window.showInformationMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    WebviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }

  private _update() {
    this._panel.webview.html = getWebviewContent(this._panel.webview, this._extensionUri);
  }
}`,
      "src/webview/content.ts": `import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custom Panel</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 {
      color: var(--vscode-textLink-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 10px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 16px;
      border-radius: 4px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <h1>Welcome to Custom Panel</h1>
  <div class="card">
    <p>This is a custom webview panel built with HTML, CSS, and JavaScript.</p>
    <button onclick="sendMessage()">Click Me</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function sendMessage() {
      vscode.postMessage({ command: 'alert', text: 'Button clicked!' });
    }
  </script>
</body>
</html>\`;
}`,
      "tsconfig.json": `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}`,
      "README.md": `# Webview Panel Extension

A VS Code extension with a custom webview panel.

## Features

- Custom HTML/CSS/JS panel
- Two-way communication with extension
- VS Code theme integration

## Usage

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "Open Custom Panel"`,
      Makefile: makefile,
    },
    suggestedConfig: {
      name: "dashboard-panel",
      displayName: "Dashboard Panel",
      description: "A customizable dashboard panel for VS Code with rich UI components",
      publisher: "your-publisher",
      category: "Other",
    },
  },
  {
    id: "language",
    name: "Language Support",
    description: "Add syntax highlighting and language features",
    icon: "🌐",
    tags: ["Language", "Syntax", "Grammar"],
    defaultConfig: {
      activationEvents: ["onLanguage:mylang"],
      contributes: {
        languages: [
          {
            id: "mylang",
            aliases: ["My Language", "mylang"],
            extensions: [".mylang", ".ml"],
            configuration: "./language-configuration.json",
          },
        ],
        grammars: [
          {
            language: "mylang",
            scopeName: "source.mylang",
            path: "./syntaxes/mylang.tmLanguage.json",
          },
        ],
      },
    },
    boilerplate: {
      "language-configuration.json": `{
  "comments": {
    "lineComment": "//",
    "blockComment": ["/*", "*/"]
  },
  "brackets": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"]
  ],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" },
    { "open": "(", "close": ")" },
    { "open": "\\"", "close": "\\"" },
    { "open": "'", "close": "'" }
  ],
  "surroundingPairs": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
    ["\\"", "\\""],
    ["'", "'"]
  ],
  "folding": {
    "markers": {
      "start": "^\\\\s*//\\\\s*#?region\\\\b",
      "end": "^\\\\s*//\\\\s*#?endregion\\\\b"
    }
  },
  "indentationRules": {
    "increaseIndentPattern": "^.*\\\\{[^}]*$",
    "decreaseIndentPattern": "^\\\\s*\\\\}"
  }
}`,
      "syntaxes/mylang.tmLanguage.json": `{
  "name": "My Language",
  "scopeName": "source.mylang",
  "patterns": [
    { "include": "#comments" },
    { "include": "#strings" },
    { "include": "#keywords" },
    { "include": "#numbers" },
    { "include": "#functions" },
    { "include": "#variables" }
  ],
  "repository": {
    "comments": {
      "patterns": [
        {
          "name": "comment.line.double-slash.mylang",
          "match": "//.*$"
        },
        {
          "name": "comment.block.mylang",
          "begin": "/\\\\*",
          "end": "\\\\*/"
        }
      ]
    },
    "strings": {
      "patterns": [
        {
          "name": "string.quoted.double.mylang",
          "begin": "\\"",
          "end": "\\"",
          "patterns": [
            {
              "name": "constant.character.escape.mylang",
              "match": "\\\\\\\\."
            }
          ]
        },
        {
          "name": "string.quoted.single.mylang",
          "begin": "'",
          "end": "'"
        }
      ]
    },
    "keywords": {
      "patterns": [
        {
          "name": "keyword.control.mylang",
          "match": "\\\\b(if|else|while|for|return|break|continue)\\\\b"
        },
        {
          "name": "keyword.other.mylang",
          "match": "\\\\b(let|const|var|function|class|import|export)\\\\b"
        },
        {
          "name": "constant.language.mylang",
          "match": "\\\\b(true|false|null|undefined)\\\\b"
        }
      ]
    },
    "numbers": {
      "patterns": [
        {
          "name": "constant.numeric.mylang",
          "match": "\\\\b[0-9]+(\\\\.[0-9]+)?\\\\b"
        }
      ]
    },
    "functions": {
      "patterns": [
        {
          "name": "entity.name.function.mylang",
          "match": "\\\\b([a-zA-Z_][a-zA-Z0-9_]*)\\\\s*(?=\\\\()"
        }
      ]
    },
    "variables": {
      "patterns": [
        {
          "name": "variable.other.mylang",
          "match": "\\\\b[a-zA-Z_][a-zA-Z0-9_]*\\\\b"
        }
      ]
    }
  }
}`,
      "README.md": `# My Language Support

Adds syntax highlighting and language support for .mylang files.

## Features

- Syntax highlighting
- Bracket matching
- Auto-closing pairs
- Code folding
- Comment toggling

## File Extensions

- .mylang
- .ml`,
      Makefile: makefile,
    },
    suggestedConfig: {
      name: "custom-lang-support",
      displayName: "Custom Language Support",
      description: "Syntax highlighting and language features for custom file types",
      publisher: "your-publisher",
      category: "Programming Languages",
    },
  },
  {
    id: "ai-powered",
    name: "AI-Powered Extension",
    description: "Build extensions with AI/LLM capabilities",
    icon: "🤖",
    tags: ["AI", "LLM", "OpenAI", "Copilot"],
    defaultConfig: {
      activationEvents: ["onCommand:extension.aiAssist"],
      contributes: {
        commands: [
          {
            command: "extension.aiAssist",
            title: "AI Assist",
          },
        ],
        configuration: {
          title: "AI Extension",
          properties: {
            "aiExtension.apiKey": {
              type: "string",
              default: "",
              description: "API Key for AI service",
            },
            "aiExtension.model": {
              type: "string",
              default: "gpt-4",
              enum: ["gpt-4", "gpt-3.5-turbo", "claude-3"],
              description: "AI model to use",
            },
          },
        },
      },
    },
    boilerplate: {
      "src/extension.ts": `import * as vscode from 'vscode';
import { AIService } from './services/ai-service';

let aiService: AIService;

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Extension is now active!');

  aiService = new AIService();

  const aiAssistCommand = vscode.commands.registerCommand(
    'extension.aiAssist',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (!selectedText) {
        vscode.window.showWarningMessage('Please select some code first');
        return;
      }

      const action = await vscode.window.showQuickPick(
        ['Explain', 'Refactor', 'Add Comments', 'Find Bugs', 'Optimize'],
        { placeHolder: 'What would you like AI to do?' }
      );

      if (!action) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: \`AI is \${action.toLowerCase()}ing your code...\`,
          cancellable: false
        },
        async () => {
          try {
            const result = await aiService.processCode(selectedText, action);
            
            if (action === 'Explain') {
              const doc = await vscode.workspace.openTextDocument({
                content: result,
                language: 'markdown'
              });
              await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            } else {
              await editor.edit(editBuilder => {
                editBuilder.replace(selection, result);
              });
            }
          } catch (error) {
            vscode.window.showErrorMessage(\`AI Error: \${error}\`);
          }
        }
      );
    }
  );

  context.subscriptions.push(aiAssistCommand);
}

export function deactivate() {}`,
      "src/services/ai-service.ts": `import * as vscode from 'vscode';

export class AIService {
  private apiKey: string = '';
  private model: string = 'gpt-4';

  constructor() {
    this.loadConfiguration();
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('aiExtension')) {
        this.loadConfiguration();
      }
    });
  }

  private loadConfiguration() {
    const config = vscode.workspace.getConfiguration('aiExtension');
    this.apiKey = config.get('apiKey', '');
    this.model = config.get('model', 'gpt-4');
  }

  async processCode(code: string, action: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Please configure your API key in settings');
    }

    const prompts: Record<string, string> = {
      'Explain': 'Explain this code in detail:',
      'Refactor': 'Refactor this code to be cleaner and more efficient:',
      'Add Comments': 'Add detailed comments to this code:',
      'Find Bugs': 'Find potential bugs in this code and fix them:',
      'Optimize': 'Optimize this code for better performance:'
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.apiKey}\`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: \`\${prompts[action]}\\n\\n\${code}\` }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(\`API request failed: \${response.statusText}\`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content || 'No response from AI';
  }
}`,
      "tsconfig.json": `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}`,
      ".vscode/launch.json": `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=\${workspaceFolder}"],
      "outFiles": ["\${workspaceFolder}/out/**/*.js"]
    }
  ]
}`,
      "README.md": `# AI-Powered Extension

A VS Code extension that uses AI to assist with coding.

## Features

- **Explain**: Get detailed explanations of selected code
- **Refactor**: Automatically refactor code for better quality
- **Add Comments**: Generate meaningful comments
- **Find Bugs**: Identify and fix potential issues
- **Optimize**: Improve code performance

## Setup

1. Get an API key from OpenAI
2. Go to Settings > Extensions > AI Extension
3. Enter your API key

## Usage

1. Select code in the editor
2. Run "AI Assist" from Command Palette
3. Choose an action`,
      Makefile: makefile,
    },
    suggestedConfig: {
      name: "code-ai-assistant",
      displayName: "Code AI Assistant",
      description: "AI-powered code assistance with explanations, refactoring, and bug detection",
      publisher: "your-publisher",
      category: "Machine Learning",
    },
  },
]

export const scratchTemplate = templates.find((t) => t.id === "scratch")!
