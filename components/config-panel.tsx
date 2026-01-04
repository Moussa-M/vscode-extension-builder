"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogoGenerator } from "./logo-generator"
import type { ExtensionConfig, Template } from "@/lib/types"
import { AlertCircle } from "lucide-react"

interface ConfigPanelProps {
  config: ExtensionConfig
  onChange: (config: ExtensionConfig) => void
  selectedTemplate: Template | null
  onLogoGenerated?: (dataUrl: string) => void
}

const categories = [
  "Programming Languages",
  "Snippets",
  "Linters",
  "Themes",
  "Debuggers",
  "Formatters",
  "Keymaps",
  "SCM Providers",
  "Other",
  "Extension Packs",
  "Language Packs",
  "Data Science",
  "Machine Learning",
  "Visualization",
  "Notebooks",
  "Education",
  "Testing",
]

export function ConfigPanel({ config, onChange, selectedTemplate, onLogoGenerated }: ConfigPanelProps) {
  if (!selectedTemplate) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a template first to configure your extension</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Extension Details</CardTitle>
          <CardDescription>Basic information about your extension</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (identifier)</Label>
              <Input
                id="name"
                placeholder="my-extension"
                value={config.name}
                onChange={(e) => onChange({ ...config, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="My Extension"
                value={config.displayName}
                onChange={(e) => onChange({ ...config, displayName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A brief description of your extension..."
              value={config.description}
              onChange={(e) => onChange({ ...config, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                placeholder="your-publisher-id"
                value={config.publisher}
                onChange={(e) => onChange({ ...config, publisher: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                placeholder="0.0.1"
                value={config.version}
                onChange={(e) => onChange({ ...config, version: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={config.category} onValueChange={(value) => onChange({ ...config, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <LogoGenerator
        extensionName={config.name}
        suggestedLogo={selectedTemplate.suggestedLogo}
        onLogoGenerated={onLogoGenerated}
      />
    </div>
  )
}
