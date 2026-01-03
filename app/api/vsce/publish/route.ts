import { type NextRequest, NextResponse } from "next/server"

const GALLERY_API = "https://marketplace.visualstudio.com/_apis/gallery"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { azureToken, publisher, extensionName, files } = body as {
      azureToken: string
      publisher: string
      extensionName: string
      files: Record<string, string>
    }

    console.log("[v0] Starting publish for:", publisher, extensionName)

    if (!azureToken || !publisher || !extensionName || !files) {
      return NextResponse.json(
        { error: "Missing required fields: azureToken, publisher, extensionName, files" },
        { status: 400 },
      )
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
    const description = (pkg.description as string) || ""
    const categories = (pkg.categories as string[]) || ["Other"]

    console.log("[v0] Building VSIX package...")

    // Create VSIX package
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()

    const ext = zip.folder("extension")
    if (!ext) {
      return NextResponse.json({ error: "Failed to create package structure" }, { status: 500 })
    }

    for (const [path, content] of Object.entries(files)) {
      ext.file(path, content)
    }

    // Content Types XML - required for VSIX
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

    // VSIX Manifest - the key file that VS Marketplace reads
    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${extensionName}" Version="${version}" Publisher="${publisher}"/>
    <DisplayName>${escapeXml(displayName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(description)}</Description>
    <Tags>${categories.join(",")}</Tags>
    <Categories>${categories.join(",")}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Badges></Badges>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.60.0"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value=""/>
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
  </Assets>
</PackageManifest>`

    zip.file("extension.vsixmanifest", manifest)

    console.log("[v0] Generating VSIX buffer...")
    const vsixBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    })
    console.log("[v0] VSIX size:", vsixBuffer.byteLength, "bytes")

    const authHeader = `Basic ${btoa(`:${azureToken}`)}`

    // Check if extension exists
    console.log("[v0] Checking if extension exists...")
    let extensionExists = false
    const checkResponse = await fetch(
      `${GALLERY_API}/publishers/${publisher}/extensions/${extensionName}?api-version=7.1-preview.1`,
      {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      },
    )

    if (checkResponse.ok) {
      extensionExists = true
    }
    console.log("[v0] Extension exists:", extensionExists)

    // Use the correct endpoint for VSIX upload
    // The key is to upload to the extensionmanagement endpoint, not gallery
    const uploadUrl = extensionExists
      ? `https://marketplace.visualstudio.com/_apis/gallery/publishers/${publisher}/extensions/${extensionName}?api-version=7.1-preview.1`
      : `https://marketplace.visualstudio.com/_apis/gallery/publishers/${publisher}/extensions?api-version=7.1-preview.1`

    console.log("[v0] Uploading to:", uploadUrl)
    console.log("[v0] Method:", extensionExists ? "PUT" : "POST")

    // Convert ArrayBuffer to base64 for the body since v0 runtime doesn't support binary bodies well
    const uint8Array = new Uint8Array(vsixBuffer)
    let binary = ""
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const vsixBase64 = btoa(binary)

    // Try the upload with application/octet-stream
    const uploadResponse = await fetch(uploadUrl, {
      method: extensionExists ? "PUT" : "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/octet-stream",
        Accept: "application/json;api-version=7.1-preview.1",
        "Content-Length": vsixBuffer.byteLength.toString(),
      },
      // Send as base64 in a wrapper since direct binary may not work
      body: vsixBase64,
    })

    console.log("[v0] Upload response status:", uploadResponse.status)

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "Unknown error")
      console.log("[v0] Upload failed:", errorText)

      // Return detailed error with helpful message
      return NextResponse.json(
        {
          error: `Marketplace upload failed (${uploadResponse.status})`,
          details: errorText,
          suggestion:
            uploadResponse.status === 400
              ? "The Marketplace API may require using the vsce CLI tool directly. Download the VSIX and run: vsce publish --packagePath <vsix-file>"
              : uploadResponse.status === 401 || uploadResponse.status === 403
                ? "Check that your Azure PAT has 'Marketplace (Manage)' scope and is set to 'All accessible organizations'"
                : "Try downloading the VSIX and publishing manually via marketplace.visualstudio.com/manage",
          vsixBase64: vsixBase64, // Return the VSIX so user can download it
        },
        { status: uploadResponse.status },
      )
    }

    console.log("[v0] Extension published successfully!")
    return NextResponse.json({
      success: true,
      action: extensionExists ? "updated" : "created",
      url: `https://marketplace.visualstudio.com/items?itemName=${publisher}.${extensionName}`,
      message: `Extension ${displayName} v${version} ${extensionExists ? "updated" : "published"} successfully!`,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[v0] Publish error:", errorMessage)
    return NextResponse.json({ error: errorMessage || "Failed to publish extension" }, { status: 500 })
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
