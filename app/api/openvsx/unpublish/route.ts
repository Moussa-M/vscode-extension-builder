import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { token, namespace, extensionName } = await request.json()

    if (!token || !namespace || !extensionName) {
      return NextResponse.json({ error: "Missing required fields: token, namespace, extensionName" }, { status: 400 })
    }

    // Open VSX API - Delete extension
    const response = await fetch(
      `https://open-vsx.org/api/-/namespace/${namespace}/extension/${extensionName}/delete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    )

    if (response.status === 204 || response.status === 200) {
      return NextResponse.json({ success: true })
    }

    if (response.status === 404) {
      return NextResponse.json({ error: "Extension not found in Open VSX" }, { status: 404 })
    }

    if (response.status === 401) {
      return NextResponse.json({ error: "Invalid or expired Open VSX token" }, { status: 401 })
    }

    const errorData = await response.json().catch(() => ({}))
    return NextResponse.json(
      { error: errorData.message || "Failed to unpublish extension" },
      { status: response.status },
    )
  } catch (error) {
    console.error("Open VSX unpublish error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unpublish extension" },
      { status: 500 },
    )
  }
}
