"use client"

import { useState, useCallback, useEffect } from "react"
import { Header } from "./header"
import { TemplateSelector } from "./template-selector"
import { ConfigPanel } from "./config-panel"
import { CodePreview } from "./code-preview"
import { AiAssistant } from "./ai-assistant"
import type { ExtensionConfig, Template } from "@/lib/types"
import { templates } from "@/lib/templates"
import { getStoredCredentials } from "@/lib/storage"

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

  useEffect(() => {
    const stored = getStoredCredentials()
    if (stored.publisherName) {
      setConfig((prev) => ({
        ...prev,
        publisher: prev.publisher || stored.publisherName,
      }))
    }
  }, [])

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    const stored = getStoredCredentials()

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
      setActiveTab("ai")
    } else {
      setConfig((prev) => ({
        ...prev,
        ...template.defaultConfig,
        name: template.suggestedConfig.name,
        displayName: template.suggestedConfig.displayName,
        description: template.suggestedConfig.description,
        publisher: stored.publisherName || template.suggestedConfig.publisher,
        category: template.suggestedConfig.category,
      }))
      setGeneratedCode(template.boilerplate)
      setActiveTab("config")
    }
  }

  const handleConfigChange = (newConfig: ExtensionConfig) => {
    setConfig(newConfig)
  }

  const handleAiGenerate = useCallback((code: Record<string, string>) => {
    setGeneratedCode((prev) => ({ ...prev, ...code }))
  }, [])

  const handleConfigUpdate = useCallback((newConfig: ExtensionConfig) => {
    setConfig(newConfig)
  }, [])

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
              <ConfigPanel config={config} onChange={handleConfigChange} selectedTemplate={selectedTemplate} />
            )}
            {activeTab === "ai" && (
              <AiAssistant
                config={config}
                selectedTemplate={selectedTemplate}
                generatedCode={generatedCode}
                onGenerate={handleAiGenerate}
                onConfigUpdate={handleConfigUpdate}
              />
            )}
          </div>

          <div className="xl:sticky xl:top-4 h-fit min-w-0">
            <CodePreview code={generatedCode} config={config} selectedTemplate={selectedTemplate} />
          </div>
        </div>
      </main>
    </div>
  )
}
