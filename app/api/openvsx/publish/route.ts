import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function POST(req: NextRequest) {
  let tempDir: string | null = null;

  try {
    const body = await req.json();
    const { openVsxToken, publisher, extensionName, files } = body as {
      openVsxToken?: string;
      publisher: string;
      extensionName: string;
      files: Record<string, string>;
    };

    console.log(
      "[OpenVSX] Starting VSIX creation for:",
      publisher,
      extensionName
    );

    if (!publisher || !extensionName || !files) {
      return NextResponse.json(
        { error: "Missing required fields: publisher, extensionName, files" },
        { status: 400 }
      );
    }

    const packageJson = files["package.json"];
    if (!packageJson) {
      return NextResponse.json(
        { error: "package.json is required" },
        { status: 400 }
      );
    }

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(packageJson);
    } catch {
      return NextResponse.json(
        { error: "Invalid package.json" },
        { status: 400 }
      );
    }

    let version = (pkg.version as string) || "0.0.1";
    const displayName = (pkg.displayName as string) || extensionName;
    const description = ((pkg.description as string) || "").replace(/\\n/g, "\n").trim();
    const categories = (pkg.categories as string[]) || ["Other"];

    // Create temp directory and write files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ovsx-"));
    console.log("[OpenVSX] Created temp directory:", tempDir);

    // Create VSIX using JSZip
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const ext = zip.folder("extension");
    if (!ext) {
      return NextResponse.json(
        { error: "Failed to create package structure" },
        { status: 500 }
      );
    }

    let hasIcon = false;
    let iconPath = "";

    // Check for icon in package.json
    if (pkg.icon && typeof pkg.icon === "string") {
      iconPath = pkg.icon as string;
    }

    for (const [filePath, content] of Object.entries(files)) {
      if (content.startsWith("data:image/png;base64,")) {
        const base64Data = content.replace("data:image/png;base64,", "");
        const binaryData = Buffer.from(base64Data, "base64");
        ext.file(filePath, binaryData, { binary: true });

        // Track if this is the icon file
        if (filePath === iconPath || filePath.includes("icon")) {
          hasIcon = true;
          iconPath = filePath;
        }
      } else {
        ext.file(filePath, content);
      }
    }

    // Content Types XML
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".ts" ContentType="text/plain"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".txt" ContentType="text/plain"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>`
    );

    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${extensionName}" Version="${version}" Publisher="${publisher}"/>
    <DisplayName>${escapeXml(displayName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(description)}</Description>
    <Tags>${categories.join(",")}</Tags>
    <Categories>${categories.join(",")}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    ${hasIcon ? `<Icon>extension/${iconPath}</Icon>` : ""}
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.60.0"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
      <Property Id="Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown" Value="true"/>
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    ${
      files["README.md"]
        ? '<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>'
        : ""
    }
    ${
      files["CHANGELOG.md"]
        ? '<Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>'
        : ""
    }
    ${
      hasIcon
        ? `<Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/${iconPath}" Addressable="true"/>`
        : ""
    }
  </Assets>
</PackageManifest>`;

    zip.file("extension.vsixmanifest", manifest);

    let vsixFilename = `${publisher}.${extensionName}-${version}.vsix`;
    const vsixPath = path.join(tempDir, vsixFilename);

    console.log("[OpenVSX] Generating VSIX...");
    let vsixBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    await fs.writeFile(vsixPath, vsixBuffer);
    console.log(
      "[OpenVSX] VSIX saved:",
      vsixPath,
      "size:",
      vsixBuffer.length,
      "bytes"
    );

    // Helper to rebuild VSIX with a new version
    async function rebuildVsixWithVersion(newVersion: string) {
      version = newVersion;
      pkg.version = newVersion;
      ext!.file("package.json", JSON.stringify(pkg, null, 2));

      const existingManifest = zip.file("extension.vsixmanifest");
      if (existingManifest) {
        const manifestContent = await existingManifest.async("string");
        zip.file(
          "extension.vsixmanifest",
          manifestContent.replace(/Version="[^"]*"/, `Version="${newVersion}"`)
        );
      }

      vsixBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });
      vsixFilename = `${publisher}.${extensionName}-${newVersion}.vsix`;
      await fs.writeFile(vsixPath, vsixBuffer);
    }

    // If OpenVSX token provided, pre-check version and publish with retry
    if (openVsxToken) {
      console.log("[OpenVSX] Token provided, publishing via REST API...");

      // Pre-check: see if this version already exists
      try {
        const checkRes = await fetch(
          `https://open-vsx.org/api/${publisher}/${extensionName}/${version}`
        );
        if (checkRes.ok) {
          const bumped = incrementVersion(version);
          console.log(`[OpenVSX] Version ${version} already exists, bumping to ${bumped}`);
          await rebuildVsixWithVersion(bumped);
        }
      } catch (e) {
        console.log("[OpenVSX] Could not pre-check version, proceeding");
      }

      // Attempt publish with retry on version conflict
      const MAX_VERSION_RETRIES = 5;
      let lastError = "";

      for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt++) {
        try {
          console.log(`[OpenVSX] Publishing attempt ${attempt + 1}, version ${version}...`);
          const publishResponse = await fetch(
            `https://open-vsx.org/api/-/publish`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openVsxToken}`,
              },
              body: vsixBuffer,
            }
          );

          if (publishResponse.ok) {
            console.log("[OpenVSX] Published successfully!");
            return NextResponse.json({
              success: true,
              published: true,
              message: `Extension published successfully to Open VSX Registry! (version ${version})`,
              url: `https://open-vsx.org/extension/${publisher}/${extensionName}`,
              version,
              vsixBase64: vsixBuffer.toString("base64"),
              vsixFilename,
            });
          }

          const errorText = await publishResponse.text();
          lastError = `OpenVSX API error ${publishResponse.status}: ${errorText}`;

          const isVersionConflict =
            errorText.includes("already exists") || errorText.includes("version");

          if (isVersionConflict && attempt < MAX_VERSION_RETRIES - 1) {
            const bumped = incrementVersion(version);
            console.log(`[OpenVSX] Version conflict, bumping ${version} -> ${bumped} and retrying...`);
            await rebuildVsixWithVersion(bumped);
            continue;
          }

          // Not a version conflict, break out
          break;
        } catch (publishError: unknown) {
          lastError = publishError instanceof Error ? publishError.message : String(publishError);
          console.error("[OpenVSX] Publish error:", lastError);
          break;
        }
      }

      // All retries exhausted or non-version error
      const isLicenseError = lastError.includes("license");
      const isNamespaceError =
        lastError.includes("namespace") || lastError.includes("Namespace");

      let suggestion =
        "Download the VSIX and publish manually or check your OpenVSX token permissions.";
      let errorMessage = `Auto-publish failed: ${lastError}`;

      if (isLicenseError) {
        suggestion =
          "The extension is missing a license. Ensure package.json has a 'license' field and a LICENSE file exists.";
        errorMessage = "Extension missing required license";
      } else if (isNamespaceError) {
        suggestion = `Create the '${publisher}' namespace at https://open-vsx.org/user-settings/namespaces before publishing.`;
        errorMessage = `Namespace '${publisher}' does not exist`;
      }

      return NextResponse.json({
        success: true,
        published: false,
        error: errorMessage,
        suggestion,
        vsixBase64: vsixBuffer.toString("base64"),
        vsixFilename,
        manualUploadUrl: "https://open-vsx.org/user-settings/extensions",
        cliCommand: `npx ovsx publish ${vsixFilename} -p <your-token>`,
      });
    }

    // No token - return VSIX for manual upload
    console.log(
      "[OpenVSX] No token provided, returning VSIX for manual upload"
    );
    return NextResponse.json({
      success: true,
      published: false,
      message:
        "VSIX created! Provide an OpenVSX token for auto-publishing, or download and publish manually.",
      vsixBase64: vsixBuffer.toString("base64"),
      vsixFilename,
      manualUploadUrl: "https://open-vsx.org/user-settings/extensions",
      cliCommand: `npx ovsx publish ${vsixFilename} -p <your-token>`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[OpenVSX] Error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log("[OpenVSX] Cleaned up temp directory");
      } catch {}
    }
  }
}

function incrementVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length === 3) {
    const patch = Number.parseInt(parts[2], 10);
    return `${parts[0]}.${parts[1]}.${patch + 1}`;
  }
  return version;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
