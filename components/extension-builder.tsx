"use client"

import { useState, useCallback, useEffect } from "react"
import { Header } from "./header"
import { TemplateSelector } from "./template-selector"
import { ConfigPanel } from "./config-panel"
import { CodePreview } from "./code-preview"
import { AiAssistant } from "./ai-assistant"
import Avatar from "boring-avatars"
import type { ExtensionConfig, Template } from "@/lib/types"
import { templates } from "@/lib/templates"
import {
  getStoredCredentials,
  getStoredTemplateConfig,
  getStoredTemplateIcon,
  saveTemplateConfig,
  saveTemplateIcon,
} from "@/lib/storage"
import { colorPalettes } from "./logo-generator"

export function ExtensionBuilder() {
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
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>()

  useEffect(() => {
    const stored = getStoredCredentials()
    if (stored.publisherName) {
      setConfig((prev) => ({
        ...prev,
        publisher: prev.publisher || stored.publisherName,
      }))
    }
  }, [])

  const generateLogo = useCallback((template: Template, extensionName: string) => {
    if (!template || template.id === "scratch") return

    const suggestedLogo = template.suggestedLogo
    const variant = suggestedLogo?.variant || "marble"
    const paletteIndex = suggestedLogo?.palette || 0
    const seed = suggestedLogo?.seed || extensionName || "extension"
    const colors = colorPalettes[paletteIndex]?.colors || colorPalettes[0].colors

    // Create hidden container
    const container = document.createElement("div")
    container.style.cssText = "position:absolute;left:-9999px;top:-9999px;"
    document.body.appendChild(container)

    // Dynamically import and render
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
            // Also add to generated files
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

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    const stored = getStoredCredentials()
    const storedTemplateConfig = getStoredTemplateConfig(template.id)
    const storedTemplateIcon = getStoredTemplateIcon(template.id)

    if (template.id === "scratch") {
      setConfig({
        name: storedTemplateConfig?.name || "",
        displayName: storedTemplateConfig?.displayName || "",
        description: storedTemplateConfig?.description || "",
        publisher: storedTemplateConfig?.publisher || stored.publisherName || "",
        version: storedTemplateConfig?.version || "0.0.1",
        category: storedTemplateConfig?.category || "Other",
        activationEvents: storedTemplateConfig?.activationEvents || [],
        contributes: storedTemplateConfig?.contributes || {},
      })
      setGeneratedCode(() => {
        const base: Record<string, string> = {}
        if (storedTemplateIcon) {
          base["images/icon.png"] = storedTemplateIcon
        }
        return base
      })
      setLogoDataUrl(storedTemplateIcon || undefined)
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
      const newConfig: ExtensionConfig = {
        ...baseConfig,
        ...(storedTemplateConfig || {}),
      }
      setConfig(newConfig)
      setGeneratedCode((prev) => {
        const base = { ...template.boilerplate }
        if (storedTemplateIcon) {
          base["images/icon.png"] = storedTemplateIcon
          if (base["package.json"]) {
            try {
              const pkg = JSON.parse(base["package.json"])
              pkg.icon = "images/icon.png"
              base["package.json"] = JSON.stringify(pkg, null, 2)
            } catch {}
          }
        }
        return base
      })
      setLogoDataUrl(storedTemplateIcon || undefined)
      setActiveTab("config")

      generateLogo(template, template.suggestedConfig.name)
    }
  }

  const handleConfigChange = (newConfig: ExtensionConfig) => {
    setConfig(newConfig)
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

    if (selectedTemplate) {
      if (files["images/icon.png"]) {
        saveTemplateIcon(selectedTemplate.id, files["images/icon.png"])
      } else {
        saveTemplateIcon(selectedTemplate.id, null)
      }
    }

    // If package.json was edited, sync config
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
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [selectedTemplate])

  const handleStreamingUpdate = useCallback((file: string | null, content: string) => {
    setStreamingFile(file)
    setStreamingContent(content)
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
    if (selectedTemplate) {
      saveTemplateIcon(selectedTemplate.id, dataUrl)
    }
  }, [selectedTemplate])

  useEffect(() => {
    if (Object.keys(generatedCode).length === 0) return

    // Update package.json when config changes
    setGeneratedCode((prev) => {
      const currentPkg = prev["package.json"]
      if (!currentPkg) return prev

      try {
        const pkg = JSON.parse(currentPkg)
        let changed = false

        if (config.name && pkg.name !== config.name) {
          pkg.name = config.name
          changed = true
        }
        if (config.displayName && pkg.displayName !== config.displayName) {
          pkg.displayName = config.displayName
          changed = true
        }
        if (config.description && pkg.description !== config.description) {
          pkg.description = config.description
          changed = true
        }
        if (config.publisher && pkg.publisher !== config.publisher) {
          pkg.publisher = config.publisher
          changed = true
        }
        if (config.version && pkg.version !== config.version) {
          pkg.version = config.version
          changed = true
        }
        if (config.category && pkg.categories?.[0] !== config.category) {
          pkg.categories = [config.category]
          changed = true
        }

        if (changed) {
          return { ...prev, "package.json": JSON.stringify(pkg, null, 2) }
        }
        return prev
      } catch {
        return prev
      }
    })
  }, [config.name, config.displayName, config.description, config.publisher, config.version, config.category])

  useEffect(() => {
    if (!selectedTemplate) return
    saveTemplateConfig(selectedTemplate.id, config)
  }, [selectedTemplate, config])

  return (
    <div className="min-h-screen bg-background">
      <Header />
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
            />
          </div>
        </div>
      </main>
    </div>
  )
}
