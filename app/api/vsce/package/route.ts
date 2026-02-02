import { type NextRequest, NextResponse } from "next/server"
import type { ExtensionConfig } from "@/lib/types"
import { DEFAULT_EXTENSION_VERSION } from "@/lib/version"

// This route generates the .vsix package content as a zip
// The actual packaging needs to be done client-side or via a build service

export async function POST(req: NextRequest) {
  try {
    const { config, files } = (await req.json()) as {
      config: ExtensionConfig
      files: Record<string, string>
    }

    if (!config || !files) {
      return NextResponse.json({ error: "Config and files required" }, { status: 400 })
    }

    // Generate package.json if not present
    if (!files["package.json"]) {
      files["package.json"] = JSON.stringify(
        {
          name: config.name,
          displayName: config.displayName,
          description: config.description,
          version: config.version || DEFAULT_EXTENSION_VERSION,
          publisher: config.publisher,
          engines: { vscode: "^1.85.0" },
          categories: [config.category || "Other"],
          activationEvents: config.activationEvents || [],
          main: "./out/extension.js",
          contributes: config.contributes || {},
        },
        null,
        2,
      )
    }

    // Return the files ready for packaging
    // Client will use JSZip to create .vsix (which is just a zip)
    return NextResponse.json({
      success: true,
      packageName: `${config.publisher}.${config.name}-${config.version || DEFAULT_EXTENSION_VERSION}.vsix`,
      files,
    })
  } catch (error) {
    console.error("Package error:", error)
    return NextResponse.json({ error: "Failed to prepare package" }, { status: 500 })
  }
}
