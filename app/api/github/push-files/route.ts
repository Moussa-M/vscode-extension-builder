import { type NextRequest, NextResponse } from "next/server";

interface TreeItem {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string;
}

async function pushWithGitDataApi(
  headers: Record<string, string>,
  owner: string,
  repo: string,
  files: Record<string, string>,
  commitMessage: string,
  parentSha: string | null
) {
  // Create blobs for each file
  const blobs: TreeItem[] = [];

  for (const [path, content] of Object.entries(files)) {
    const blobResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: content as string,
          encoding: "utf-8",
        }),
      }
    );

    if (!blobResponse.ok) {
      const error = await blobResponse.json();
      throw new Error(`Failed to create blob for ${path}: ${error.message}`);
    }

    const blobData = await blobResponse.json();
    blobs.push({
      path: path.startsWith("/") ? path.slice(1) : path,
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    });
  }

  // Create tree
  const treeBody: { tree: TreeItem[]; base_tree?: string } = { tree: blobs };
  if (parentSha) {
    treeBody.base_tree = parentSha;
  }

  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(treeBody),
    }
  );

  if (!treeResponse.ok) {
    const error = await treeResponse.json();
    throw new Error(`Failed to create tree: ${error.message}`);
  }

  const treeData = await treeResponse.json();

  // Create commit
  const commitBody: { message: string; tree: string; parents?: string[] } = {
    message: commitMessage || "Update VS Code Extension files",
    tree: treeData.sha,
  };
  if (parentSha) {
    commitBody.parents = [parentSha];
  }

  const commitResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(commitBody),
    }
  );

  if (!commitResponse.ok) {
    const error = await commitResponse.json();
    throw new Error(`Failed to create commit: ${error.message}`);
  }

  const commitData = await commitResponse.json();
  return commitData;
}

async function initializeEmptyRepo(
  headers: Record<string, string>,
  owner: string,
  repo: string
) {
  const putResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/README.md`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: "Initialize repository",
        content: Buffer.from(
          "# VS Code Extension\n\nGenerated with VS Code Extension Builder"
        ).toString("base64"),
      }),
    }
  );

  if (!putResponse.ok) {
    const error = await putResponse.json();
    throw new Error(`Failed to initialize repo: ${error.message}`);
  }

  const putData = await putResponse.json();
  return putData.commit.sha;
}

export async function POST(req: NextRequest) {
  try {
    const { token, owner, repo, files, commitMessage, isEmpty } =
      await req.json();

    if (!token || !owner || !repo || !files) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    let baseSha: string | null = null;
    let branch = "main";

    // Try to get the latest commit SHA
    if (!isEmpty) {
      for (const b of ["main", "master"]) {
        const refResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${b}`,
          {
            headers,
          }
        );

        if (refResponse.ok) {
          const refData = await refResponse.json();
          baseSha = refData.object.sha;
          branch = b;
          break;
        }
      }
    }

    if (!baseSha) {
      try {
        baseSha = await initializeEmptyRepo(headers, owner, repo);
        // Wait for GitHub to process
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        // If initialization fails, try without parent
        console.log(" Could not initialize repo, trying without parent commit");
      }
    }

    try {
      const commitData = await pushWithGitDataApi(
        headers,
        owner,
        repo,
        files,
        commitMessage,
        baseSha
      );

      // Update or create ref
      const refMethod = baseSha ? "PATCH" : "POST";
      const refUrl = baseSha
        ? `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`
        : `https://api.github.com/repos/${owner}/${repo}/git/refs`;

      const refBody = baseSha
        ? { sha: commitData.sha, force: true }
        : { ref: `refs/heads/${branch}`, sha: commitData.sha };

      const refResponse = await fetch(refUrl, {
        method: refMethod,
        headers,
        body: JSON.stringify(refBody),
      });

      if (!refResponse.ok) {
        // Try the other approach
        const altResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({ sha: commitData.sha, force: true }),
          }
        );

        if (!altResponse.ok) {
          const error = await altResponse.json().catch(() => ({}));
          return NextResponse.json(
            {
              error: `Failed to update ref: ${
                error.message || "Unknown error"
              }`,
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        commit: {
          sha: commitData.sha,
          url: `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
          message: commitData.message,
        },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to push files" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("GitHub push error:", error);
    return NextResponse.json(
      { error: "Failed to push files" },
      { status: 500 }
    );
  }
}
