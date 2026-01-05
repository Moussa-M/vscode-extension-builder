import type { Template } from "./types"

export const makefile = `.PHONY: build patch-version install clean publish

all: build

build: patch-version
	npm run compile && vsce package

patch-version:
	@echo "Patching version..."
	@python3 -c "import json; data=json.load(open('package.json')); v=data['version'].split('.'); v[2]=str(int(v[2])+1); data['version']='.'.join(v); json.dump(data, open('package.json', 'w'), indent=4)"

install: build
	@echo "Installing extension..."
	@command -v code >/dev/null 2>&1 && code --install-extension ./*.vsix --force || true
	@command -v cursor >/dev/null 2>&1 && cursor --install-extension ./*.vsix --force || true

publish: build
	vsce publish

clean:
	rm -f ./*.vsix
	rm -rf ./out
`

const MAKEFILE_CONTENT = makefile

export const templates: Template[] = [
  {
    id: "scratch",
    name: "Start from Scratch",
    description: "Use AI to generate a completely custom extension from your description",
    icon: "✨",
    tags: ["AI", "Custom", "Flexible"],
    defaultConfig: {},
    boilerplate: {},
    suggestedConfig: {
      name: "my-extension",
      displayName: "My Extension",
      description: "Describe your extension to the AI generator...",
      publisher: "your-publisher",
      category: "Other",
    },
    suggestedLogo: {
      variant: "marble",
      palette: 0,
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
        commands: [{ command: "extension.helloWorld", title: "Hello World" }],
      },
    },
    boilerplate: {
      "src/extension.ts": `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension is now active!');
  
  const helloCommand = vscode.commands.registerCommand('extension.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World!');
  });
  
  context.subscriptions.push(helloCommand);
}

export function deactivate() {}`,
      "tsconfig.json": `{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Node16"
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

## Usage

1. Open Command Palette (Ctrl+Shift+P)
2. Type "Hello World"
3. Press Enter`,
      Makefile: MAKEFILE_CONTENT,
    },
    suggestedConfig: {
      name: "quick-commands",
      displayName: "Quick Commands",
      description: "A collection of useful VS Code commands",
      publisher: "your-publisher",
      category: "Other",
    },
    suggestedLogo: {
      variant: "beam",
      palette: 0,
    },
  },
  {
    id: "theme",
    name: "Color Theme",
    description: "Design beautiful color themes for the editor",
    icon: "🎨",
    tags: ["Themes", "Colors", "Customization"],
    defaultConfig: {
      activationEvents: [],
      contributes: {
        themes: [{ label: "My Theme", uiTheme: "vs-dark", path: "./themes/my-theme.json" }],
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
    "sideBar.background": "#1a1a2e",
    "statusBar.background": "#0f3460"
  },
  "tokenColors": [
    { "scope": "comment", "settings": { "foreground": "#6a6a8a", "fontStyle": "italic" } },
    { "scope": "string", "settings": { "foreground": "#a7e9af" } },
    { "scope": "keyword", "settings": { "foreground": "#e94560" } },
    { "scope": "entity.name.function", "settings": { "foreground": "#00d9ff" } }
  ]
}`,
      "README.md": `# My Theme

A beautiful dark theme for VS Code.

## Installation

1. Install the extension
2. Go to File > Preferences > Color Theme
3. Select "My Theme"`,
      Makefile: MAKEFILE_CONTENT,
    },
    suggestedConfig: {
      name: "midnight-aurora-theme",
      displayName: "Midnight Aurora Theme",
      description: "A stunning dark theme with vibrant accent colors",
      publisher: "your-publisher",
      category: "Themes",
    },
    suggestedLogo: {
      variant: "sunset",
      palette: 2,
    },
  },
  {
    id: "snippets",
    name: "Snippets Collection",
    description: "Create reusable code snippets for any language",
    icon: "📝",
    tags: ["Snippets", "Productivity", "Code"],
    defaultConfig: {
      activationEvents: [],
      contributes: {
        snippets: [
          { language: "typescript", path: "./snippets/typescript.json" },
          { language: "javascript", path: "./snippets/javascript.json" },
        ],
      },
    },
    boilerplate: {
      "snippets/typescript.json": `{
  "React Component": {
    "prefix": "rfc",
    "body": ["export const $1 = () => {", "  return <div>$0</div>", "}"],
    "description": "React functional component"
  },
  "Console Log": {
    "prefix": "clg",
    "body": ["console.log('$1:', $2);"],
    "description": "Console log"
  }
}`,
      "snippets/javascript.json": `{
  "Arrow Function": {
    "prefix": "af",
    "body": ["const $1 = ($2) => {", "  $0", "};"],
    "description": "Arrow function"
  },
  "Try Catch": {
    "prefix": "tc",
    "body": ["try {", "  $1", "} catch (error) {", "  console.error(error);", "}"],
    "description": "Try catch block"
  }
}`,
      "README.md": `# Code Snippets Extension

Useful code snippets for TypeScript and JavaScript.

## Snippets

- \`rfc\` - React Component
- \`clg\` - Console Log
- \`af\` - Arrow Function
- \`tc\` - Try Catch`,
      Makefile: MAKEFILE_CONTENT,
    },
    suggestedConfig: {
      name: "pro-snippets",
      displayName: "Pro Snippets",
      description: "Professional code snippets for TypeScript and JavaScript",
      publisher: "your-publisher",
      category: "Snippets",
    },
    suggestedLogo: {
      variant: "pixel",
      palette: 4,
    },
  },
  {
    id: "webview",
    name: "Webview Panel",
    description: "Build rich UI panels with HTML, CSS, and JavaScript",
    icon: "🖼️",
    tags: ["Webview", "UI", "Interactive"],
    defaultConfig: {
      activationEvents: ["onCommand:extension.openWebview"],
      contributes: {
        commands: [{ command: "extension.openWebview", title: "Open Panel" }],
      },
    },
    boilerplate: {
      "src/extension.ts": `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const openWebviewCommand = vscode.commands.registerCommand('extension.openWebview', () => {
    const panel = vscode.window.createWebviewPanel(
      'customWebview',
      'Custom Panel',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    
    panel.webview.html = getWebviewContent();
  });
  
  context.subscriptions.push(openWebviewCommand);
}

function getWebviewContent() {
  return \`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Custom Panel</h1>
  <button onclick="alert('Hello!')">Click Me</button>
</body>
</html>\`;
}

export function deactivate() {}`,
      "tsconfig.json": `{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Node16"
  },
  "exclude": ["node_modules"]
}`,
      "README.md": `# Webview Panel Extension

A VS Code extension with a custom webview panel.

## Usage

1. Open Command Palette
2. Run "Open Panel"`,
      Makefile: MAKEFILE_CONTENT,
    },
    suggestedConfig: {
      name: "dashboard-panel",
      displayName: "Dashboard Panel",
      description: "A customizable dashboard panel for VS Code",
      publisher: "your-publisher",
      category: "Other",
    },
    suggestedLogo: {
      variant: "bauhaus",
      palette: 6,
    },
  },
  {
    id: "language",
    name: "Language Support",
    description: "Add syntax highlighting and language features",
    icon: "📚",
    tags: ["Language", "Syntax", "Grammar"],
    defaultConfig: {
      activationEvents: ["onLanguage:mylang"],
      contributes: {
        languages: [{ id: "mylang", aliases: ["My Language"], extensions: [".mylang"] }],
        grammars: [{ language: "mylang", scopeName: "source.mylang", path: "./syntaxes/mylang.tmLanguage.json" }],
      },
    },
    boilerplate: {
      "syntaxes/mylang.tmLanguage.json": `{
  "name": "My Language",
  "scopeName": "source.mylang",
  "patterns": [
    { "name": "comment.line", "match": "//.*$" },
    { "name": "string.quoted", "begin": "\\"", "end": "\\"" },
    { "name": "keyword.control", "match": "\\\\b(if|else|while|for|return)\\\\b" }
  ]
}`,
      "README.md": `# My Language Support

Syntax highlighting for .mylang files.`,
      Makefile: MAKEFILE_CONTENT,
    },
    suggestedConfig: {
      name: "custom-lang-support",
      displayName: "Custom Language Support",
      description: "Syntax highlighting for custom file types",
      publisher: "your-publisher",
      category: "Programming Languages",
    },
    suggestedLogo: {
      variant: "ring",
      palette: 3,
    },
  },
  {
    id: "ai-powered",
    name: "AI-Powered Extension",
    description: "Build extensions with AI capabilities using LLM APIs",
    icon: "🤖",
    tags: ["AI", "LLM", "Automation"],
    defaultConfig: {
      activationEvents: ["onCommand:extension.aiAssist"],
      contributes: {
        commands: [{ command: "extension.aiAssist", title: "AI Assist" }],
        configuration: {
          title: "AI Extension",
          properties: {
            "aiExtension.apiKey": { type: "string", default: "", description: "API Key" },
          },
        },
      },
    },
    boilerplate: {
      "src/extension.ts": `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const aiCommand = vscode.commands.registerCommand('extension.aiAssist', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const selection = editor.document.getText(editor.selection);
    if (!selection) {
      vscode.window.showWarningMessage('Please select some code');
      return;
    }
    
    const config = vscode.workspace.getConfiguration('aiExtension');
    const apiKey = config.get<string>('apiKey');
    
    if (!apiKey) {
      vscode.window.showErrorMessage('Please configure your API key');
      return;
    }
    
    vscode.window.showInformationMessage('AI processing: ' + selection.substring(0, 50) + '...');
  });
  
  context.subscriptions.push(aiCommand);
}

export function deactivate() {}`,
      "tsconfig.json": `{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Node16"
  },
  "exclude": ["node_modules"]
}`,
      "README.md": `# AI-Powered Extension

VS Code extension with AI assistance.

## Setup

1. Get an API key
2. Go to Settings > AI Extension
3. Enter your API key`,
      Makefile: MAKEFILE_CONTENT,
    },
    suggestedConfig: {
      name: "code-ai-assistant",
      displayName: "Code AI Assistant",
      description: "AI-powered code assistance",
      publisher: "your-publisher",
      category: "Machine Learning",
    },
    suggestedLogo: {
      variant: "marble",
      palette: 6,
    },
  },
]

export const scratchTemplate = templates.find((t) => t.id === "scratch")!
