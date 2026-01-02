#!/usr/bin/env node
/**
 * Test script for VSIX creation API
 * Tests the /api/vsce/publish endpoint with the midnight-aurora-theme extension
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Test extension files (from midnight-aurora-theme.zip)
const testFiles = {
  "package.json": JSON.stringify(
    {
      name: "midnight-aurora-theme",
      displayName: "Midnight Aurora Theme",
      description:
        "A stunning dark theme with vibrant accent colors inspired by the northern lights",
      version: "0.0.1",
      publisher: "apertacodex",
      engines: { vscode: "^1.85.0" },
      categories: ["Themes"],
      activationEvents: [],
      main: "./out/extension.js",
      contributes: {
        themes: [
          {
            label: "Midnight Aurora",
            uiTheme: "vs-dark",
            path: "./themes/my-theme.json",
          },
        ],
      },
    },
    null,
    2
  ),

  "README.md": `# Midnight Aurora Theme

A stunning dark theme with vibrant accent colors inspired by the northern lights.

## Features
- Dark background for reduced eye strain
- Vibrant accent colors
- Optimized for long coding sessions
`,

  "CHANGELOG.md": `# Changelog

## [0.0.1] - 2024-01-01
- Initial release
`,

  "themes/my-theme.json": JSON.stringify(
    {
      name: "Midnight Aurora",
      type: "dark",
      colors: {
        "editor.background": "#1a1a2e",
        "editor.foreground": "#eaeaea",
        "activityBar.background": "#16213e",
        "activityBar.foreground": "#e94560",
        "sideBar.background": "#1a1a2e",
        "statusBar.background": "#0f3460",
      },
      tokenColors: [
        {
          scope: ["comment"],
          settings: { foreground: "#6a6a8a", fontStyle: "italic" },
        },
        { scope: ["string"], settings: { foreground: "#a7e9af" } },
        { scope: ["keyword"], settings: { foreground: "#e94560" } },
        {
          scope: ["entity.name.function"],
          settings: { foreground: "#00d9ff" },
        },
      ],
    },
    null,
    2
  ),
};

async function runTests() {
  console.log("🧪 VSIX Creation Test Suite\n");
  console.log("=".repeat(50));

  let passed = 0;
  let failed = 0;

  // Test 1: Create VSIX without PAT (should succeed with download)
  console.log("\n📦 Test 1: Create VSIX package (no PAT)");
  try {
    const response = await fetch(`${BASE_URL}/api/vsce/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publisher: "apertacodex",
        extensionName: "midnight-aurora-theme",
        files: testFiles,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success && data.vsixBase64) {
      console.log("   ✅ PASSED - VSIX created successfully");
      console.log(`   📄 Filename: ${data.vsixFilename}`);
      console.log(
        `   📏 Size: ${Buffer.from(data.vsixBase64, "base64").length} bytes`
      );
      passed++;

      // Save VSIX for manual verification
      const vsixBuffer = Buffer.from(data.vsixBase64, "base64");
      const outputPath = path.join(__dirname, "test-output.vsix");
      fs.writeFileSync(outputPath, vsixBuffer);
      console.log(`   💾 Saved to: ${outputPath}`);
    } else {
      console.log("   ❌ FAILED - " + (data.error || "Unknown error"));
      failed++;
    }
  } catch (error) {
    console.log("   ❌ FAILED - " + error.message);
    failed++;
  }

  // Test 2: Missing required fields
  console.log("\n📦 Test 2: Missing required fields");
  try {
    const response = await fetch(`${BASE_URL}/api/vsce/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publisher: "apertacodex",
        // Missing extensionName and files
      }),
    });

    const data = await response.json();

    if (response.status === 400 && data.error) {
      console.log("   ✅ PASSED - Correctly rejected with 400");
      console.log(`   📝 Error: ${data.error}`);
      passed++;
    } else {
      console.log("   ❌ FAILED - Should have returned 400");
      failed++;
    }
  } catch (error) {
    console.log("   ❌ FAILED - " + error.message);
    failed++;
  }

  // Test 3: Invalid package.json
  console.log("\n📦 Test 3: Invalid package.json");
  try {
    const response = await fetch(`${BASE_URL}/api/vsce/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publisher: "apertacodex",
        extensionName: "test-ext",
        files: {
          "package.json": "{ invalid json }",
        },
      }),
    });

    const data = await response.json();

    if (response.status === 400 && data.error.includes("Invalid")) {
      console.log("   ✅ PASSED - Correctly rejected invalid JSON");
      console.log(`   📝 Error: ${data.error}`);
      passed++;
    } else {
      console.log("   ❌ FAILED - Should have returned 400 for invalid JSON");
      failed++;
    }
  } catch (error) {
    console.log("   ❌ FAILED - " + error.message);
    failed++;
  }

  // Test 4: Missing package.json
  console.log("\n📦 Test 4: Missing package.json");
  try {
    const response = await fetch(`${BASE_URL}/api/vsce/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publisher: "apertacodex",
        extensionName: "test-ext",
        files: {
          "README.md": "# Test",
        },
      }),
    });

    const data = await response.json();

    if (response.status === 400 && data.error.includes("package.json")) {
      console.log("   ✅ PASSED - Correctly rejected missing package.json");
      console.log(`   📝 Error: ${data.error}`);
      passed++;
    } else {
      console.log("   ❌ FAILED - Should require package.json");
      failed++;
    }
  } catch (error) {
    console.log("   ❌ FAILED - " + error.message);
    failed++;
  }

  // Test 5: Verify VSIX structure (unzip and check contents)
  console.log("\n📦 Test 5: Verify VSIX structure");
  try {
    const outputPath = path.join(__dirname, "test-output.vsix");
    if (fs.existsSync(outputPath)) {
      const { execSync } = require("child_process");
      const result = execSync(`unzip -l ${outputPath}`, { encoding: "utf-8" });

      const hasManifest = result.includes("extension.vsixmanifest");
      const hasContentTypes = result.includes("[Content_Types].xml");
      const hasPackageJson = result.includes("extension/package.json");
      const hasTheme = result.includes("extension/themes/my-theme.json");

      if (hasManifest && hasContentTypes && hasPackageJson && hasTheme) {
        console.log("   ✅ PASSED - VSIX structure is valid");
        console.log(
          "   📁 Contains: extension.vsixmanifest, [Content_Types].xml, extension files"
        );
        passed++;
      } else {
        console.log("   ❌ FAILED - Missing required files in VSIX");
        console.log(
          `   - extension.vsixmanifest: ${hasManifest ? "✅" : "❌"}`
        );
        console.log(
          `   - [Content_Types].xml: ${hasContentTypes ? "✅" : "❌"}`
        );
        console.log(
          `   - extension/package.json: ${hasPackageJson ? "✅" : "❌"}`
        );
        console.log(
          `   - extension/themes/my-theme.json: ${hasTheme ? "✅" : "❌"}`
        );
        failed++;
      }
    } else {
      console.log("   ⚠️ SKIPPED - No VSIX file to verify");
    }
  } catch (error) {
    console.log("   ❌ FAILED - " + error.message);
    failed++;
  }

  // Test 6: Auto-publish with fake PAT (should fail gracefully with VSIX fallback)
  console.log("\n📦 Test 6: Auto-publish with invalid PAT");
  try {
    const response = await fetch(`${BASE_URL}/api/vsce/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        azureToken: "fake-invalid-pat-12345",
        publisher: "apertacodex",
        extensionName: "midnight-aurora-theme",
        files: testFiles,
      }),
    });

    const data = await response.json();

    // Should return VSIX as fallback even if publish fails
    if (data.vsixBase64 && data.vsixFilename) {
      console.log("   ✅ PASSED - Graceful fallback with VSIX");
      console.log(`   📝 Published: ${data.published}`);
      console.log(`   📄 VSIX available: ${data.vsixFilename}`);
      if (data.error)
        console.log(`   ⚠️ Expected error: ${data.error.substring(0, 80)}...`);
      passed++;
    } else {
      console.log("   ❌ FAILED - Should provide VSIX fallback");
      failed++;
    }
  } catch (error) {
    console.log("   ❌ FAILED - " + error.message);
    failed++;
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log("");

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
