import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { token, owner, repo } = await request.json()

    if (!token || !owner || !repo) {
      return NextResponse.json({ error: "Missing required fields: token, owner, repo" }, { status: 400 })
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })

    if (response.status === 204) {
      return NextResponse.json({ success: true })
    }

    if (response.status === 404) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 })
    }

    if (response.status === 403) {
      return NextResponse.json(
        { error: "Insufficient permissions. Make sure your token has 'delete_repo' scope." },
        { status: 403 },
      )
    }

    const errorData = await response.json().catch(() => ({}))
    return NextResponse.json({ error: errorData.message || "Failed to delete repository" }, { status: response.status })
  } catch (error) {
    console.error("Delete repo error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete repository" },
      { status: 500 },
    )
  }
}
