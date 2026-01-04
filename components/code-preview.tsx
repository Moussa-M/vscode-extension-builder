"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  Copy,
  Download,
  Check,
  File,
  Folder,
  ChevronRight,
  Sparkles,
  Rocket,
  Pencil,
  FileJson,
  FileCode,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ExtensionConfig, Template } from "@/lib/types"
import {
  generatePackageJson,
  generateExtensionTs,
  generateTsConfig,
  generateVsCodeLaunch,
  generateReadme,
  generateChangeLog,
  generateGitIgnore,
  generateVsCodeIgnore,
  generateLicense,
} from "@/lib/generators"
import { motion, AnimatePresence } from "framer-motion"
import { PublishModal } from "./publish-modal"

interface CodePreviewProps {
  code: Record<string, string>
  config: ExtensionConfig
  selectedTemplate: Template | null
  onCodeChange?: (files: Record<string, string>) => void
  streamingFile?: string | null
  streamingContent?: string
  logoDataUrl?: string // Added logoDataUrl prop
}

function highlightCode(code: string, language: string): React.ReactNode[] {
  const lines = code.split("\n")

  const patterns: Record<string, { regex: RegExp; className: string }[]> = {
    ts: [
      { regex: /(\/\/.*$)/gm, className: "text-emerald-600" }, // comments
      { regex: /(\/\*[\s\S]*?\*\/)/g, className: "text-emerald-600" }, // block comments
      {
        regex:
          /\b(import|export|from|const|let|var|function|async|await|return|if|else|for|while|class|extends|implements|interface|type|enum|new|this|try|catch|throw|finally|switch|case|break|default|continue|typeof|instanceof)\b/g,
        className: "text-violet-400",
      }, // keywords
      { regex: /\b(true|false|null|undefined|void)\b/g, className: "text-orange-400" }, // literals
      { regex: /("[^"]*"|'[^']*'|`[^`]*`)/g, className: "text-amber-300" }, // strings
      { regex: /\b(\d+\.?\d*)\b/g, className: "text-cyan-400" }, // numbers
      {
        regex: /\b(string|number|boolean|any|never|unknown|object|Array|Promise|Record|Partial|Required|Pick|Omit)\b/g,
        className: "text-cyan-300",
      }, // types
      { regex: /(@\w+)/g, className: "text-fuchsia-400" }, // decorators
      {
        regex:
          /\b(vscode|window|commands|workspace|context|ExtensionContext|Disposable|TextDocument|Position|Range|Uri)\b/g,
        className: "text-blue-300",
      }, // vscode API
    ],
    json: [
      { regex: /("(?:[^"\\]|\\.)*")\s*:/g, className: "text-violet-400" }, // keys
      { regex: /:\s*("(?:[^"\\]|\\.)*")/g, className: "text-amber-300" }, // string values
      { regex: /:\s*(\d+\.?\d*)/g, className: "text-cyan-400" }, // numbers
      { regex: /:\s*(true|false|null)/g, className: "text-orange-400" }, // literals
    ],
    md: [
      { regex: /^(#{1,6}\s.*)$/gm, className: "text-violet-400 font-semibold" }, // headings
      { regex: /(\*\*[^*]+\*\*)/g, className: "text-foreground font-bold" }, // bold
      { regex: /(\*[^*]+\*)/g, className: "text-foreground italic" }, // italic
      { regex: /(`[^`]+`)/g, className: "text-amber-300 bg-muted/50 px-1 rounded" }, // inline code
      { regex: /(```[\s\S]*?```)/g, className: "text-emerald-400" }, // code blocks
      { regex: /^(\s*[-*+]\s)/gm, className: "text-cyan-400" }, // list items
      { regex: /(\[.*?\]$$.*?$$)/g, className: "text-blue-400 underline" }, // links
    ],
  }

  const getPatterns = (lang: string) => {
    if (lang === "ts" || lang === "js") return patterns.ts
    if (lang === "json") return patterns.json
    if (lang === "md") return patterns.md
    return patterns.ts // default
  }

  const highlightLine = (line: string, lang: string): React.ReactNode => {
    const langPatterns = getPatterns(lang)
    const segments: { text: string; className?: string; start: number; end: number }[] = []

    // Find all matches
    langPatterns.forEach(({ regex, className }) => {
      const re = new RegExp(regex.source, regex.flags)
      let match
      while ((match = re.exec(line)) !== null) {
        const capturedGroup = match[1] || match[0]
        const start = match.index + match[0].indexOf(capturedGroup)
        segments.push({
          text: capturedGroup,
          className,
          start,
          end: start + capturedGroup.length,
        })
      }
    })

    // Sort by position and remove overlaps
    segments.sort((a, b) => a.start - b.start)
    const filtered: typeof segments = []
    let lastEnd = 0
    for (const seg of segments) {
      if (seg.start >= lastEnd) {
        filtered.push(seg)
        lastEnd = seg.end
      }
    }

    // Build result
    if (filtered.length === 0) {
      return <span className="text-foreground/80">{line}</span>
    }

    const result: React.ReactNode[] = []
    let pos = 0
    filtered.forEach((seg, i) => {
      if (pos < seg.start) {
        result.push(
          <span key={`plain-${i}`} className="text-foreground/80">
            {line.slice(pos, seg.start)}
          </span>,
        )
      }
      result.push(
        <span key={`hl-${i}`} className={seg.className}>
          {seg.text}
        </span>,
      )
      pos = seg.end
    })
    if (pos < line.length) {
      result.push(
        <span key="end" className="text-foreground/80">
          {line.slice(pos)}
        </span>,
      )
    }
    return <>{result}</>
  }

  return lines.map((line, i) => (
    <div key={i} className="flex">
      <span className="w-10 pr-4 text-right text-muted-foreground/50 select-none shrink-0">{i + 1}</span>
      <span className="flex-1">{highlightLine(line, language)}</span>
    </div>
  ))
}

export function CodePreview({
  code,
  config,
  selectedTemplate,
  onCodeChange,
  streamingFile,
  streamingContent,
  logoDataUrl, // Added logoDataUrl
}: CodePreviewProps) {
  const [activeFile, setActiveFile] = useState("package.json")
  const [copied, setCopied] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src", "root", ".vscode"]))
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState<string>("")

  const codeContainerRef = useRef<HTMLDivElement>(null)

  const files = useMemo(() => {
    const isScratch = selectedTemplate?.id === "scratch"
    const hasCode = Object.keys(code).length > 0

    if (isScratch && !hasCode) {
      return {}
    }

    // Only generate base files if not already in code
    const baseFiles: Record<string, string> = {}

    if (!code["package.json"]) {
      baseFiles["package.json"] = generatePackageJson(config, selectedTemplate)
    }
    if (!code["tsconfig.json"]) {
      baseFiles["tsconfig.json"] = generateTsConfig()
    }
    if (!code[".vscode/launch.json"]) {
      baseFiles[".vscode/launch.json"] = generateVsCodeLaunch()
    }
    if (!code["README.md"]) {
      baseFiles["README.md"] = generateReadme(config)
    }
    if (!code["CHANGELOG.md"]) {
      baseFiles["CHANGELOG.md"] = generateChangeLog(config)
    }
    if (!code["LICENSE"]) {
      baseFiles["LICENSE"] = generateLicense(config)
    }
    if (!code[".gitignore"]) {
      baseFiles[".gitignore"] = generateGitIgnore()
    }
    if (!code[".vscodeignore"]) {
      baseFiles[".vscodeignore"] = generateVsCodeIgnore()
    }
    if (!code["src/extension.ts"] && !selectedTemplate?.boilerplate["src/extension.ts"]) {
      baseFiles["src/extension.ts"] = generateExtensionTs(config, selectedTemplate)
    }

    return {
      ...baseFiles,
      ...code,
    }
  }, [code, config, selectedTemplate])

  const handleStartEditing = useCallback(() => {
    setEditedContent(files[activeFile] || "")
    setIsEditing(true)
  }, [files, activeFile])

  const handleSaveEdit = useCallback(() => {
    if (onCodeChange && editedContent !== files[activeFile]) {
      // Merge with ALL current files, not just the code prop
      const updatedFiles = { ...files, [activeFile]: editedContent }
      onCodeChange(updatedFiles)
    }
    setIsEditing(false)
  }, [onCodeChange, files, activeFile, editedContent])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditedContent("")
  }, [])

  const handleCopy = async () => {
    const contentToCopy = isEditing ? editedContent : files[activeFile] || ""
    await navigator.clipboard.writeText(contentToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadZip = async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()

    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith(".png") && content.startsWith("data:image/png;base64,")) {
        const base64Data = content.replace("data:image/png;base64,", "")
        zip.file(path, base64Data, { base64: true })
      } else {
        zip.file(path, content)
      }
    }

    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${config.name || "my-extension"}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getFileExtension = (filename: string) => {
    const ext = filename.split(".").pop() || ""
    return ext.toLowerCase()
  }

  const toggleFolder = (folder: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folder)) {
      newExpanded.delete(folder)
    } else {
      newExpanded.add(folder)
    }
    setExpandedFolders(newExpanded)
  }

  const fileTree = useMemo(() => {
    const tree: Record<string, string[]> = { root: [] }
    const allFiles = { ...files }
    if (streamingFile && !allFiles[streamingFile]) {
      allFiles[streamingFile] = streamingContent || ""
    }
    Object.keys(allFiles).forEach((file) => {
      const parts = file.split("/")
      if (parts.length === 1) {
        tree.root.push(file)
      } else {
        const dir = parts.slice(0, -1).join("/")
        if (!tree[dir]) tree[dir] = []
        tree[dir].push(file)
      }
    })
    return tree
  }, [files, streamingFile, streamingContent])

  const isEmpty = Object.keys(files).length === 0 && !streamingFile

  const displayContent = useMemo(() => {
    if (isEditing) return editedContent
    if (streamingFile === activeFile && streamingContent !== undefined) {
      return streamingContent
    }
    return files[activeFile] || ""
  }, [isEditing, editedContent, streamingFile, activeFile, streamingContent, files])

  const highlightedCode = useMemo(() => {
    if (!displayContent) return null
    const ext = getFileExtension(activeFile)
    return highlightCode(displayContent, ext)
  }, [displayContent, activeFile])

  const isStreaming = streamingFile === activeFile

  useEffect(() => {
    if (isStreaming && codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight
    }
  }, [isStreaming, streamingContent])

  useEffect(() => {
    if (streamingFile && streamingFile !== activeFile) {
      if (isEditing) handleCancelEdit()
      setActiveFile(streamingFile)
    }
  }, [streamingFile])

  const fileIcons: Record<string, React.ReactNode> = {
    json: <FileJson className="w-4 h-4 text-yellow-500" />,
    ts: <FileCode className="w-4 h-4 text-blue-500" />,
    js: <FileCode className="w-4 h-4 text-yellow-400" />,
    md: <FileText className="w-4 h-4 text-gray-400" />,
    txt: <FileText className="w-4 h-4 text-gray-400" />,
    license: <FileText className="w-4 h-4 text-emerald-400" />,
    gitignore: <File className="w-4 h-4 text-amber-400" />,
    vscodeignore: <File className="w-4 h-4 text-amber-400" />,
    env: <File className="w-4 h-4 text-amber-400" />,
    css: <File className="w-4 h-4 text-pink-400" />,
    png: <File className="w-4 h-4 text-green-400" />,
  }

  const activeFileIcon = fileIcons[getFileExtension(activeFile)] || <File className="w-4 h-4 text-muted-foreground" />

  return (
    <Card className="h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
      <CardHeader className="pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Generated Extension
            {!isEmpty && (
              <span className="text-xs font-normal text-muted-foreground">{Object.keys(files).length} files</span>
            )}
          </CardTitle>
          {!isEmpty && (
            <div className="flex gap-2">
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={handleStartEditing} title="Edit current file">
                  <Pencil className="w-4 h-4" />
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} title="Cancel editing">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    className="bg-green-600 hover:bg-green-700"
                    title="Save changes"
                  >
                    Save
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleCopy} title="Copy current file">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadZip} title="Export all as ZIP">
                <Download className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => setPublishModalOpen(true)}
                className="bg-violet-600 hover:bg-violet-700"
                title="Publish extension"
              >
                <Rocket className="w-4 h-4 mr-1.5" />
                Publish
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {isEmpty ? (
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="font-medium text-foreground mb-2">Ready to Create</h3>
            <p className="text-sm text-muted-foreground">
              Describe your extension in the AI Generator tab and watch as files are generated in real-time.
            </p>
          </div>
        </CardContent>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree Sidebar */}
          <div className="w-48 border-r border-border bg-muted/30 shrink-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-0.5">
                {Object.entries(fileTree).map(([dir, dirFiles]) => (
                  <div key={dir}>
                    {dir !== "root" && (
                      <button
                        onClick={() => toggleFolder(dir)}
                        className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                      >
                        <ChevronRight
                          className={`w-3 h-3 transition-transform ${expandedFolders.has(dir) ? "rotate-90" : ""}`}
                        />
                        <Folder className="w-3.5 h-3.5 text-blue-400" />
                        <span className="truncate">{dir}</span>
                      </button>
                    )}
                    <AnimatePresence>
                      {(dir === "root" || expandedFolders.has(dir)) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className={dir !== "root" ? "ml-4" : ""}
                        >
                          {dirFiles.map((filename) => {
                            const isCurrentlyStreaming = streamingFile === filename
                            return (
                              <button
                                key={filename}
                                onClick={() => {
                                  if (isEditing) handleCancelEdit()
                                  setActiveFile(filename)
                                }}
                                className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded transition-colors ${
                                  activeFile === filename
                                    ? "bg-primary text-primary-foreground"
                                    : isCurrentlyStreaming
                                      ? "bg-yellow-500/20 text-yellow-300 animate-pulse"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              >
                                {fileIcons[getFileExtension(filename)] || <File className="w-3.5 h-3.5" />}
                                <span className="truncate">{filename.split("/").pop()}</span>
                                {isCurrentlyStreaming && (
                                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                                )}
                              </button>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Code Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
            <div className="px-4 py-2 border-b border-border/50 bg-[#161b22] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                  {activeFileIcon}
                  {activeFile}
                </span>
                {isEditing && (
                  <span className="text-xs text-yellow-500 flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Editing
                  </span>
                )}
                {isStreaming && (
                  <span className="text-xs text-yellow-400 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Streaming...
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{displayContent.split("\n").length} lines</span>
            </div>

            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="flex-1 w-full p-4 text-[13px] font-mono leading-6 bg-[#0d1117] text-foreground/80 resize-none focus:outline-none overflow-auto"
                spellCheck={false}
              />
            ) : (
                        <div className="flex-1 overflow-auto" ref={codeContainerRef}>
                <pre className="p-4 text-[13px] font-mono leading-6 min-w-max">
                  <code>
                    {highlightedCode}
                    {isStreaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
                  </code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      <PublishModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        config={config}
        files={files}
        logoDataUrl={logoDataUrl}
      />
    </Card>
  )
}
