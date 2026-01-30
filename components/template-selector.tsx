"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  Check,
  Command,
  Palette,
  FileCode,
  Layout,
  Database,
  Wand2,
  Sparkles,
  ChevronRight,
  File,
  User,
  Settings,
  Upload,
  Loader2,
  Download,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { Template } from "@/lib/types"
import { scratchTemplate } from "@/lib/templates"
import { getAllUserExtensions, deleteUserExtension, saveUserExtension, type UserExtension } from "@/lib/storage"
import { motion, AnimatePresence } from "framer-motion"
import { ExtensionManagerModal } from "./extension-manager-modal"
import { PublishedExtensionsModal } from "./published-extensions-modal"
import JSZip from "jszip"

const iconMap: Record<string, React.ReactNode> = {
  command: <Command className="w-5 h-5" />,
  theme: <Palette className="w-5 h-5" />,
  snippet: <FileCode className="w-5 h-5" />,
  ai: <Wand2 className="w-5 h-5" />,
  webview: <Layout className="w-5 h-5" />,
  language: <Database className="w-5 h-5" />,
  scratch: <Sparkles className="w-5 h-5" />,
  user: <User className="w-5 h-5" />,
}

interface TemplateSelectorProps {
  templates: Template[]
  selectedTemplate: Template | null
  onSelect: (template: Template) => void
}

function userExtensionToTemplate(
  ext: UserExtension,
): Template & { isUserExtension: true; userExtensionId: string; logoDataUrl?: string; userExtension: UserExtension } {
  return {
    id: `user-ext-${ext.id}`,
    userExtensionId: ext.id,
    isUserExtension: true,
    userExtension: ext,
    name: ext.displayName || ext.name,
    description: ext.description || "My saved extension",
    icon: "user",
    tags: ext.tags.length > 0 ? ext.tags : ["my extension"],
    boilerplate: ext.boilerplate,
    suggestedConfig: ext.config,
    logoDataUrl: ext.logoDataUrl,
  }
}

export function TemplateSelector({ templates, selectedTemplate, onSelect }: TemplateSelectorProps) {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [userExtensions, setUserExtensions] = useState<UserExtension[]>([])
  const [isLoadingExtensions, setIsLoadingExtensions] = useState(true)
  const [managingExtension, setManagingExtension] = useState<UserExtension | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showPublishedModal, setShowPublishedModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const maxRetries = 3

    const loadExtensions = async () => {
      try {
        const extensions = await getAllUserExtensions()
        if (mounted) {
          setUserExtensions(extensions)
          setIsLoadingExtensions(false)
        }
      } catch (error) {
        console.error("Failed to load extensions:", error)
        // Retry if fingerprint might not be ready yet
        if (retryCount < maxRetries && mounted) {
          retryCount++
          setTimeout(loadExtensions, 1000)
        } else if (mounted) {
          setIsLoadingExtensions(false)
        }
      }
    }

    loadExtensions()

    return () => {
      mounted = false
    }
  }, [])

  const handleImportZip = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportError(null)

    try {
      const zip = await JSZip.loadAsync(file)

      // Find package.json (might be in root or in a folder)
      let packageJsonContent: string | null = null
      let rootPath = ""

      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (path.endsWith("package.json") && !zipEntry.dir) {
          const content = await zipEntry.async("string")
          try {
            JSON.parse(content) // Validate it's valid JSON
            packageJsonContent = content
            // Get root path (e.g., "my-extension/" or "")
            rootPath = path.replace("package.json", "")
            break
          } catch {
            continue
          }
        }
      }

      if (!packageJsonContent) {
        throw new Error("No valid package.json found in ZIP")
      }

      const packageJson = JSON.parse(packageJsonContent)

      // Extract all text files
      const boilerplate: Record<string, string> = {}
      let logoDataUrl: string | undefined

      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue

        // Remove root path prefix
        const relativePath = rootPath ? path.replace(rootPath, "") : path
        if (!relativePath) continue

        // Skip node_modules and other unnecessary files
        if (
          relativePath.startsWith("node_modules/") ||
          relativePath.startsWith(".git/") ||
          relativePath.endsWith(".vsix") ||
          relativePath === ".DS_Store"
        ) {
          continue
        }

        // Check if it's an image
        if (relativePath.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) {
          const blob = await zipEntry.async("blob")
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          
          // Store image as data URL in boilerplate
          boilerplate[relativePath] = dataUrl
          
          // Check if this is the icon referenced in package.json
          if (packageJson.icon && relativePath.includes(packageJson.icon.replace("./", ""))) {
            logoDataUrl = dataUrl
          }
          continue
        }

        // Read text files
        try {
          const content = await zipEntry.async("string")
          boilerplate[relativePath] = content
        } catch {
          // Skip binary files
        }
      }

      // Create user extension from imported data
      const newExtension: UserExtension = {
        id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: packageJson.name || file.name.replace(".zip", ""),
        displayName: packageJson.displayName || packageJson.name || "Imported Extension",
        description: packageJson.description || "Imported from ZIP",
        tags: ["imported"],
        boilerplate,
        config: {
          name: packageJson.name || "",
          displayName: packageJson.displayName || "",
          description: packageJson.description || "",
          publisher: packageJson.publisher || "",
          version: packageJson.version || "0.0.1",
          category: packageJson.categories?.[0] || "Other",
          activationEvents: packageJson.activationEvents || [],
          contributes: packageJson.contributes || {},
        },
        logoDataUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await saveUserExtension(newExtension)
      setUserExtensions((prev) => [newExtension, ...prev])

      // Select the imported extension
      onSelect(userExtensionToTemplate(newExtension))
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import ZIP")
    } finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const allTemplates = [scratchTemplate, ...templates.filter((t) => t.id !== "scratch")]

  const toggleExpand = (templateId: string) => {
    setExpandedTemplate(expandedTemplate === templateId ? null : templateId)
  }

  const handleDeleteUserExtension = async (extId: string) => {
    await deleteUserExtension(extId)
    setUserExtensions((prev) => prev.filter((ext) => ext.id !== extId))
  }

  const handleManageExtension = (e: React.MouseEvent, ext: UserExtension) => {
    e.stopPropagation()
    setManagingExtension(ext)
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()
    switch (ext) {
      case "ts":
        return <File className="w-3.5 h-3.5 text-blue-400" />
      case "json":
        return <File className="w-3.5 h-3.5 text-yellow-400" />
      case "js":
        return <File className="w-3.5 h-3.5 text-yellow-300" />
      case "css":
        return <File className="w-3.5 h-3.5 text-pink-400" />
      default:
        return <File className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  const renderTemplateCard = (
    template: Template & {
      isUserExtension?: boolean
      userExtensionId?: string
      logoDataUrl?: string
      userExtension?: UserExtension
    },
    isScratch = false,
  ) => {
    const isSelected = selectedTemplate?.id === template.id
    const isExpanded = expandedTemplate === template.id
    const hasFiles = Object.keys(template.boilerplate).length > 0
    const isUserExt = template.isUserExtension

    return (
      <motion.div
        key={template.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className={`cursor-pointer transition-all duration-200 overflow-hidden ${
            isSelected
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "hover:border-primary/50 hover:bg-muted/30"
          } ${isScratch ? "border-dashed" : ""} ${isUserExt ? "border-violet-500/30" : ""}`}
        >
          <CardHeader className="pb-2" onClick={() => onSelect(template)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isUserExt && template.logoDataUrl ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={template.logoDataUrl || "/placeholder.svg"}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className={`p-2.5 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isScratch
                          ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-400"
                          : isUserExt
                            ? "bg-violet-500/20 text-violet-400"
                            : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {iconMap[template.icon] || <Command className="w-5 h-5" />}
                  </div>
                )}
                <div>
                  <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                  <CardDescription className="text-xs mt-0.5 line-clamp-1">{template.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isUserExt && template.userExtension && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={(e) => handleManageExtension(e, template.userExtension!)}
                    title="Manage extension"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                )}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </motion.div>
                )}
                {hasFiles && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(template.id)
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {template.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className={`text-xs ${isSelected ? "bg-primary/10 text-primary" : ""}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <AnimatePresence>
              {isExpanded && hasFiles && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5" />
                      Included Files ({Object.keys(template.boilerplate).length})
                    </div>
                    <div className="space-y-1">
                      {Object.keys(template.boilerplate).map((filename, index) => (
                        <motion.div
                          key={filename}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-2 rounded bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {getFileIcon(filename)}
                          <span className="font-mono">{filename}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isScratch && isSelected && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 pt-3 border-t border-dashed border-border"
              >
                <div className="flex items-start gap-2 p-2 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
                  <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Head to the <span className="font-medium text-foreground">AI Generator</span> tab and describe your
                    extension. The AI will create all files from scratch based on your description.
                  </p>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Choose a Template</h2>
        <p className="text-sm text-muted-foreground">Start with a boilerplate or let AI generate from scratch</p>
      </div>

      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="space-y-3 pr-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-400">My Extensions</span>
              {userExtensions.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-400">
                  {userExtensions.length}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 bg-transparent"
                onClick={() => setShowPublishedModal(true)}
              >
                <Download className="w-3 h-3" />
                My Published
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleImportZip}
                className="hidden"
                id="zip-import"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 bg-transparent"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3" />
                    Import ZIP
                  </>
                )}
              </Button>
            </div>
          </div>

          {importError && <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">{importError}</div>}

          {isLoadingExtensions ? (
            <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading your extensions...
            </div>
          ) : userExtensions.length > 0 ? (
            <>
              {userExtensions.map((ext) => renderTemplateCard(userExtensionToTemplate(ext)))}
              <div className="border-t border-border my-4" />
            </>
          ) : (
            <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
              No saved extensions yet. Create one or import from ZIP.
            </div>
          )}

          {/* Starter templates section */}
          <div className="flex items-center gap-2 pt-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Starter Templates</span>
          </div>
          {allTemplates.map((template) => renderTemplateCard(template, template.id === "scratch"))}
        </div>
      </ScrollArea>

      <ExtensionManagerModal
        isOpen={!!managingExtension}
        onClose={() => setManagingExtension(null)}
        extension={managingExtension}
        onDelete={() => {
          if (managingExtension) {
            handleDeleteUserExtension(managingExtension.id)
          }
        }}
      />

      <PublishedExtensionsModal
        isOpen={showPublishedModal}
        onClose={() => setShowPublishedModal(false)}
        onImport={async (vsixUrl) => {
          // TODO: Implement VSIX download and import
          console.log("[App] Import VSIX from:", vsixUrl)
          alert("VSIX import coming soon! For now, download the VSIX manually and import via ZIP.")
        }}
      />
    </div>
  )
}
