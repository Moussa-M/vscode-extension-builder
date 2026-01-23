"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Download, ExternalLink, Loader2, RefreshCw, Package } from "lucide-react"
import { getStoredCredentials } from "@/lib/storage"

interface PublishedExtension {
  extensionId?: string
  extensionName?: string
  name?: string
  displayName: string
  shortDescription?: string
  description?: string
  publisher?: string
  namespace?: string
  version: string
  lastUpdated?: string
  timestamp?: string
  downloadUrl?: string
  marketplaceUrl: string
}

interface PublishedExtensionsModalProps {
  isOpen: boolean
  onClose: () => void
  onImport?: (vsixUrl: string) => void
}

export function PublishedExtensionsModal({ isOpen, onClose, onImport }: PublishedExtensionsModalProps) {
  const [vsCodeExtensions, setVsCodeExtensions] = useState<PublishedExtension[]>([])
  const [openVsxExtensions, setOpenVsxExtensions] = useState<PublishedExtension[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [publisherName, setPublisherName] = useState("")

  // Load publisher name from saved credentials when modal opens
  useEffect(() => {
    if (isOpen) {
      const credentials = getStoredCredentials()
      if (credentials.publisherName) {
        setPublisherName(credentials.publisherName)
      }
    }
  }, [isOpen])

  const fetchVsCodeExtensions = async () => {
    setLoading(true)
    setError("")

    try {
      const credentials = getStoredCredentials()
      
      if (!credentials.azureToken) {
        setError("Azure PAT token not found. Please add it in the publish settings.")
        return
      }

      const publisher = publisherName || credentials.publisherName || ""
      
      if (!publisher) {
        setError("Publisher name not found. Please enter it above.")
        return
      }

      const response = await fetch("/api/vsce/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          azureToken: credentials.azureToken,
          publisher,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch extensions")
      }

      setVsCodeExtensions(data.extensions)
    } catch (err) {
      console.error("[v0] Failed to fetch VS Code extensions:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch extensions")
    } finally {
      setLoading(false)
    }
  }

  const fetchOpenVsxExtensions = async () => {
    setLoading(true)
    setError("")

    try {
      const credentials = getStoredCredentials()
      const publisher = publisherName || credentials.publisherName || ""
      
      if (!publisher) {
        setError("Publisher name not found. Please enter it above.")
        return
      }

      const response = await fetch("/api/openvsx/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publisher }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch extensions")
      }

      setOpenVsxExtensions(data.extensions)
    } catch (err) {
      console.error("[v0] Failed to fetch OpenVSX extensions:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch extensions")
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (downloadUrl: string) => {
    if (!downloadUrl) {
      alert("Download URL not available for this extension")
      return
    }

    if (onImport) {
      onImport(downloadUrl)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            My Published Extensions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Publisher Name</Label>
            <div className="flex gap-2">
              <Input
                value={publisherName}
                onChange={(e) => setPublisherName(e.target.value)}
                placeholder="Your publisher name"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your publisher name to fetch your published extensions
            </p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Tabs defaultValue="vscode" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vscode">VS Code Marketplace</TabsTrigger>
              <TabsTrigger value="openvsx">Open VSX</TabsTrigger>
            </TabsList>

            <TabsContent value="vscode" className="space-y-3 mt-4">
              <Button
                onClick={fetchVsCodeExtensions}
                disabled={loading || !publisherName}
                size="sm"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Fetch My Extensions
                  </>
                )}
              </Button>

              <ScrollArea className="h-[400px]">
                {vsCodeExtensions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No extensions found. Click "Fetch My Extensions" to load them.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vsCodeExtensions.map((ext) => (
                      <div
                        key={ext.extensionId || ext.extensionName}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{ext.displayName}</h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {ext.publisher}.{ext.extensionName || ext.name}
                            </p>
                            {ext.shortDescription && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {ext.shortDescription}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                v{ext.version}
                              </Badge>
                              {ext.lastUpdated && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(ext.lastUpdated).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {ext.downloadUrl && onImport && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleImport(ext.downloadUrl!)}
                                title="Import extension"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                            >
                              <a href={ext.marketplaceUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="openvsx" className="space-y-3 mt-4">
              <Button
                onClick={fetchOpenVsxExtensions}
                disabled={loading || !publisherName}
                size="sm"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Fetch My Extensions
                  </>
                )}
              </Button>

              <ScrollArea className="h-[400px]">
                {openVsxExtensions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No extensions found. Click "Fetch My Extensions" to load them.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {openVsxExtensions.map((ext) => (
                      <div
                        key={`${ext.namespace}.${ext.name}`}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{ext.displayName}</h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {ext.namespace}.{ext.name}
                            </p>
                            {ext.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {ext.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                v{ext.version}
                              </Badge>
                              {ext.timestamp && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(ext.timestamp).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {ext.downloadUrl && onImport && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleImport(ext.downloadUrl!)}
                                title="Import extension"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                            >
                              <a href={ext.marketplaceUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
