import { type NextRequest, NextResponse } from "next/server"

interface TreeItem {
  path: string
  mode: "100644"
  type: "blob"
  sha: string
}

async function pushWithGitDataApi(
  headers: Record<string, string>,
  owner: string,
  repo: string,
  files: Record<string, string>,
  commitMessage: string,
  parentSha: string | null,
  treeSha: string | null,
) {
  // Create blobs for each file
  const blobs: TreeItem[] = []

  for (const [path, content] of Object.entries(files)) {
    const isBase64 = typeof content === "string" && content.startsWith("data:")
    let blobContent = content
    let encoding = "utf-8"

    if (isBase64) {
      // Extract base64 data from data URL
      const base64Data = content.split(",")[1] || content
      blobContent = base64Data
      encoding = "base64"
    }

    const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: blobContent,
        encoding,
      }),
    })

    if (!blobResponse.ok) {
      const error = await blobResponse.json().catch(() => ({ message: "Unknown error" }))
      throw new Error(`Failed to create blob for ${path}: ${error.message}`)
    }

    const blobData = await blobResponse.json()
    blobs.push({
      path: path.startsWith("/") ? path.slice(1) : path,
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    })
  }

  const treeBody: { tree: TreeItem[]; base_tree?: string } = { tree: blobs }
  if (treeSha) {
    treeBody.base_tree = treeSha
  }

  const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify(treeBody),
  })

  if (!treeResponse.ok) {
    const error = await treeResponse.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(`Failed to create tree: ${error.message}`)
  }

  const treeData = await treeResponse.json()

  // Create commit
  const commitBody: { message: string; tree: string; parents?: string[] } = {
    message: commitMessage || "Update VS Code Extension files",
    tree: treeData.sha,
  }
  if (parentSha) {
    commitBody.parents = [parentSha]
  }

  const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify(commitBody),
  })

  if (!commitResponse.ok) {
    const error = await commitResponse.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(`Failed to create commit: ${error.message}`)
  }

  const commitData = await commitResponse.json()
  return commitData
}

export async function POST(req: NextRequest) {
  try {
    const { token, owner, repo, files, commitMessage } = await req.json()

    if (!token || !owner || !repo || !files) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    }

    let commitSha: string | null = null
    let treeSha: string | null = null
    let branch = "main"

    for (const b of ["main", "master"]) {
      const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${b}`, {
        headers,
      })

      if (refResponse.ok) {
        const refData = await refResponse.json()
        commitSha = refData.object.sha
        branch = b

        // Get the tree SHA from the commit
        const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`, {
          headers,
        })

        if (commitResponse.ok) {
          const commitData = await commitResponse.json()
          treeSha = commitData.tree.sha
        }
        break
      }
    }

    if (!commitSha) {
      try {
        const commitData = await pushWithGitDataApi(headers, owner, repo, files, commitMessage, null, null)

        // Create the main branch ref
        const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            ref: "refs/heads/main",
            sha: commitData.sha,
          }),
        })

        if (!refResponse.ok) {
          const error = await refResponse.json().catch(() => ({ message: "Unknown error" }))
          return NextResponse.json({ error: `Failed to create branch: ${error.message}` }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          commit: {
            sha: commitData.sha,
            url: `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
            message: commitData.message,
          },
        })
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed to push files" },
          { status: 500 },
        )
      }
    }

    try {
      const commitData = await pushWithGitDataApi(headers, owner, repo, files, commitMessage, commitSha, treeSha)

      // Update the ref
      const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: commitData.sha, force: true }),
      })

      if (!refResponse.ok) {
        const error = await refResponse.json().catch(() => ({ message: "Unknown error" }))
        return NextResponse.json({ error: `Failed to update ref: ${error.message}` }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        commit: {
          sha: commitData.sha,
          url: `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
          message: commitData.message,
        },
      })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to push files" }, { status: 500 })
    }
  } catch (error) {
    console.error("GitHub push error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to push files" },
      { status: 500 },
    )
  }
}
