import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs/promises"
import os from "os"

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  let tempDir: string | null = null

  try {
    const body = await req.json()
    const { azureToken, publisher, extensionName, files } = body as {
      azureToken?: string
      publisher: string
      extensionName: string
      files: Record<string, string>
    }

    console.log("[apertacodex] Starting VSIX creation for:", publisher, extensionName)

    if (!publisher || !extensionName || !files) {
      return NextResponse.json({ error: "Missing required fields: publisher, extensionName, files" }, { status: 400 })
    }

    const packageJson = files["package.json"]
    if (!packageJson) {
      return NextResponse.json({ error: "package.json is required" }, { status: 400 })
    }

    let pkg: Record<string, unknown>
    try {
      pkg = JSON.parse(packageJson)
    } catch {
      return NextResponse.json({ error: "Invalid package.json" }, { status: 400 })
    }

    const version = (pkg.version as string) || "0.0.1"
    const displayName = (pkg.displayName as string) || extensionName
    const description = ((pkg.description as string) || "").replace(/\\n/g, "\n").trim()
    const categories = (pkg.categories as string[]) || ["Other"]

    // Create temp directory and write files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vsce-"))
    console.log("[apertacodex] Created temp directory:", tempDir)

    // Create VSIX using JSZip
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()

    const ext = zip.folder("extension")
    if (!ext) {
      return NextResponse.json({ error: "Failed to create package structure" }, { status: 500 })
    }

    let hasIcon = false
    let iconPath = ""

    // Check for icon in package.json
    if (pkg.icon && typeof pkg.icon === "string") {
      iconPath = pkg.icon as string
    }

    for (const [filePath, content] of Object.entries(files)) {
      if (content.startsWith("data:image/png;base64,")) {
        const base64Data = content.replace("data:image/png;base64,", "")
        const binaryData = Buffer.from(base64Data, "base64")
        ext.file(filePath, binaryData, { binary: true })

        // Track if this is the icon file
        if (filePath === iconPath || filePath.includes("icon")) {
          hasIcon = true
          iconPath = filePath
        }
      } else {
        ext.file(filePath, content)
      }
    }

    // Content Types XML
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".ts" ContentType="text/plain"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".txt" ContentType="text/plain"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>`,
    )

    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${extensionName}" Version="${version}" Publisher="${publisher}"/>
    <DisplayName>${escapeXml(displayName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(description)}</Description>
    <Tags>${categories.join(",")}</Tags>
    <Categories>${categories.join(",")}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    ${hasIcon ? `<Icon>extension/${iconPath}</Icon>` : ""}
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.60.0"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
      <Property Id="Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown" Value="true"/>
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    ${files["README.md"] ? '<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>' : ""}
    ${files["CHANGELOG.md"] ? '<Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>' : ""}
    ${hasIcon ? `<Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/${iconPath}" Addressable="true"/>` : ""}
  </Assets>
</PackageManifest>`

    zip.file("extension.vsixmanifest", manifest)

    const vsixFilename = `${publisher}.${extensionName}-${version}.vsix`
    const vsixPath = path.join(tempDir, vsixFilename)

    console.log("[apertacodex] Generating VSIX...")
    const vsixBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    })

    await fs.writeFile(vsixPath, vsixBuffer)
    console.log("[apertacodex] VSIX saved:", vsixPath, "size:", vsixBuffer.length, "bytes")

    const vsixBase64 = vsixBuffer.toString("base64")

    // If Azure PAT provided, publish using vsce CLI
    if (azureToken) {
      console.log("[apertacodex] Azure PAT provided, publishing via vsce CLI...")

      try {
        // Run vsce publish as subprocess
        const { stdout, stderr } = await execAsync(
          `npx @vscode/vsce publish --packagePath "${vsixPath}" -p "${azureToken}"`,
          {
            cwd: tempDir,
            timeout: 60000, // 60 second timeout
            env: { ...process.env, VSCE_PAT: azureToken },
          },
        )

        console.log("[apertacodex] vsce stdout:", stdout)
        if (stderr) console.log("[apertacodex] vsce stderr:", stderr)

        console.log("[apertacodex] Published successfully!")

        return NextResponse.json({
          success: true,
          published: true,
          message: "Extension published successfully to the VS Code Marketplace!",
          url: `https://marketplace.visualstudio.com/items?itemName=${publisher}.${extensionName}`,
          vsixBase64,
          vsixFilename,
        })
      } catch (publishError: unknown) {
        const error = publishError as {
          stdout?: string
          stderr?: string
          message?: string
        }

        const errorMsg = [error.stderr, error.stdout, error.message].filter(Boolean).join("\n")
        console.error("[apertacodex] Publish failed:", errorMsg)

        // Check if it's a version conflict error (vsce outputs: "<publisher>.<name> vX.Y.Z already exists")
        const isVersionConflict = errorMsg.includes("already exists") || errorMsg.includes("exists already")

        let suggestion = "Download the VSIX and publish manually or check your Azure PAT permissions."
        let errorMessage = `Auto-publish failed: ${errorMsg}`

        if (isVersionConflict) {
          suggestion = `Version ${version} already exists in the marketplace. Please update the version number in package.json (e.g., to ${incrementVersion(
            version,
          )}) and try again.`
          errorMessage = `Version ${version} already exists in the marketplace`
        }

        // Return VSIX for manual upload as fallback
        return NextResponse.json({
          success: true,
          published: false,
          error: errorMessage,
          suggestion,
          vsixBase64,
          vsixFilename,
          manualUploadUrl: `https://marketplace.visualstudio.com/manage/publishers/${publisher}`,
          cliCommand: `npx @vscode/vsce publish --packagePath ${vsixFilename} -p <your-pat>`,
        })
      }
    }

    // No PAT - return VSIX for manual upload
    console.log("[apertacodex] No PAT provided, returning VSIX for manual upload")
    return NextResponse.json({
      success: true,
      published: false,
      message: "VSIX created! Provide an Azure PAT for auto-publishing, or download and publish manually.",
      vsixBase64,
      vsixFilename,
      manualUploadUrl: `https://marketplace.visualstudio.com/manage/publishers/${publisher}`,
      cliCommand: `npx @vscode/vsce publish --packagePath ${vsixFilename} -p <your-pat>`,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[apertacodex] Error:", errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
        console.log("[apertacodex] Cleaned up temp directory")
      } catch {}
    }
  }
}

function incrementVersion(version: string): string {
  const parts = version.split(".")
  if (parts.length === 3) {
    const patch = Number.parseInt(parts[2], 10)
    return `${parts[0]}.${parts[1]}.${patch + 1}`
  }
  return version
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
