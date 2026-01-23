import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { azureToken, publisher } = await req.json()

    if (!azureToken || !publisher) {
      return NextResponse.json(
        { error: "Azure token and publisher name are required" },
        { status: 400 }
      )
    }

    // Fetch extensions from VS Code Marketplace for this publisher
    // filterType 10 = Publisher name
    const response = await fetch(
      `https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=7.2-preview.1",
        },
        body: JSON.stringify({
          filters: [
            {
              criteria: [
                {
                  filterType: 10,
                  value: publisher,
                },
              ],
            },
          ],
          flags: 914,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Failed to fetch extensions: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const extensions = data.results?.[0]?.extensions || []

    // Map to simpler format
    const mappedExtensions = extensions.map((ext: any) => ({
      extensionId: ext.extensionId,
      extensionName: ext.extensionName,
      displayName: ext.displayName,
      shortDescription: ext.shortDescription,
      publisher: ext.publisher.publisherName,
      version: ext.versions?.[0]?.version || "unknown",
      lastUpdated: ext.versions?.[0]?.lastUpdated,
      downloadUrl: ext.versions?.[0]?.assetUri
        ? `${ext.versions[0].assetUri}/Microsoft.VisualStudio.Services.VSIXPackage`
        : null,
      marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${ext.publisher.publisherName}.${ext.extensionName}`,
    }))

    return NextResponse.json({
      success: true,
      extensions: mappedExtensions,
    })
  } catch (error) {
    console.error("[VSCE List] Error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list extensions",
      },
      { status: 500 }
    )
  }
}
