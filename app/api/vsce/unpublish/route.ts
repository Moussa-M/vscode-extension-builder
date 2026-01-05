import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { token, publisher, extensionName } = await request.json()

    if (!token || !publisher || !extensionName) {
      return NextResponse.json({ error: "Missing required fields: token, publisher, extensionName" }, { status: 400 })
    }

    // Azure DevOps Gallery API - Unpublish extension
    const response = await fetch(
      `https://marketplace.visualstudio.com/_apis/gallery/publishers/${publisher}/extensions/${extensionName}?api-version=7.1-preview.1`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${Buffer.from(`:${token}`).toString("base64")}`,
          Accept: "application/json;api-version=7.1-preview.1",
        },
      },
    )

    if (response.status === 204 || response.status === 200) {
      return NextResponse.json({ success: true })
    }

    if (response.status === 404) {
      return NextResponse.json({ error: "Extension not found in VS Code Marketplace" }, { status: 404 })
    }

    if (response.status === 401) {
      return NextResponse.json({ error: "Invalid or expired Azure DevOps token" }, { status: 401 })
    }

    const errorData = await response.json().catch(() => ({}))
    return NextResponse.json(
      { error: errorData.message || "Failed to unpublish extension" },
      { status: response.status },
    )
  } catch (error) {
    console.error("Unpublish error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unpublish extension" },
      { status: 500 },
    )
  }
}
