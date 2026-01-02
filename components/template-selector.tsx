"use client"

import type React from "react"
import { useState } from "react"
import { Check, Command, Palette, FileCode, Layout, Database, Wand2, Sparkles, ChevronRight, File } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Template } from "@/lib/types"
import { scratchTemplate } from "@/lib/templates"
import { motion, AnimatePresence } from "framer-motion"

const iconMap: Record<string, React.ReactNode> = {
  command: <Command className="w-5 h-5" />,
  theme: <Palette className="w-5 h-5" />,
  snippet: <FileCode className="w-5 h-5" />,
  ai: <Wand2 className="w-5 h-5" />,
  webview: <Layout className="w-5 h-5" />,
  language: <Database className="w-5 h-5" />,
  scratch: <Sparkles className="w-5 h-5" />,
}

interface TemplateSelectorProps {
  templates: Template[]
  selectedTemplate: Template | null
  onSelect: (template: Template) => void
}

export function TemplateSelector({ templates, selectedTemplate, onSelect }: TemplateSelectorProps) {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)

  const allTemplates = [scratchTemplate, ...templates.filter((t) => t.id !== "scratch")]

  const toggleExpand = (templateId: string) => {
    setExpandedTemplate(expandedTemplate === templateId ? null : templateId)
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Choose a Template</h2>
        <p className="text-sm text-muted-foreground">Start with a boilerplate or let AI generate from scratch</p>
      </div>

      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="space-y-3 pr-4">
          {allTemplates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id
            const isExpanded = expandedTemplate === template.id
            const hasFiles = Object.keys(template.boilerplate).length > 0
            const isScratch = template.id === "scratch"

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
                  } ${isScratch ? "border-dashed" : ""}`}
                >
                  <CardHeader className="pb-2" onClick={() => onSelect(template)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-lg transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : isScratch
                                ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-400"
                                : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {iconMap[template.icon] || <Command className="w-5 h-5" />}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5 line-clamp-1">
                            {template.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                            Head to the <span className="font-medium text-foreground">AI Generator</span> tab and
                            describe your extension. The AI will create all files from scratch based on your
                            description.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
