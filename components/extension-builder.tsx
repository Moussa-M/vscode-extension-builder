"use client"

import { useState, useCallback, useEffect } from "react"
import { Header } from "./header"
import { TemplateSelector } from "./template-selector"
import { ConfigPanel } from "./config-panel"
import { CodePreview } from "./code-preview"
import { AiAssistant } from "./ai-assistant"
import Avatar from "boring-avatars"
import type { ExtensionConfig, Template, UserExtension } from "@/lib/types"
import { templates } from "@/lib/templates"
import { getStoredCredentials, saveUserExtension, getUserExtension } from "@/lib/storage"
import { colorPalettes } from "./logo-generator"
import { useToast } from "@/hooks/use-toast"

export function ExtensionBuilder() {
  const { toast } = useToast()
  const [currentExtensionId, setCurrentExtensionId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [config, setConfig] = useState<ExtensionConfig>({
    name: "",
    displayName: "",
    description: "",
    publisher: "",
    version: "0.0.1",
    category: "Other",
    activationEvents: [],
    contributes: {},
  })
  const [generatedCode, setGeneratedCode] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<"templates" | "config" | "ai">("templates")
  const [streamingFile, setStreamingFile] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState("")
  const [streamingFiles, setStreamingFiles] = useState<Record<string, string>>({})
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>()

  // Load publisher from stored credentials on mount
  useEffect(() => {
    const stored = getStoredCredentials()
    if (stored.publisherName) {
      setConfig((prev) => ({ ...prev, publisher: stored.publisherName }))
    }
  }, [])

  const handleSaveExtension = useCallback(async () => {
    if (!config.name && !config.displayName) {
      return false
    }

    const extension: UserExtension = {
      id: currentExtensionId || `ext_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: config.name || config.displayName.toLowerCase().replace(/\s+/g, "-"),
      displayName: config.displayName || config.name,
      description: config.description,
      tags: [config.category || "Other"],
      boilerplate: generatedCode,
      config,
      logoDataUrl,
      createdAt: currentExtensionId
        ? (await getUserExtension(currentExtensionId))?.createdAt || Date.now()
        : Date.now(),
      updatedAt: Date.now(),
    }

    await saveUserExtension(extension)
    setCurrentExtensionId(extension.id)

    toast({
      title: "Extension saved",
      description: `"${extension.displayName}" has been saved to My Extensions.`,
    })

    return true
  }, [config, generatedCode, logoDataUrl, currentExtensionId, toast])

  const generateLogo = useCallback((template: Template, extensionName: string) => {
    if (!template || template.id === "scratch") return

    const suggestedLogo = template.suggestedLogo
    const variant = suggestedLogo?.variant || "marble"
    const paletteIndex = suggestedLogo?.palette || 0
    const seed = suggestedLogo?.seed || extensionName || "extension"
    const colors = colorPalettes[paletteIndex]?.colors || colorPalettes[0].colors

    const container = document.createElement("div")
    container.style.cssText = "position:absolute;left:-9999px;top:-9999px;"
    document.body.appendChild(container)

    import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(container)
      root.render(<Avatar name={seed} variant={variant} size={128} colors={colors} square />)

      setTimeout(() => {
        const svgElement = container.querySelector("svg")
        if (!svgElement) {
          root.unmount()
          document.body.removeChild(container)
          return
        }

        const clonedSvg = svgElement.cloneNode(true) as SVGElement
        clonedSvg.setAttribute("width", "128")
        clonedSvg.setAttribute("height", "128")

        const svgData = new XMLSerializer().serializeToString(clonedSvg)
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
        const svgUrl = URL.createObjectURL(svgBlob)

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          const canvas = document.createElement("canvas")
          canvas.width = 128
          canvas.height = 128
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(img, 0, 0, 128, 128)
            const dataUrl = canvas.toDataURL("image/png")
            setLogoDataUrl(dataUrl)
            setGeneratedCode((prev) => {
              const newCode = { ...prev }
              newCode["images/icon.png"] = dataUrl
              if (newCode["package.json"]) {
                try {
                  const pkg = JSON.parse(newCode["package.json"])
                  pkg.icon = "images/icon.png"
                  newCode["package.json"] = JSON.stringify(pkg, null, 2)
                } catch {}
              }
              return newCode
            })
          }
          URL.revokeObjectURL(svgUrl)
          root.unmount()
          document.body.removeChild(container)
        }
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          root.unmount()
          document.body.removeChild(container)
        }
        img.src = svgUrl
      }, 150)
    })
  }, [])

  const handleTemplateSelect = (
    template: Template & {
      isUserExtension?: boolean
      userExtensionId?: string
      logoDataUrl?: string
      userExtension?: UserExtension
    },
  ) => {
    setSelectedTemplate(template)
    const stored = getStoredCredentials()

    if (template.isUserExtension && template.userExtension) {
      const ext = template.userExtension
      setCurrentExtensionId(ext.id)
      setConfig(ext.config)
      setGeneratedCode(ext.boilerplate)
      setLogoDataUrl(ext.logoDataUrl)
      setActiveTab("config")
      return
    }

    // Reset for new extension
    setCurrentExtensionId(null)

    if (template.id === "scratch") {
      setConfig({
        name: "",
        displayName: "",
        description: "",
        publisher: stored.publisherName || "",
        version: "0.0.1",
        category: "Other",
        activationEvents: [],
        contributes: {},
      })
      setGeneratedCode({})
      setLogoDataUrl(undefined)
      setActiveTab("ai")
    } else {
      const baseConfig: ExtensionConfig = {
        name: template.suggestedConfig.name,
        displayName: template.suggestedConfig.displayName,
        description: template.suggestedConfig.description,
        publisher: stored.publisherName || template.suggestedConfig.publisher,
        version: "0.0.1",
        category: template.suggestedConfig.category,
        activationEvents: template.defaultConfig?.activationEvents || [],
        contributes: template.defaultConfig?.contributes || {},
      }
      setConfig(baseConfig)
      setGeneratedCode({ ...template.boilerplate })
      setLogoDataUrl(undefined)
      setActiveTab("config")
      generateLogo(template, template.suggestedConfig.name)
    }
  }

  const handleConfigChange = (newConfig: ExtensionConfig) => {
    setConfig(newConfig)

    // Sync config changes to package.json immediately when user changes config
    if (Object.keys(generatedCode).length > 0 && generatedCode["package.json"]) {
      try {
        const pkg = JSON.parse(generatedCode["package.json"])
        let changed = false

        if (newConfig.name && pkg.name !== newConfig.name) {
          pkg.name = newConfig.name
          changed = true
        }
        if (newConfig.displayName && pkg.displayName !== newConfig.displayName) {
          pkg.displayName = newConfig.displayName
          changed = true
        }
        if (newConfig.description && pkg.description !== newConfig.description) {
          pkg.description = newConfig.description
          changed = true
        }
        if (newConfig.publisher && pkg.publisher !== newConfig.publisher) {
          pkg.publisher = newConfig.publisher
          changed = true
        }
        if (newConfig.version && pkg.version !== newConfig.version) {
          pkg.version = newConfig.version
          changed = true
        }
        if (newConfig.category && pkg.categories?.[0] !== newConfig.category) {
          pkg.categories = [newConfig.category]
          changed = true
        }

        if (changed) {
          setGeneratedCode((prev) => ({ ...prev, "package.json": JSON.stringify(pkg, null, 2) }))
        }
      } catch {}
    }
  }

  const handleAiGenerate = useCallback((code: Record<string, string>, extractedConfig?: Partial<ExtensionConfig>) => {
    setGeneratedCode((prev) => ({ ...prev, ...code }))

    if (extractedConfig) {
      setConfig((prev) => ({
        ...prev,
        name: extractedConfig.name || prev.name,
        displayName: extractedConfig.displayName || prev.displayName,
        description: extractedConfig.description || prev.description,
        publisher: extractedConfig.publisher || prev.publisher,
        version: extractedConfig.version || prev.version,
        category: extractedConfig.category || prev.category,
        activationEvents: extractedConfig.activationEvents || prev.activationEvents,
        contributes: extractedConfig.contributes || prev.contributes,
      }))
    }
  }, [])

  const handleConfigUpdate = useCallback((newConfig: ExtensionConfig) => {
    setConfig(newConfig)
  }, [])

  const handleCodeChange = useCallback((files: Record<string, string>) => {
    setGeneratedCode(files)

    if (files["images/icon.png"]) {
      setLogoDataUrl(files["images/icon.png"])
    }

    if (files["package.json"]) {
      try {
        const pkg = JSON.parse(files["package.json"])
        setConfig((prev) => ({
          ...prev,
          name: pkg.name || prev.name,
          displayName: pkg.displayName || prev.displayName,
          description: pkg.description || prev.description,
          publisher: pkg.publisher || prev.publisher,
          version: pkg.version || prev.version,
          category: pkg.categories?.[0] || prev.category,
        }))
      } catch {}
    }
  }, [])

  const handleStreamingUpdate = useCallback((allFiles: Record<string, string>, currentFile: string | null) => {
    setStreamingFiles(allFiles)
    setStreamingFile(currentFile)
    if (currentFile && allFiles[currentFile]) {
      setStreamingContent(allFiles[currentFile])
    }
  }, [])

  const handleLogoGenerated = useCallback((dataUrl: string) => {
    setLogoDataUrl(dataUrl)
    setGeneratedCode((prev) => {
      const newCode = { ...prev }
      newCode["images/icon.png"] = dataUrl
      if (newCode["package.json"]) {
        try {
          const pkg = JSON.parse(newCode["package.json"])
          pkg.icon = "images/icon.png"
          newCode["package.json"] = JSON.stringify(pkg, null, 2)
        } catch {}
      }
      return newCode
    })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header extensionName={config.displayName || config.name} />
      <main className="w-full max-w-none px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-8">
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-border overflow-x-auto">
              <button
                onClick={() => setActiveTab("templates")}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "templates"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => setActiveTab("config")}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "config"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Configuration
              </button>
              <button
                onClick={() => setActiveTab("ai")}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "ai"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                AI Generator
              </button>
            </div>

            {activeTab === "templates" && (
              <TemplateSelector
                templates={templates}
                selectedTemplate={selectedTemplate}
                onSelect={handleTemplateSelect}
              />
            )}
            {activeTab === "config" && (
              <ConfigPanel
                config={config}
                onChange={handleConfigChange}
                selectedTemplate={selectedTemplate}
                onLogoGenerated={handleLogoGenerated}
              />
            )}
            {activeTab === "ai" && (
              <AiAssistant
                config={config}
                selectedTemplate={selectedTemplate}
                generatedCode={generatedCode}
                onGenerate={handleAiGenerate}
                onConfigUpdate={handleConfigUpdate}
                onStreamingUpdate={handleStreamingUpdate}
              />
            )}
          </div>

          <div className="xl:sticky xl:top-4 h-fit min-w-0">
            <CodePreview
              code={generatedCode}
              config={config}
              selectedTemplate={selectedTemplate}
              onCodeChange={handleCodeChange}
              streamingFile={streamingFile}
              streamingContent={streamingContent}
              logoDataUrl={logoDataUrl}
              streamingFiles={streamingFiles}
              onSave={handleSaveExtension}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
