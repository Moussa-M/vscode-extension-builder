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
    let isEmptyRepo = false

    for (const b of ["main", "master"]) {
      const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${b}`, {
        headers,
      })

      if (refResponse.status === 409) {
        // Empty repository
        isEmptyRepo = true
        break
      }

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

    if (isEmptyRepo || !commitSha) {
      // Find a simple text file to initialize with (prefer README.md or package.json)
      const initPath = files["README.md"] ? "README.md" : files["package.json"] ? "package.json" : Object.keys(files)[0]
      const initFile = files[initPath]

      let content = typeof initFile === "string" ? initFile : String(initFile)

      // Handle data URLs for binary files
      if (content.startsWith("data:")) {
        content = content.split(",")[1] || ""
      } else {
        content = Buffer.from(content).toString("base64")
      }

      // Use Contents API to create initial file (works on empty repos)
      const initResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${initPath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: "Initial commit",
          content,
          branch: "main",
        }),
      })

      if (!initResponse.ok) {
        const error = await initResponse.json().catch(() => ({ message: "Unknown error" }))
        return NextResponse.json({ error: `Failed to initialize repository: ${error.message}` }, { status: 500 })
      }

      const initData = await initResponse.json()
      commitSha = initData.commit.sha
      branch = "main"

      // Get the tree SHA from the new commit
      const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`, {
        headers,
      })

      if (commitResponse.ok) {
        const commitData = await commitResponse.json()
        treeSha = commitData.tree.sha
      }

      // Remove the init file from files to avoid duplicating it
      const remainingFiles = { ...files }
      delete remainingFiles[initPath]

      // If there are more files, push them
      if (Object.keys(remainingFiles).length > 0) {
        try {
          const commitData = await pushWithGitDataApi(
            headers,
            owner,
            repo,
            remainingFiles,
            commitMessage || "Add extension files",
            commitSha,
            treeSha,
          )

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
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to push files" },
            { status: 500 },
          )
        }
      }

      // Only the init file was needed
      return NextResponse.json({
        success: true,
        commit: {
          sha: commitSha,
          url: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
          message: "Initial commit",
        },
      })
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
