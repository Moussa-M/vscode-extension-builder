"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Github, Trash2, Package, Loader2, Check, X, ExternalLink } from "lucide-react"
import { getStoredCredentials } from "@/lib/storage"
import type { UserExtension } from "@/lib/types"

interface ExtensionManagerModalProps {
  isOpen: boolean
  onClose: () => void
  extension: UserExtension | null
  onDelete: () => void
}

type ActionStatus = "idle" | "loading" | "success" | "error"

interface ActionState {
  github: { status: ActionStatus; message: string }
  vscode: { status: ActionStatus; message: string }
  openvsx: { status: ActionStatus; message: string }
  local: { status: ActionStatus; message: string }
}

export function ExtensionManagerModal({ isOpen, onClose, extension, onDelete }: ExtensionManagerModalProps) {
  const [credentials, setCredentials] = useState(getStoredCredentials)
  const [repoOwner, setRepoOwner] = useState("")
  const [repoName, setRepoName] = useState("")
  const [actionState, setActionState] = useState<ActionState>({
    github: { status: "idle", message: "" },
    vscode: { status: "idle", message: "" },
    openvsx: { status: "idle", message: "" },
    local: { status: "idle", message: "" },
  })

  useEffect(() => {
    if (extension) {
      const creds = getStoredCredentials()
      if (creds.githubToken) {
        fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${creds.githubToken}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.login) {
              setRepoOwner(data.login)
            }
          })
          .catch(() => {
            const repoUrl = extension.code?.["package.json"]
            if (repoUrl) {
              try {
                const pkg = JSON.parse(repoUrl)
                if (pkg.repository?.url) {
                  const match = pkg.repository.url.match(/github\.com\/([^/]+)\//)
                  if (match) setRepoOwner(match[1])
                }
              } catch {}
            }
          })
      }

      setRepoName(extension.config.name || extension.name || "")
    }
  }, [extension])

  useEffect(() => {
    if (isOpen) {
      setActionState({
        github: { status: "idle", message: "" },
        vscode: { status: "idle", message: "" },
        openvsx: { status: "idle", message: "" },
        local: { status: "idle", message: "" },
      })
    }
  }, [isOpen, extension?.id])

  if (!extension) return null

  const updateActionState = (key: keyof ActionState, status: ActionStatus, message: string) => {
    setActionState((prev) => ({ ...prev, [key]: { status, message } }))
  }

  const handleDeleteGitHub = async () => {
    if (!credentials.githubToken || !repoOwner || !repoName) {
      updateActionState("github", "error", "Missing GitHub token, owner, or repo name")
      return
    }

    updateActionState("github", "loading", "Deleting repository...")

    try {
      const response = await fetch("/api/github/delete-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: credentials.githubToken,
          owner: repoOwner,
          repo: repoName,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        updateActionState("github", "success", "Repository deleted successfully")
      } else {
        updateActionState("github", "error", data.error || "Failed to delete repository")
      }
    } catch (error) {
      updateActionState("github", "error", error instanceof Error ? error.message : "Failed to delete repository")
    }
  }

  const handleUnpublishVSCode = async () => {
    if (!credentials.azureToken || !extension.config.publisher || !extension.config.name) {
      updateActionState("vscode", "error", "Missing Azure token or extension info")
      return
    }

    updateActionState("vscode", "loading", "Unpublishing from VS Code Marketplace...")

    try {
      const response = await fetch("/api/vsce/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: credentials.azureToken,
          publisher: extension.config.publisher,
          extensionName: extension.config.name,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        updateActionState("vscode", "success", "Unpublished from VS Code Marketplace")
      } else {
        updateActionState("vscode", "error", data.error || "Failed to unpublish")
      }
    } catch (error) {
      updateActionState("vscode", "error", error instanceof Error ? error.message : "Failed to unpublish")
    }
  }

  const handleUnpublishOpenVSX = async () => {
    if (!credentials.openVsxToken || !extension.config.publisher || !extension.config.name) {
      updateActionState("openvsx", "error", "Missing Open VSX token or extension info")
      return
    }

    updateActionState("openvsx", "loading", "Unpublishing from Open VSX...")

    try {
      const response = await fetch("/api/openvsx/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: credentials.openVsxToken,
          namespace: extension.config.publisher,
          extensionName: extension.config.name,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        updateActionState("openvsx", "success", "Unpublished from Open VSX")
      } else {
        updateActionState("openvsx", "error", data.error || "Failed to unpublish")
      }
    } catch (error) {
      updateActionState("openvsx", "error", error instanceof Error ? error.message : "Failed to unpublish")
    }
  }

  const handleDeleteLocal = async () => {
    updateActionState("local", "loading", "Deleting local extension...")

    try {
      onDelete()
      updateActionState("local", "success", "Extension deleted locally")
      setTimeout(() => onClose(), 1000)
    } catch (error) {
      updateActionState("local", "error", error instanceof Error ? error.message : "Failed to delete")
    }
  }

  const renderStatusIcon = (status: ActionStatus) => {
    switch (status) {
      case "loading":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case "success":
        return <Check className="w-4 h-4 text-green-500" />
      case "error":
        return <X className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            Manage Extension
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Unpublish or delete "{extension.displayName || extension.name}" from various platforms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-200">
              These actions are irreversible. Make sure you have backups if needed.
            </p>
          </div>

          <Tabs defaultValue="github" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto">
              <TabsTrigger value="github" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5">
                GitHub
              </TabsTrigger>
              <TabsTrigger value="vscode" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5">
                VS Code
              </TabsTrigger>
              <TabsTrigger value="openvsx" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5">
                Open VSX
              </TabsTrigger>
              <TabsTrigger value="local" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5">
                Local
              </TabsTrigger>
            </TabsList>

            <TabsContent value="github" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  <span className="font-medium">Delete GitHub Repository</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repoOwner">Repository Owner</Label>
                  <Input
                    id="repoOwner"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    placeholder="e.g., your-username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repoName">Repository Name</Label>
                  <Input
                    id="repoName"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder={extension.config.name || "extension-name"}
                  />
                </div>

                {!credentials.githubToken && (
                  <p className="text-xs text-muted-foreground">
                    GitHub token required. Add it in the Publish settings.
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderStatusIcon(actionState.github.status)}
                    {actionState.github.message && (
                      <span
                        className={`text-xs ${
                          actionState.github.status === "error"
                            ? "text-red-400"
                            : actionState.github.status === "success"
                              ? "text-green-400"
                              : ""
                        }`}
                      >
                        {actionState.github.message}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteGitHub}
                    disabled={actionState.github.status === "loading" || !credentials.githubToken}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Repo
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vscode" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-400" />
                    <span className="font-medium">VS Code Marketplace</span>
                  </div>
                  <a
                    href={`https://marketplace.visualstudio.com/items?itemName=${extension.config.publisher}.${extension.config.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Publisher:</span>
                    <span>{extension.config.publisher || "Not set"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Extension:</span>
                    <span>{extension.config.name || "Not set"}</span>
                  </div>
                </div>

                {!credentials.azureToken && (
                  <p className="text-xs text-muted-foreground">
                    Azure DevOps token required. Add it in the Publish settings.
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderStatusIcon(actionState.vscode.status)}
                    {actionState.vscode.message && (
                      <span
                        className={`text-xs ${
                          actionState.vscode.status === "error"
                            ? "text-red-400"
                            : actionState.vscode.status === "success"
                              ? "text-green-400"
                              : ""
                        }`}
                      >
                        {actionState.vscode.message}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUnpublishVSCode}
                    disabled={actionState.vscode.status === "loading" || !credentials.azureToken}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Unpublish
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="openvsx" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-400" />
                    <span className="font-medium">Open VSX Registry</span>
                  </div>
                  <a
                    href={`https://open-vsx.org/extension/${extension.config.publisher}/${extension.config.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Namespace:</span>
                    <span>{extension.config.publisher || "Not set"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Extension:</span>
                    <span>{extension.config.name || "Not set"}</span>
                  </div>
                </div>

                {!credentials.openVsxToken && (
                  <p className="text-xs text-muted-foreground">
                    Open VSX token required. Add it in the Publish settings.
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderStatusIcon(actionState.openvsx.status)}
                    {actionState.openvsx.message && (
                      <span
                        className={`text-xs ${
                          actionState.openvsx.status === "error"
                            ? "text-red-400"
                            : actionState.openvsx.status === "success"
                              ? "text-green-400"
                              : ""
                        }`}
                      >
                        {actionState.openvsx.message}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUnpublishOpenVSX}
                    disabled={actionState.openvsx.status === "loading" || !credentials.openVsxToken}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Unpublish
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="local" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="font-medium">Delete Local Extension</span>
                </div>

                <p className="text-sm text-muted-foreground">
                  This will remove the extension from your browser storage. It will not affect published versions on
                  GitHub or marketplaces.
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderStatusIcon(actionState.local.status)}
                    {actionState.local.message && (
                      <span
                        className={`text-xs ${
                          actionState.local.status === "error"
                            ? "text-red-400"
                            : actionState.local.status === "success"
                              ? "text-green-400"
                              : ""
                        }`}
                      >
                        {actionState.local.message}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteLocal}
                    disabled={actionState.local.status === "loading"}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Locally
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
