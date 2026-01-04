import type { ExtensionConfig, Template } from "./types"

export function generatePackageJson(config: ExtensionConfig, template: Template | null): string {
  const pkg = {
    name: config.name || "my-extension",
    displayName: config.displayName || "My Extension",
    description: config.description || "A VS Code extension",
    version: config.version || "0.0.1",
    publisher: config.publisher || "publisher",
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
      pretest: "npm run compile",
      lint: "eslint src --ext ts",
    },
    devDependencies: {
      "@types/vscode": "^1.85.0",
      "@types/node": "^20.x",
      typescript: "^5.3.0",
      "@vscode/vsce": "^2.22.0",
    },
  }

  return JSON.stringify(pkg, null, 2)
}

export function generateExtensionTs(config: ExtensionConfig, template: Template | null): string {
  const extName = config.name || "myExtension"
  const displayName = config.displayName || extName
  return `import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "${displayName}" is now active!');

  const disposable = vscode.commands.registerCommand('${extName}.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from ${displayName}!');
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
`
}

export function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      module: "commonjs",
      target: "ES2022",
      outDir: "out",
      lib: ["ES2022"],
      sourceMap: true,
      rootDir: "src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    exclude: ["node_modules", ".vscode-test"],
  }
  return JSON.stringify(config, null, 2)
}

export function generateVsCodeLaunch(): string {
  const config = {
    version: "0.2.0",
    configurations: [
      {
        name: "Run Extension",
        type: "extensionHost",
        request: "launch",
        args: ["--extensionDevelopmentPath=${workspaceFolder}"],
        outFiles: ["${workspaceFolder}/out/**/*.js"],
        preLaunchTask: "npm: watch",
      },
    ],
  }
  return JSON.stringify(config, null, 2)
}

export function generateReadme(config: ExtensionConfig): string {
  const name = config.displayName || config.name || "My Extension"
  const description = config.description || "A VS Code extension."
  const version = config.version || "0.0.1"
  const extName = config.name || "my-extension"

  return `# ${name}

${description}

## Features

Describe your extension features here.

## Requirements

List any requirements or dependencies.

## Extension Settings

This extension contributes the following settings:

* \`${extName}.enable\`: Enable/disable this extension.

## Known Issues

None yet.

## Release Notes

### ${version}

Initial release.
`
}

export function generateChangeLog(config: ExtensionConfig): string {
  const name = config.displayName || config.name || "My Extension"
  const version = config.version || "0.0.1"

  return `# Change Log

All notable changes to the "${name}" extension will be documented in this file.

## [${version}]

- Initial release
`
}

export function generateGitIgnore(): string {
  return `out/
node_modules/
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
**/*.map
**/*.ts
node_modules/**
`
}
