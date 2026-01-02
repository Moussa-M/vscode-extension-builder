import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { token, repoName, description, isPrivate, org } = await req.json()

    if (!token || !repoName) {
      return NextResponse.json({ error: "Token and repo name required" }, { status: 400 })
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Invalid GitHub token" }, { status: 401 })
    }

    const userData = await userResponse.json()
    const username = userData.login
    const owner = org || username

    let repoExists = false
    let existingRepo = null

    try {
      const checkResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      if (checkResponse.ok) {
        repoExists = true
        existingRepo = await checkResponse.json()
      }
      // 404 means repo doesn't exist - this is expected, continue to create
    } catch {
      // Network error checking repo - continue to create
    }

    // If repo exists, return its info
    if (repoExists && existingRepo) {
      return NextResponse.json({
        success: true,
        existed: true,
        isEmpty: existingRepo.size === 0,
        repo: {
          name: existingRepo.name,
          fullName: existingRepo.full_name,
          url: existingRepo.html_url,
          cloneUrl: existingRepo.clone_url,
          owner: existingRepo.owner.login,
        },
      })
    }

    const createUrl = org ? `https://api.github.com/orgs/${org}/repos` : "https://api.github.com/user/repos"

    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        description: description || "VS Code Extension",
        private: isPrivate || false,
        auto_init: false,
      }),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()
      return NextResponse.json(
        { error: errorData.message || "Failed to create repository" },
        { status: createResponse.status },
      )
    }

    const repoData = await createResponse.json()
    return NextResponse.json({
      success: true,
      existed: false,
      isEmpty: true,
      repo: {
        name: repoData.name,
        fullName: repoData.full_name,
        url: repoData.html_url,
        cloneUrl: repoData.clone_url,
        owner: repoData.owner.login,
      },
    })
  } catch (error) {
    console.error("GitHub create repo error:", error)
    return NextResponse.json({ error: "Failed to create repository" }, { status: 500 })
  }
}
