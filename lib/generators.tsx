import type { ExtensionConfig, Template } from "./types"

export function generatePackageJson(config: ExtensionConfig, template: Template | null): string {
  const pkg = {
    name: config.name || "my-extension",
    displayName: config.displayName || "My Extension",
    description: config.description || "A VS Code extension",
    version: config.version || "0.0.1",
    publisher: config.publisher || "your-publisher",
    engines: {
      vscode: "^1.85.0",
    },
    categories: [config.category || "Other"],
    activationEvents: config.activationEvents || [],
    main: "./out/extension.js",
    contributes: config.contributes || {},
    scripts: {
      "vscode:prepublish": "npm run compile",
      compile: "tsc -p ./",
      watch: "tsc -watch -p ./",
      pretest: "npm run compile && npm run lint",
      lint: "eslint src --ext ts",
      test: "node ./out/test/runTest.js",
    },
    devDependencies: {
      "@types/vscode": "^1.85.0",
      "@types/node": "18.x",
      "@typescript-eslint/eslint-plugin": "^6.13.0",
      "@typescript-eslint/parser": "^6.13.0",
      eslint: "^8.54.0",
      typescript: "^5.3.2",
    },
  }

  return JSON.stringify(pkg, null, 2)
}

export function generateExtensionTs(config: ExtensionConfig, template: Template | null): string {
  const commands = (config.contributes?.commands as Array<{ command: string; title: string }>) || []

  if (template?.id === "webview") {
    return `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "${config.displayName || "My Extension"}" is now active!');

  const disposable = vscode.commands.registerCommand('extension.openWebview', () => {
    const panel = vscode.window.createWebviewPanel(
      'myWebview',
      '${config.displayName || "My Extension"}',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'click':
            vscode.window.showInformationMessage('Button clicked!');
            return;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));

  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="\${styleUri}" rel="stylesheet">
  <title>${config.displayName || "My Extension"}</title>
</head>
<body>
  <h1>${config.displayName || "My Extension"}</h1>
  <button id="btn" class="btn">Click Me</button>
  <script src="\${scriptUri}"></script>
</body>
</html>\`;
}

export function deactivate() {}`
  }

  if (template?.id === "ai") {
    return `import * as vscode from 'vscode';
import { askAI } from './ai-service';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "${config.displayName || "My Extension"}" is now active!');

  const disposable = vscode.commands.registerCommand('extension.askAI', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Ask AI anything...',
      placeHolder: 'Enter your question'
    });

    if (input) {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Thinking...',
        cancellable: false
      }, async () => {
        try {
          const response = await askAI(input);
          const doc = await vscode.workspace.openTextDocument({
            content: response,
            language: 'markdown'
          });
          await vscode.window.showTextDocument(doc);
        } catch (error) {
          vscode.window.showErrorMessage(\`AI Error: \${error}\`);
        }
      });
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}`
  }

  const commandHandlers = commands
    .map(
      (cmd, i) => `
  const disposable${i} = vscode.commands.registerCommand('${cmd.command}', () => {
    vscode.window.showInformationMessage('${cmd.title} executed!');
  });
  context.subscriptions.push(disposable${i});`,
    )
    .join("\n")

  return `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "${config.displayName || "My Extension"}" is now active!');
${commandHandlers || "\n  // Register your commands and providers here"}
}

export function deactivate() {}`
}

export function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        module: "commonjs",
        target: "ES2020",
        outDir: "out",
        lib: ["ES2020"],
        sourceMap: true,
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      exclude: ["node_modules", ".vscode-test"],
    },
    null,
    2,
  )
}

export function generateVsCodeLaunch(): string {
  return JSON.stringify(
    {
      version: "0.2.0",
      configurations: [
        {
          name: "Run Extension",
          type: "extensionHost",
          request: "launch",
          args: ["--extensionDevelopmentPath=${workspaceFolder}"],
          outFiles: ["${workspaceFolder}/out/**/*.js"],
          preLaunchTask: "${defaultBuildTask}",
        },
      ],
    },
    null,
    2,
  )
}

export function generateReadme(config: ExtensionConfig): string {
  return `# ${config.displayName || "My Extension"}

${config.description || "A VS Code extension."}

## Features

- Describe your extension features here

## Requirements

- VS Code 1.85.0 or higher

## Extension Settings

This extension contributes the following settings:

* None yet

## Known Issues

None

## Release Notes

### ${config.version || "0.0.1"}

Initial release

---

**Enjoy!**
`
}

export function generateChangeLog(config: ExtensionConfig): string {
  return `# Change Log

All notable changes to the "${config.displayName || "My Extension"}" extension will be documented in this file.

## [${config.version || "0.0.1"}]

- Initial release
`
}

export function generateGitIgnore(): string {
  return `out
dist
node_modules
.vscode-test/
*.vsix
.DS_Store
`
}

export function generateVsCodeIgnore(): string {
  return `.vscode/**
.vscode-test/**
src/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/.eslintrc.json
**/*.map
**/*.ts
`
}
