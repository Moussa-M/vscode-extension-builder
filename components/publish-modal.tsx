"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Github,
  Package,
  CheckCircle2,
  Circle,
  ExternalLink,
  Copy,
  Terminal,
  KeyRound,
  Rocket,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Download,
  ChevronRight,
  Lightbulb,
  Globe,
} from "lucide-react"
import type { ExtensionConfig } from "@/lib/types"
import { getStoredCredentials, saveCredentials } from "@/lib/storage"

interface PublishModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ExtensionConfig
  files: Record<string, string>
  logoDataUrl?: string
  onSave?: () => Promise<boolean>
}

type PublishStep = "tokens" | "github" | "marketplace" | "done"

interface PublishState {
  githubToken: string
  azureToken: string
  openVsxToken: string
  repoOwner: string
  repoName: string
  isPrivate: boolean
  publisherName: string
  createdRepo: { fullName: string; url: string; owner: string; isEmpty: boolean } | null
  publishedUrl: string | null
  openVsxPublishedUrl: string | null
}

export function PublishModal({ open, onOpenChange, config, files, logoDataUrl, onSave }: PublishModalProps) {
  const [currentStep, setCurrentStep] = useState<PublishStep>("tokens")
  const [state, setState] = useState<PublishState>({
    githubToken: "",
    azureToken: "",
    openVsxToken: "",
    repoOwner: "",
    repoName: "",
    isPrivate: false,
    publisherName: "",
    createdRepo: null,
    publishedUrl: null,
    openVsxPublishedUrl: null,
  })
  const [showGithubToken, setShowGithubToken] = useState(false)
  const [showAzureToken, setShowAzureToken] = useState(false)
  const [showOpenVsxToken, setShowOpenVsxToken] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [errorSuggestion, setErrorSuggestion] = useState<string | null>(null)
  const [fallbackVsix, setFallbackVsix] = useState<string | null>(null)

  useEffect(() => {
    const stored = getStoredCredentials()

    // Try to extract owner from package.json repository URL
    let ownerFromConfig = ""
    if (files["package.json"]) {
      try {
        const pkg = JSON.parse(files["package.json"])
        if (pkg.repository?.url) {
          const match = pkg.repository.url.match(/github\.com\/([^/]+)\//)
          if (match) ownerFromConfig = match[1]
        }
      } catch {}
    }

    setState((prev) => ({
      ...prev,
      githubToken: stored.githubToken || prev.githubToken,
      azureToken: stored.azureToken || prev.azureToken,
      openVsxToken: stored.openVsxToken || prev.openVsxToken,
      publisherName: stored.publisherName || config.publisher || prev.publisherName,
      repoName: config.name || prev.repoName || "my-extension",
      // Use owner from config, or stored publisher, or leave empty to fetch from GitHub
      repoOwner: ownerFromConfig || stored.publisherName || prev.repoOwner,
    }))

    // Fetch GitHub username if we have a token and no owner yet
    const fetchGitHubUser = async () => {
      const token = stored.githubToken
      if (!token) return

      try {
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        })
        if (res.ok) {
          const data = await res.json()
          setState((prev) => ({
            ...prev,
            // Only set if no owner was already set from config
            repoOwner: prev.repoOwner || data.login,
          }))
        }
      } catch {}
    }

    if (open) {
      fetchGitHubUser()
    }
  }, [open, config.name, config.publisher, files])

  const updateState = useCallback((updates: Partial<PublishState>) => {
    setState((prev) => {
      const newState = { ...prev, ...updates }
      // Persist tokens and publisher name
      if (
        updates.githubToken !== undefined ||
        updates.azureToken !== undefined ||
        updates.openVsxToken !== undefined ||
        updates.publisherName !== undefined
      ) {
        saveCredentials({
          githubToken: updates.githubToken ?? prev.githubToken,
          azureToken: updates.azureToken ?? prev.azureToken,
          openVsxToken: updates.openVsxToken ?? prev.openVsxToken,
          publisherName: updates.publisherName ?? prev.publisherName,
        })
      }
      return newState
    })
  }, [])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const steps = [
    { id: "tokens", label: "Setup", icon: KeyRound },
    { id: "github", label: "GitHub", icon: Github },
    { id: "marketplace", label: "Publish", icon: Package },
    { id: "done", label: "Done", icon: Rocket },
  ]

  const hasGithubToken = state.githubToken.length > 0
  const hasAzureToken = state.azureToken.length > 0
  const hasOpenVsxToken = state.openVsxToken.length > 0

  // Create GitHub repo
  const createGitHubRepo = useCallback(async () => {
    if (!state.githubToken || !state.repoName) return

    setLoading("creating-repo")
    setError(null)

    try {
      const response = await fetch("/api/github/create-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.githubToken,
          repoName: state.repoName,
          org: state.repoOwner || undefined,
          description: config.description || `${config.displayName} - VS Code Extension`,
          isPrivate: state.isPrivate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create repository")
      }

      setState((prev) => ({
        ...prev,
        createdRepo: {
          fullName: data.repo.fullName,
          url: data.repo.url,
          owner: data.repo.owner,
          isEmpty: data.isEmpty,
        },
      }))

      if (!data.existed) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      await pushToGitHub(data.repo.fullName, data.repo.owner, data.isEmpty)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create repository")
    } finally {
      setLoading(null)
    }
  }, [state.githubToken, state.repoName, state.repoOwner, state.isPrivate, config])

  // Push files to GitHub
  const filesWithLogo = useMemo(() => {
    const result = { ...files }
    if (logoDataUrl && !result["images/icon.png"]) {
      result["images/icon.png"] = logoDataUrl
    }
    // Ensure package.json has icon reference
    if (result["package.json"] && logoDataUrl) {
      try {
        const pkg = JSON.parse(result["package.json"])
        if (!pkg.icon) {
          pkg.icon = "images/icon.png"
          result["package.json"] = JSON.stringify(pkg, null, 2)
        }
      } catch {
        // Ignore
      }
    }
    return result
  }, [files, logoDataUrl])

  const pushToGitHub = useCallback(
    async (repoFullName?: string, repoOwner?: string, isEmpty?: boolean) => {
      const targetRepo = repoFullName || state.createdRepo?.fullName
      if (!state.githubToken || !targetRepo) return

      setLoading("pushing")
      setError(null)

      try {
        // Save extension before pushing
        if (onSave) {
          await onSave()
        }

        const [fallbackOwner, repo] = targetRepo.split("/")
        const owner = repoOwner || fallbackOwner

        const response = await fetch("/api/github/push-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: state.githubToken,
            owner,
            repo,
            files: filesWithLogo,
            commitMessage: `feat: ${config.displayName || "VS Code Extension"} v${config.version || "0.0.1"}`,
            isEmpty: isEmpty ?? true,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to push files")
        }

        setCurrentStep("marketplace")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to push files")
      } finally {
        setLoading(null)
      }
    },
    [state.githubToken, state.createdRepo, filesWithLogo, config, onSave],
  )

  // Publish to VS Code Marketplace
  const publishToMarketplace = useCallback(async () => {
    if (!state.publisherName) {
      setError("Publisher name is required")
      return
    }

    setLoading("publishing")
    setError(null)
    setErrorSuggestion(null)
    setFallbackVsix(null)

    try {
      // Save extension before publishing
      if (onSave) {
        await onSave()
      }

      // Extract extension name from package.json
      let extensionName = "my-extension";
      try {
        const pkg = JSON.parse(filesWithLogo["package.json"]);
        extensionName = pkg.name || config.name || config.displayName?.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "my-extension";
      } catch {
        extensionName = config.name || config.displayName?.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "my-extension";
      }

      const response = await fetch("/api/vsce/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          azureToken: state.azureToken || "",
          publisher: state.publisherName,
          extensionName,
          files: filesWithLogo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.suggestion) {
          setErrorSuggestion(data.suggestion)
        }
        if (data.vsixBase64) {
          setFallbackVsix(data.vsixBase64)
        }
        throw new Error(data.error || "Failed to create extension package")
      }

      // Handle published: true - success!
      if (data.published) {
        setState((prev) => ({
          ...prev,
          publishedUrl:
            data.url || `https://marketplace.visualstudio.com/items?itemName=${state.publisherName}.${config.name}`,
          step: "done",
        }))
        return
      }

      // Handle published: false - VSIX created but not auto-published
      if (data.vsixBase64) {
        setFallbackVsix(data.vsixBase64)
      }
      if (data.error) {
        setError(data.error)
      }
      if (data.suggestion) {
        setErrorSuggestion(data.suggestion)
      } else if (!state.azureToken) {
        setErrorSuggestion(
          "Add an Azure PAT in Setup to enable auto-publishing, or download the VSIX and upload manually.",
        )
      }

      setState((prev) => ({
        ...prev,
        publishedUrl:
          data.manualUploadUrl || `https://marketplace.visualstudio.com/manage/publishers/${state.publisherName}`,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create extension package")
    } finally {
      setLoading(null)
    }
  }, [state.azureToken, state.publisherName, config.name, filesWithLogo, onSave])

  // Publish to Open VSX
  const publishToOpenVsx = useCallback(async () => {
    if (!state.publisherName) {
      setError("Publisher name is required")
      return
    }

    setLoading("publishing-openvsx")
    setError(null)
    setErrorSuggestion(null)
    setFallbackVsix(null)

    try {
      // Save extension before publishing
      if (onSave) {
        await onSave()
      }

      // Extract extension name from package.json
      let extensionName = "my-extension";
      try {
        const pkg = JSON.parse(filesWithLogo["package.json"]);
        extensionName = pkg.name || config.name || config.displayName?.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "my-extension";
      } catch {
        extensionName = config.name || config.displayName?.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "my-extension";
      }

      const response = await fetch("/api/openvsx/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openVsxToken: state.openVsxToken || "",
          publisher: state.publisherName,
          extensionName,
          files: filesWithLogo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.suggestion) {
          setErrorSuggestion(data.suggestion)
        }
        if (data.vsixBase64) {
          setFallbackVsix(data.vsixBase64)
        }
        throw new Error(data.error || "Failed to publish to Open VSX")
      }

      // Handle published: true - success!
      if (data.published) {
        setState((prev) => ({
          ...prev,
          openVsxPublishedUrl: data.url || `https://open-vsx.org/extension/${state.publisherName}/${config.name}`,
          step: "done",
        }))
        return
      }

      // Handle published: false - VSIX created but not auto-published
      if (data.vsixBase64) {
        setFallbackVsix(data.vsixBase64)
      }
      if (data.error) {
        setError(data.error)
      }
      if (data.suggestion) {
        setErrorSuggestion(data.suggestion)
      } else if (!state.openVsxToken) {
        setErrorSuggestion(
          "Add an Open VSX token in Setup to enable auto-publishing, or download the VSIX and upload manually.",
        )
      }

      setState((prev) => ({
        ...prev,
        openVsxPublishedUrl:
          data.manualUploadUrl || `https://open-vsx.org/extension/${state.publisherName}/${config.name}`,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish to Open VSX")
    } finally {
      setLoading(null)
    }
  }, [state.openVsxToken, state.publisherName, config.name, filesWithLogo, onSave])

  // Download .vsix package
  const downloadVsix = useCallback(async () => {
    setLoading("packaging")
    setError(null)

    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      const ext = zip.folder("extension")
      if (!ext) throw new Error("Failed to create zip")

      let hasIcon = false
      let iconPath = ""

      const pkgJson = filesWithLogo["package.json"]
      if (pkgJson) {
        try {
          const pkg = JSON.parse(pkgJson)
          if (pkg.icon) {
            iconPath = pkg.icon
          }
        } catch {}
      }

      for (const [path, content] of Object.entries(filesWithLogo)) {
        if (path.endsWith(".png") && content.startsWith("data:")) {
          const base64 = content.split(",")[1]
          ext.file(path, base64, { base64: true })
          if (path === iconPath || path.includes("icon")) {
            hasIcon = true
            iconPath = path
          }
        } else {
          ext.file(path, content)
        }
      }

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
</Types>`,
      )

      const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${config.name}" Version="${config.version || "0.0.1"}" Publisher="${state.publisherName || config.publisher}"/>
    <DisplayName>${config.displayName || config.name}</DisplayName>
    <Description>${config.description || ""}</Description>
    <Categories>${config.category || "Other"}</Categories>
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
    ${filesWithLogo["README.md"] ? '<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>' : ""}
    ${filesWithLogo["CHANGELOG.md"] ? '<Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>' : ""}
    ${hasIcon ? `<Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/${iconPath}" Addressable="true"/>` : ""}
  </Assets>
</PackageManifest>`
      zip.file("extension.vsixmanifest", manifest)

      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${state.publisherName || config.publisher || "publisher"}.${config.name || "extension"}-${config.version || "0.0.1"}.vsix`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create package")
    } finally {
      setLoading(null)
    }
  }, [filesWithLogo, config, state.publisherName])

  const downloadFallbackVsix = useCallback(() => {
    if (!fallbackVsix) return

    const binary = atob(fallbackVsix)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    const blob = new Blob([bytes], { type: "application/vsix" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${config.name || "extension"}-${config.version || "0.0.1"}.vsix`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [fallbackVsix, config.name, config.version])

  const commands = {
    login: `vsce login ${state.publisherName || config.publisher || "<publisher>"}`,
    publish: `vsce publish`,
    publishWithToken: `vsce publish -p ${state.azureToken || "<your-pat-token>"}`,
    openVsxPublish: `npx ovsx publish -p ${state.openVsxToken || "<your-token>"}`,
  }

  const isTokensStepValid = state.githubToken.length > 0 && state.publisherName.length > 0

  const renderTokensStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
          <p className="text-sm text-violet-200">
            Your tokens are stored locally in your browser and never sent to our servers except when making API calls on
            your behalf.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-zinc-300">
              GitHub Personal Access Token <span className="text-red-400">*</span>
            </Label>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=VSCode%20Extension%20Builder"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              Create Token <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <Input
              type={showGithubToken ? "text" : "password"}
              value={state.githubToken}
              onChange={(e) => updateState({ githubToken: e.target.value })}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowGithubToken(!showGithubToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showGithubToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-zinc-500">Required scopes: repo, read:user</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-zinc-300">
              Publisher Name <span className="text-red-400">*</span>
            </Label>
            <a
              href="https://marketplace.visualstudio.com/manage/createpublisher"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              Create Publisher <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Input
            value={state.publisherName}
            onChange={(e) => updateState({ publisherName: e.target.value })}
            placeholder="your-publisher-name"
            className="bg-zinc-900 border-zinc-700 text-zinc-100"
          />
          <p className="text-xs text-zinc-500">Your VS Code Marketplace publisher ID</p>
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <p className="text-sm font-medium text-zinc-300 mb-3">Marketplace Tokens (Optional)</p>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300 flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-400" />
                  VS Code Marketplace (Azure PAT)
                </Label>
                <a
                  href="https://dev.azure.com/_usersSettings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  Create Token <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative">
                <Input
                  type={showAzureToken ? "text" : "password"}
                  value={state.azureToken}
                  onChange={(e) => updateState({ azureToken: e.target.value })}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAzureToken(!showAzureToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showAzureToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-zinc-500">Required scope: Marketplace (Manage)</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-green-400" />
                  Open VSX Registry
                </Label>
                <a
                  href="https://open-vsx.org/user-settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  Create Token <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative">
                <Input
                  type={showOpenVsxToken ? "text" : "password"}
                  value={state.openVsxToken}
                  onChange={(e) => updateState({ openVsxToken: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenVsxToken(!showOpenVsxToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showOpenVsxToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-zinc-500">For publishing to open-vsx.org (Eclipse Foundation)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode indicators */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
        {state.githubToken && (state.azureToken || state.openVsxToken) ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-400">
              Auto mode enabled - Publishing to{" "}
              {state.azureToken && state.openVsxToken
                ? "both marketplaces"
                : state.azureToken
                  ? "VS Marketplace"
                  : "Open VSX"}
            </span>
          </>
        ) : state.githubToken ? (
          <>
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-400">GitHub only - Marketplace publishing will be manual</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">Enter GitHub token and publisher name to continue</span>
          </>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-800">
        <Button
          onClick={() => setCurrentStep("github")}
          disabled={!isTokensStepValid}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )

  const renderGithubStep = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-zinc-300 text-sm">Repository Path</Label>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              value={state.repoOwner}
              onChange={(e) => updateState({ repoOwner: e.target.value })}
              placeholder="owner"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:w-1/3"
            />
            <span className="text-zinc-500 hidden sm:inline">/</span>
            <Input
              value={state.repoName}
              onChange={(e) => updateState({ repoName: e.target.value })}
              placeholder="repository-name"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:flex-1"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Use your username for personal repos, or org name for organization repos
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-zinc-300">Private Repository</Label>
          <Switch checked={state.isPrivate} onCheckedChange={(checked) => updateState({ isPrivate: checked })} />
        </div>
      </div>

      {!hasGithubToken && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            GitHub token is required for auto mode
          </p>
        </div>
      )}

      <Button
        onClick={createGitHubRepo}
        disabled={!state.repoName || !state.repoOwner || loading !== null}
        className="w-full bg-violet-600 hover:bg-violet-700"
      >
        {loading === "creating-repo" || loading === "pushing" ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {loading === "creating-repo" ? "Creating Repository..." : "Pushing Files..."}
          </>
        ) : (
          <>
            <Github className="h-4 w-4 mr-2" />
            Create Repo & Push Files
          </>
        )}
      </Button>

      {state.createdRepo && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Repository created and files pushed!
          </p>
          <a
            href={state.createdRepo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
          >
            View on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  )

  const renderMarketplaceStep = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Package className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="font-medium">VS Code Marketplace</p>
            <p className="text-xs text-muted-foreground">
              {hasAzureToken ? "Ready to publish" : "Manual publishing (no Azure PAT)"}
            </p>
          </div>
        </div>

        {hasAzureToken && state.publisherName ? (
          <Button
            onClick={publishToMarketplace}
            disabled={loading !== null}
            className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
          >
            {loading === "publishing" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Publish to VS Marketplace
              </>
            )}
          </Button>
        ) : (
          <div className="text-xs text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            Add Azure PAT in Setup to enable auto-publish
          </div>
        )}

        {state.publishedUrl && (
          <div className="text-xs text-green-400 flex items-center gap-2 mt-2">
            <CheckCircle2 className="h-3 w-3" />
            <a className="underline" href={state.publishedUrl} target="_blank" rel="noreferrer">
              Published to VS Marketplace
            </a>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Globe className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <p className="font-medium">Open VSX Registry</p>
            <p className="text-xs text-muted-foreground">
              {hasOpenVsxToken ? "Ready to publish" : "Manual publishing (no token)"}
            </p>
          </div>
        </div>

        {hasOpenVsxToken && state.publisherName ? (
          <Button
            onClick={publishToOpenVsx}
            disabled={loading !== null}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            {loading === "publishing-openvsx" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Publish to Open VSX
              </>
            )}
          </Button>
        ) : (
          <div className="text-xs text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            Add Open VSX token in Setup to enable auto-publish
          </div>
        )}

        {state.openVsxPublishedUrl && (
          <div className="text-xs text-green-400 flex items-center gap-2 mt-2">
            <CheckCircle2 className="h-3 w-3" />
            <a className="underline" href={state.openVsxPublishedUrl} target="_blank" rel="noreferrer">
              Published to Open VSX
            </a>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or download package</span>
        </div>
      </div>

      {/* Download VSIX */}
      <div className="p-4 rounded-lg bg-muted/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Download Extension Package</p>
            <p className="text-xs text-muted-foreground">Get your .vsix file for manual publishing</p>
          </div>
          <Button size="sm" variant="secondary" onClick={downloadVsix} disabled={loading === "packaging"}>
            {loading === "packaging" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                .vsix
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Manual Publish Commands */}
      {(!hasAzureToken || !hasOpenVsxToken) && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Manual Publish Commands</p>
          <div className="space-y-2">
            {!hasAzureToken && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Package className="h-3 w-3 text-blue-400" />
                  VS Marketplace (login first, then publish):
                </p>
                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 font-mono text-xs">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <code className="flex-1">{commands.login}</code>
                  <button
                    onClick={() => copyToClipboard(commands.login, "login")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied === "login" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            )}
            {!hasOpenVsxToken && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Globe className="h-3 w-3 text-green-400" />
                  Open VSX:
                </p>
                <div className="flex items-center gap-2 bg-background rounded px-3 py-2 font-mono text-xs">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <code className="flex-1">{commands.openVsxPublish}</code>
                  <button
                    onClick={() => copyToClipboard(commands.openVsxPublish, "openvsx")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied === "openvsx" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Circle className="h-2 w-2" />
        For manual publishing, ensure <code className="bg-muted px-1 rounded">npm i -g @vscode/vsce ovsx</code> is
        installed
      </p>
    </div>
  )

  const renderDoneStep = () => {
    const publisher = state.publisherName || config.publisher || "publisher"
    const name = config.name || "extension"
    const extensionSlug = `${publisher}.${name}`

    const installLinks = [
      { label: "VS Code", url: `vscode:extension/${extensionSlug}`, color: "text-blue-400" },
      { label: "VS Code Insiders", url: `vscode-insiders:extension/${extensionSlug}`, color: "text-indigo-400" },
      { label: "Cursor", url: `cursor:extension/${extensionSlug}`, color: "text-cyan-400" },
      { label: "Windsurf", url: `windsurf:extension/${extensionSlug}`, color: "text-emerald-400" },
      { label: "Antigravity", url: `antigravity:extension/${extensionSlug}`, color: "text-amber-400" },
      {
        label: "Marketplace (web)",
        url: `https://marketplace.visualstudio.com/items?itemName=${extensionSlug}`,
        color: "text-blue-400",
      },
      { label: "Open VSX (web)", url: `https://open-vsx.org/extension/${publisher}/${name}`, color: "text-green-400" },
    ]

    return (
      <div className="space-y-4 text-center py-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto animate-in zoom-in-50 duration-300">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
          <h3 className="font-semibold text-lg">Extension Package Ready!</h3>
          <p className="text-sm text-muted-foreground mt-1">Your extension is ready for publishing</p>
        </div>

        {fallbackVsix && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-200">
            <Button
              onClick={downloadFallbackVsix}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download .vsix Package
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-300">
          <a
            href={
              state.publishedUrl ||
              `https://marketplace.visualstudio.com/manage/publishers/${state.publisherName || config.publisher}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Package className="h-4 w-4" />
            VS Marketplace
            <ExternalLink className="h-3 w-3" />
          </a>

          <a
            href={state.openVsxPublishedUrl || `https://open-vsx.org/extension/${state.publisherName}/${config.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
          >
            <Globe className="h-4 w-4" />
            Open VSX
            <ExternalLink className="h-3 w-3" />
          </a>

          {state.createdRepo && (
            <a
              href={state.createdRepo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-4">
          Done
        </Button>
        <div className="mt-4 space-y-2 text-left mx-auto max-w-md text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-center">Quick install links</p>
          <div className="space-y-1">
            {installLinks.map((link) => (
              <a
                key={link.label}
                className={`flex items-center gap-2 justify-center ${link.color} hover:text-foreground transition-colors`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="truncate text-center">
                  {link.label}: {link.url}
                </span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800 p-4 sm:p-6"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Rocket className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
            Publish Extension
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Deploy to GitHub, VS Code Marketplace & Open VSX</DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between py-2 sm:py-4 overflow-x-auto">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            const isActive = currentStep === step.id
            const isPast = steps.findIndex((s) => s.id === currentStep) > index
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id as PublishStep)}
                  className={`flex flex-col items-center gap-0.5 sm:gap-1 transition-all ${isActive ? "scale-105 sm:scale-110" : ""}`}
                  disabled={loading !== null}
                >
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors ${
                      isPast
                        ? "bg-green-500/20 text-green-400"
                        : isActive
                          ? "bg-violet-500/20 text-violet-400 ring-2 ring-violet-500/50"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-medium ${
                      isActive ? "text-violet-400" : isPast ? "text-green-400" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 -mt-4 sm:-mt-5 ${isPast ? "bg-green-500/50" : "bg-border"}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
            {errorSuggestion && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-400 text-sm">
                <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{errorSuggestion}</span>
              </div>
            )}
            {fallbackVsix && (
              <Button
                onClick={downloadFallbackVsix}
                variant="outline"
                className="w-full border-violet-500/30 text-violet-300 hover:bg-violet-500/10 bg-transparent"
              >
                <Download className="h-4 w-4 mr-2" />
                Download VSIX for Manual Upload
              </Button>
            )}
          </div>
        )}

        {/* Step Content */}
        <div className="space-y-4">
          {currentStep === "tokens" && renderTokensStep()}
          {currentStep === "github" && renderGithubStep()}
          {currentStep === "marketplace" && renderMarketplaceStep()}
          {currentStep === "done" && renderDoneStep()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
