import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { publisher } = await req.json()

    if (!publisher) {
      return NextResponse.json(
        { error: "Publisher name is required" },
        { status: 400 }
      )
    }

    // Fetch extensions from OpenVSX registry for this publisher
    const response = await fetch(
      `https://open-vsx.org/api/-/search?query=publisher:${encodeURIComponent(publisher)}&size=100`,
      {
        headers: {
          Accept: "application/json",
        },
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
    const extensions = data.extensions || []

    // Map to simpler format
    const mappedExtensions = extensions.map((ext: any) => ({
      namespace: ext.namespace,
      name: ext.name,
      displayName: ext.displayName || ext.name,
      description: ext.description,
      version: ext.version,
      timestamp: ext.timestamp,
      downloadUrl: ext.files?.download,
      marketplaceUrl: `https://open-vsx.org/extension/${ext.namespace}/${ext.name}`,
    }))

    return NextResponse.json({
      success: true,
      extensions: mappedExtensions,
    })
  } catch (error) {
    console.error("[OpenVSX List] Error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list extensions",
      },
      { status: 500 }
    )
  }
}
