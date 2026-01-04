import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { openVsxToken, publisher, extensionName, files } = await req.json();

    if (!openVsxToken) {
      return NextResponse.json(
        { error: "Open VSX token is required" },
        { status: 400 }
      );
    }

    if (!publisher || !extensionName) {
      return NextResponse.json(
        { error: "Publisher and extension name are required" },
        { status: 400 }
      );
    }

    // Build the VSIX package
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const ext = zip.folder("extension");
    if (!ext) {
      return NextResponse.json(
        { error: "Failed to create extension folder" },
        { status: 500 }
      );
    }

    let pkgJson: Record<string, unknown> = {};
    let hasIcon = false;
    let iconPath = "";

    // Parse package.json
    if (files["package.json"]) {
      try {
        pkgJson = JSON.parse(files["package.json"]);
        if (pkgJson.icon) {
          iconPath = pkgJson.icon as string;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Add files to the extension folder
    for (const [path, content] of Object.entries(files)) {
      if (
        path.endsWith(".png") &&
        typeof content === "string" &&
        content.startsWith("data:")
      ) {
        const base64 = content.split(",")[1];
        ext.file(path, base64, { base64: true });
        if (path === iconPath || path.includes("icon")) {
          hasIcon = true;
        }
      } else {
        ext.file(path, content as string);
      }
    }

    // Add [Content_Types].xml
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

    // Add extension.vsixmanifest
    const version = (pkgJson.version as string) || "0.0.1";
    const displayName = (pkgJson.displayName as string) || extensionName;
    const description = (pkgJson.description as string) || "";
    const category = (pkgJson.categories as string[])?.[0] || "Other";

    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${extensionName}" Version="${version}" Publisher="${publisher}"/>
    <DisplayName>${displayName}</DisplayName>
    <Description>${description}</Description>
    <Categories>${category}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    ${hasIcon ? `<Icon>extension/${iconPath}</Icon>` : ""}
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.60.0"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
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

    // Generate VSIX as base64
    const vsixBuffer = await zip.generateAsync({ type: "uint8array" });

    // Convert to base64 for the API
    let vsixBase64 = "";
    const chunks: string[] = [];
    const chunkSize = 32768;
    for (let i = 0; i < vsixBuffer.length; i += chunkSize) {
      const chunk = vsixBuffer.subarray(i, i + chunkSize);
      chunks.push(String.fromCharCode(...chunk));
    }
    vsixBase64 = btoa(chunks.join(""));

    // First, ensure the namespace exists (create if it doesn't)
    const namespaceCheckResponse = await fetch(
      `https://open-vsx.org/api/${publisher}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (namespaceCheckResponse.status === 404) {
      // Namespace doesn't exist, try to create it
      const createNamespaceResponse = await fetch(
        `https://open-vsx.org/api/-/namespace/create?token=${openVsxToken}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: publisher }),
        }
      );

      if (
        !createNamespaceResponse.ok &&
        createNamespaceResponse.status !== 409
      ) {
        const errorText = await createNamespaceResponse
          .text()
          .catch(() => "Unknown error");
        console.error("[v0] Failed to create namespace:", errorText);
        // Continue anyway, namespace might exist with different visibility
      }
    }

    // Publish to Open VSX using the REST API
    // The Open VSX API expects the VSIX file as form-data
    const formData = new FormData();
    const vsixBlob = new Blob([vsixBuffer], { type: "application/vsix" });
    formData.append(
      "file",
      vsixBlob,
      `${publisher}.${extensionName}-${version}.vsix`
    );

    const publishResponse = await fetch(
      `https://open-vsx.org/api/-/publish?token=${openVsxToken}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const responseText = await publishResponse.text();
    let responseData: Record<string, unknown> = {};
    let isHtmlResponse = false;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If it's not JSON, it might be an HTML error page
      isHtmlResponse =
        responseText.trim().startsWith("<!DOCTYPE") ||
        responseText.trim().startsWith("<html");
      responseData = { message: responseText };
    }

    console.log(
      "[v0] Open VSX publish response status:",
      publishResponse.status
    );
    console.log("[v0] Open VSX response is HTML:", isHtmlResponse);
    if (!isHtmlResponse) {
      console.log("[v0] Open VSX publish response data:", responseData);
    } else {
      console.log("[v0] Open VSX returned HTML (likely throttling/error page)");
    }

    // Check if OpenVSX returned an HTML error page (common for throttling)
    if (isHtmlResponse) {
      let errorMessage = "OpenVSX returned an error page instead of JSON";

      // Check for specific throttling message
      if (
        responseText.includes("throttling") ||
        responseText.includes("aggressively")
      ) {
        errorMessage =
          "OpenVSX is throttling your requests. You're accessing the registry too frequently.";
      }

      console.error("[v0] Open VSX HTML error:", errorMessage);
      return NextResponse.json(
        {
          error: errorMessage,
          suggestion:
            "Wait a few minutes before trying again, or download the VSIX and publish manually using: npx ovsx publish <file> -p <token>. For higher rate limits, contact infrastructure@eclipse-foundation.org",
          vsixBase64,
          manualUploadUrl: "https://open-vsx.org/user-settings/extensions",
        },
        { status: 429 } // Too Many Requests
      );
    }

    if (!publishResponse.ok) {
      console.error("[v0] Open VSX publish error:", responseData);

      // Return VSIX for manual upload
      return NextResponse.json(
        {
          error:
            (responseData.error as string) ||
            (responseData.message as string) ||
            "Failed to publish to Open VSX",
          suggestion:
            "Download the VSIX and publish manually using: npx ovsx publish <file> -p <token>",
          vsixBase64,
          manualUploadUrl: "https://open-vsx.org/user-settings/extensions",
        },
        { status: 400 }
      );
    }

    // Validate that the extension was actually published
    // OpenVSX returns different response structures depending on success/failure
    if (responseData.error || responseData.success === false) {
      console.error("[v0] Open VSX publish failed (soft error):", responseData);
      return NextResponse.json(
        {
          error:
            (responseData.error as string) ||
            (responseData.message as string) ||
            "Failed to publish to Open VSX",
          suggestion:
            "The extension was not published. Check your namespace permissions and try again, or download the VSIX and publish manually using: npx ovsx publish <file> -p <token>",
          vsixBase64,
          manualUploadUrl: "https://open-vsx.org/user-settings/extensions",
          responseData, // Include the actual response for debugging
        },
        { status: 400 }
      );
    }

    // Check if we got a valid success response
    const actualUrl =
      (responseData.url as string) ||
      `https://open-vsx.org/extension/${publisher}/${extensionName}`;

    console.log("[v0] Successfully published to Open VSX:", actualUrl);

    return NextResponse.json({
      success: true,
      url: actualUrl,
      version,
      responseData, // Include response for client to see what actually happened
    });
  } catch (error) {
    console.error("[v0] Open VSX publish error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish to Open VSX",
        suggestion:
          "Try publishing manually using: npx ovsx publish -p <token>",
      },
      { status: 500 }
    );
  }
}
