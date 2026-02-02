import { type NextRequest, NextResponse } from "next/server"

/**
 * API Route: POST /api/github/create-release
 *
 * Creates a GitHub release with VSIX asset
 *
 * Request Body:
 * - token: GitHub Personal Access Token
 * - owner: Repository owner (username or org)
 * - repo: Repository name
 * - version: Version number (e.g., "0.1.0")
 * - name: Release name (optional, defaults to version)
 * - body: Release notes (optional)
 * - vsixUrl: URL to the VSIX file to attach (optional)
 * - vsixName: Name for the VSIX asset (optional)
 * - draft: Whether this is a draft release (default: false)
 * - prerelease: Whether this is a pre-release (default: false)
 */
export async function POST(req: NextRequest) {
  try {
    const {
      token,
      owner,
      repo,
      version,
      name,
      body,
      vsixUrl,
      vsixName,
      draft = false,
      prerelease = false,
    } = await req.json()

    if (!token || !owner || !repo || !version) {
      return NextResponse.json(
        { error: "Missing required fields: token, owner, repo, version" },
        { status: 400 }
      )
    }

    // Ensure version starts with 'v'
    const tagName = version.startsWith("v") ? version : `v${version}`
    const releaseName = name || tagName

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    }

    // Create the release
    const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tag_name: tagName,
        name: releaseName,
        body: body || `Release ${tagName}`,
        draft,
        prerelease,
        target_commitish: "main", // Create from main branch
      }),
    })

    if (!releaseResponse.ok) {
      const error = await releaseResponse.json().catch(() => ({ message: "Unknown error" }))
      return NextResponse.json(
        { error: `Failed to create release: ${error.message}` },
        { status: releaseResponse.status }
      )
    }

    const releaseData = await releaseResponse.json()

    // If VSIX URL provided, upload it as an asset
    if (vsixUrl) {
      try {
        // Download the VSIX file
        const vsixResponse = await fetch(vsixUrl)
        if (!vsixResponse.ok) {
          console.warn("Failed to download VSIX for release asset")
        } else {
          const vsixBuffer = await vsixResponse.arrayBuffer()
          const assetName = vsixName || `${repo}-${version}.vsix`

          // Upload as release asset
          const uploadUrl = releaseData.upload_url.replace("{?name,label}", `?name=${assetName}`)
          const assetResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/octet-stream",
            },
            body: vsixBuffer,
          })

          if (!assetResponse.ok) {
            console.warn("Failed to upload VSIX as release asset")
          }
        }
      } catch (err) {
        console.warn("Error uploading VSIX asset:", err)
        // Don't fail the entire release if asset upload fails
      }
    }

    return NextResponse.json({
      success: true,
      release: {
        id: releaseData.id,
        tag_name: releaseData.tag_name,
        name: releaseData.name,
        url: releaseData.html_url,
        upload_url: releaseData.upload_url,
        published_at: releaseData.published_at,
      },
    })
  } catch (error) {
    console.error("GitHub release error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create release" },
      { status: 500 }
    )
  }
}
