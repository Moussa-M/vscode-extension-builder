"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Sparkles,
  Send,
  Wand2,
  Plus,
  RefreshCw,
  Zap,
  FileCode,
  Check,
  Loader2,
  Terminal,
  Cpu,
  Code2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ExtensionConfig, Template } from "@/lib/types"

interface AiAssistantProps {
  config: ExtensionConfig
  selectedTemplate: Template | null
  generatedCode: Record<string, string>
  onGenerate: (code: Record<string, string>, config?: Partial<ExtensionConfig>) => void
  onConfigUpdate: (config: ExtensionConfig) => void
  onStreamingUpdate?: (file: string | null, content: string) => void
}

interface GenerationResult {
  message: string
  files: Record<string, string>
  commands?: string[]
  activationEvents?: string[]
  extractedConfig?: Partial<ExtensionConfig>
}

interface Message {
  role: "user" | "assistant"
  content: string
  files?: Record<string, string>
  isGenerating?: boolean
}

function StreamingFileDisplay({
  currentFile,
  content,
  allFiles,
  onFileClick,
}: {
  currentFile: string | null
  content: string
  allFiles: string[]
  onFileClick?: (file: string) => void
}) {
  return (
    <div className="space-y-2">
      {allFiles.map((file) => {
        const isActive = file === currentFile
        const isComplete = !isActive && allFiles.indexOf(file) < allFiles.indexOf(currentFile || "")
        return (
          <div
            key={file}
            onClick={() => onFileClick?.(file)}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-200",
              isActive ? "bg-yellow-500/20 border border-yellow-500/30" : "bg-secondary/30 hover:bg-secondary/50",
            )}
          >
            <div
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
                isActive
                  ? "bg-yellow-500/30 text-yellow-400"
                  : isComplete
                    ? "bg-green-500/20 text-green-400"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {isComplete ? (
                <Check className="w-3 h-3" />
              ) : isActive ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "?"
              )}
            </div>
            <span
              className={cn(
                "text-sm font-mono flex-1",
                isActive ? "text-yellow-300" : isComplete ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {file}
            </span>
            {isActive && <span className="text-[10px] text-yellow-400">{content.length} chars</span>}
            {isComplete && (
              <Badge variant="outline" className="text-[10px] h-5 text-green-400 border-green-500/30">
                Done
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}

function GenerationProgress({ stage, progress }: { stage: string; progress: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div
            className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
            style={{ animationDuration: "1.5s" }}
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{stage}</p>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const featureSuggestions = [
  "Add a status bar item showing current line count",
  "Create a command to format selected JSON",
  "Add a tree view sidebar for bookmarks",
  "Create code snippets for React hooks",
  "Add a command palette quick pick menu",
  "Create a webview settings panel",
]

const scratchSuggestions = [
  "Create a Pomodoro timer extension with status bar and notifications",
  "Build a Git commit message generator using AI",
  "Create a code complexity analyzer extension",
  "Build a TODO comment highlighter and manager",
  "Create a markdown file extractor that parses code blocks",
  "Build a workspace switcher with recent projects",
]

export function AiAssistant({
  config,
  selectedTemplate,
  generatedCode,
  onGenerate,
  onConfigUpdate,
  onStreamingUpdate,
}: AiAssistantProps) {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [mode, setMode] = useState<"add-feature" | "generate-scratch">("add-feature")
  const [streamingFiles, setStreamingFiles] = useState<string[]>([])
  const [currentStreamingFile, setCurrentStreamingFile] = useState<string | null>(null)
  const [currentStreamingContent, setCurrentStreamingContent] = useState("")
  const [generationStage, setGenerationStage] = useState("")
  const [generationProgress, setGenerationProgress] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const parseAIResponse = (text: string): GenerationResult | null => {
    try {
      let cleaned = text.trim()

      // Remove markdown code blocks if present
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7)
      else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3)
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
      cleaned = cleaned.trim()

      // Try to find JSON object boundaries
      const firstBrace = cleaned.indexOf("{")
      const lastBrace = cleaned.lastIndexOf("}")

      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        console.log(" No valid JSON boundaries found")
        return null
      }

      // Extract just the JSON part
      cleaned = cleaned.slice(firstBrace, lastBrace + 1)

      // Try parsing directly first
      try {
        const parsed = JSON.parse(cleaned)
        return processParseResult(parsed)
      } catch (directError) {
        console.log(" Direct parse failed, trying repairs...")
      }

      // Try to repair common JSON issues
      // The AI often produces unescaped characters in string values
      let repaired = cleaned

      // Fix: Replace actual newlines/tabs inside strings with escaped versions
      // This is tricky because we need to identify when we're inside a string
      repaired = repairJsonStrings(repaired)

      try {
        const parsed = JSON.parse(repaired)
        return processParseResult(parsed)
      } catch (repairedError) {
        console.log(" Repaired parse failed:", (repairedError as Error).message?.slice(0, 100))
      }

      // Final fallback: extract files using a state machine parser
      return extractFilesWithStateMachine(text)
    } catch (e) {
      console.log(" JSON parse error:", (e as Error).message?.slice(0, 100))
      return extractFilesWithStateMachine(text)
    }
  }

  const repairJsonStrings = (json: string): string => {
    let result = ""
    let inString = false
    let escapeNext = false

    for (let i = 0; i < json.length; i++) {
      const char = json[i]

      if (escapeNext) {
        result += char
        escapeNext = false
        continue
      }

      if (char === "\\") {
        escapeNext = true
        result += char
        continue
      }

      if (char === '"') {
        inString = !inString
        result += char
        continue
      }

      if (inString) {
        // Escape problematic characters inside strings
        if (char === "\n") {
          result += "\\n"
        } else if (char === "\r") {
          result += "\\r"
        } else if (char === "\t") {
          result += "\\t"
        } else {
          result += char
        }
      } else {
        result += char
      }
    }

    return result
  }

  const processParseResult = (parsed: Record<string, unknown>): GenerationResult | null => {
    if (!parsed.files || typeof parsed.files !== "object") {
      console.log(" Parsed JSON missing files object")
      return null
    }

    let extractedConfig: Partial<ExtensionConfig> | undefined
    const files = parsed.files as Record<string, string>

    if (files["package.json"]) {
      try {
        const pkgJson = JSON.parse(files["package.json"])
        extractedConfig = {
          name: pkgJson.name,
          displayName: pkgJson.displayName,
          description: pkgJson.description,
          publisher: pkgJson.publisher,
          version: pkgJson.version,
          category: pkgJson.categories?.[0] || "Other",
          activationEvents: pkgJson.activationEvents || [],
          contributes: pkgJson.contributes || {},
        }
      } catch {
        console.log(" Failed to parse package.json for config extraction")
      }
    }

    return {
      message: (parsed.message as string) || "Code generated successfully",
      files,
      commands: (parsed.commands as string[]) || [],
      activationEvents: (parsed.activationEvents as string[]) || [],
      extractedConfig,
    }
  }

  const extractFilesWithStateMachine = (text: string): GenerationResult | null => {
    const files: Record<string, string> = {}

    // Find "files": { in the text
    const filesStart = text.indexOf('"files"')
    if (filesStart === -1) {
      console.log(" No files key found in response")
      return null
    }

    // Find the opening brace after "files":
    const braceStart = text.indexOf("{", filesStart)
    if (braceStart === -1) return null

    let pos = braceStart + 1
    let depth = 1
    let currentKey = ""
    let currentValue = ""
    let inKey = false
    let inValue = false
    let escapeNext = false

    while (pos < text.length && depth > 0) {
      const char = text[pos]

      if (escapeNext) {
        if (inValue) currentValue += char
        escapeNext = false
        pos++
        continue
      }

      if (char === "\\") {
        escapeNext = true
        if (inValue) currentValue += char
        pos++
        continue
      }

      if (char === '"') {
        if (!inKey && !inValue) {
          // Starting a key or value
          const colonPos = text.indexOf(":", pos)
          const commaPos = text.indexOf(",", pos)
          const bracePos = text.indexOf("}", pos)

          // If colon comes before comma/brace, this is a key
          if (colonPos !== -1 && (commaPos === -1 || colonPos < commaPos) && (bracePos === -1 || colonPos < bracePos)) {
            inKey = true
            currentKey = ""
          } else {
            inValue = true
            currentValue = ""
          }
        } else if (inKey) {
          inKey = false
        } else if (inValue) {
          inValue = false
          // Save the file
          if (currentKey && currentValue !== undefined) {
            // Unescape the content
            const unescaped = currentValue
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t")
              .replace(/\\r/g, "\r")
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, "\\")
            files[currentKey] = unescaped
          }
          currentKey = ""
          currentValue = ""
        }
      } else if (inKey) {
        currentKey += char
      } else if (inValue) {
        currentValue += char
      } else if (char === "{") {
        depth++
      } else if (char === "}") {
        depth--
      }

      pos++
    }

    if (Object.keys(files).length === 0) {
      console.log(" State machine extraction found no files")
      return null
    }

    console.log(" State machine extracted", Object.keys(files).length, "files")

    // Try to extract message
    const messageMatch = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    const message = messageMatch
      ? messageMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ")
      : "Code generated successfully"

    // Extract config from package.json if available
    let extractedConfig: Partial<ExtensionConfig> | undefined
    if (files["package.json"]) {
      try {
        const pkgJson = JSON.parse(files["package.json"])
        extractedConfig = {
          name: pkgJson.name,
          displayName: pkgJson.displayName,
          description: pkgJson.description,
          publisher: pkgJson.publisher,
          version: pkgJson.version,
          category: pkgJson.categories?.[0] || "Other",
          activationEvents: pkgJson.activationEvents || [],
          contributes: pkgJson.contributes || {},
        }
      } catch {
        // Ignore parse errors
      }
    }

    return {
      message,
      files,
      commands: [],
      activationEvents: [],
      extractedConfig,
    }
  }

  const extractPartialFiles = useCallback(
    (text: string): { files: string[]; currentFile: string | null; currentContent: string } => {
      const files: string[] = []
      let currentFile: string | null = null
      let currentContent = ""

      // Match complete file entries
      const completeFileRegex = /"([^"]+\.(ts|tsx|json|md|gitignore|vscodeignore|Makefile))":\s*"((?:[^"\\]|\\.)*)"/g
      let match
      while ((match = completeFileRegex.exec(text)) !== null) {
        if (!files.includes(match[1])) {
          files.push(match[1])
        }
      }

      // Find the currently streaming file (incomplete)
      const incompleteFileRegex = /"([^"]+\.(ts|tsx|json|md|gitignore|vscodeignore|Makefile))":\s*"((?:[^"\\]|\\.)*)$/
      const incompleteMatch = text.match(incompleteFileRegex)
      if (incompleteMatch) {
        currentFile = incompleteMatch[1]
        // Unescape the content
        currentContent = incompleteMatch[3]
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
        if (!files.includes(currentFile)) {
          files.push(currentFile)
        }
      }

      return { files, currentFile, currentContent }
    },
    [],
  )

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setStreamingFiles([])
    setCurrentStreamingFile(null)
    setCurrentStreamingContent("")
    setGenerationStage("Starting generation...")
    setGenerationProgress(5)

    const userMessage: Message = { role: "user", content: prompt }
    const assistantMessage: Message = { role: "assistant", content: "", isGenerating: true }
    setMessages((prev) => [...prev, userMessage, assistantMessage])

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          config,
          template: selectedTemplate,
          mode,
          existingFiles: mode === "add-feature" ? generatedCode : undefined,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error("Failed to generate")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      if (reader) {
        setGenerationStage("Generating code...")
        setGenerationProgress(20)

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk

          const { files, currentFile, currentContent } = extractPartialFiles(fullText)

          if (files.length > 0) {
            setStreamingFiles(files)
            setGenerationProgress(Math.min(20 + files.length * 10, 90))
          }

          if (currentFile) {
            setCurrentStreamingFile(currentFile)
            setCurrentStreamingContent(currentContent)
            setGenerationStage(`Writing ${currentFile}...`)
            onStreamingUpdate?.(currentFile, currentContent)
          }
        }
      }

      setGenerationProgress(100)
      setGenerationStage("Complete!")
      onStreamingUpdate?.(null, "")

      const result = parseAIResponse(fullText)

      if (result) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? {
                role: "assistant" as const,
                content: result.message,
                files: result.files,
                isGenerating: false,
              }
              : m,
          ),
        )

        onGenerate(result.files, result.extractedConfig)

        if (result.commands?.length || result.activationEvents?.length) {
          const existingCommands = (config.contributes?.commands as Array<{ command: string; title: string }>) || []
          const newCommands = result.commands?.map((cmd) => ({
            command: cmd.includes(".") ? cmd : `${config.name || "myext"}.${cmd}`,
            title:
              cmd
                .split(".")
                .pop()
                ?.replace(/([A-Z])/g, " $1")
                .trim() || cmd,
          }))

          onConfigUpdate({
            ...config,
            activationEvents: [...new Set([...(config.activationEvents || []), ...(result.activationEvents || [])])],
            contributes: {
              ...config.contributes,
              commands: [...existingCommands, ...(newCommands || [])],
            },
          })
        }
      } else {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? {
                role: "assistant" as const,
                content: "Generated code but couldn't parse the response. Please try again.",
                isGenerating: false,
              }
              : m,
          ),
        )
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? {
                role: "assistant" as const,
                content: "Sorry, there was an error generating the code. Please try again.",
                isGenerating: false,
              }
              : m,
          ),
        )
      }
    } finally {
      setIsGenerating(false)
      setStreamingFiles([])
      setCurrentStreamingFile(null)
      setCurrentStreamingContent("")
      setGenerationStage("")
      setGenerationProgress(0)
      setPrompt("")
      abortControllerRef.current = null
      onStreamingUpdate?.(null, "")
    }
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort()
    setIsGenerating(false)
    setStreamingFiles([])
    setCurrentStreamingFile(null)
    setCurrentStreamingContent("")
    setGenerationStage("")
    setGenerationProgress(0)
    setMessages((prev) => prev.slice(0, -1))
    onStreamingUpdate?.(null, "")
  }

  const suggestions = mode === "generate-scratch" ? scratchSuggestions : featureSuggestions

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-secondary/10 flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">AI Extension Generator</CardTitle>
            <CardDescription className="text-xs">Powered by Claude</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="flex-shrink-0">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="add-feature" className="gap-2 data-[state=active]:bg-primary/10">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Feature</span>
              <span className="sm:hidden">Feature</span>
            </TabsTrigger>
            <TabsTrigger value="generate-scratch" className="gap-2 data-[state=active]:bg-primary/10">
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline">From Scratch</span>
              <span className="sm:hidden">New</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add-feature" className="mt-4">
            <p className="text-sm text-muted-foreground">Add new features to your existing extension</p>
          </TabsContent>

          <TabsContent value="generate-scratch" className="mt-4">
            <p className="text-sm text-muted-foreground">
              Describe your extension idea and AI will generate everything
            </p>
          </TabsContent>
        </Tabs>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {suggestions.slice(0, 4).map((suggestion) => (
            <Badge
              key={suggestion}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-all text-xs py-1"
              onClick={() => setPrompt(suggestion)}
            >
              <Zap className="w-3 h-3 mr-1 text-primary" />
              {suggestion.length > 35 ? suggestion.substring(0, 35) + "..." : suggestion}
            </Badge>
          ))}
        </div>

        <div className="flex-1 min-h-0 rounded-lg border bg-sidebar/50 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-muted-foreground">
                  <Sparkles className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Start a conversation to generate your extension</p>
                  <p className="text-xs mt-1">Try one of the suggestions above</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={`${i}-${msg.role}`}
                    className={cn(
                      "rounded-lg p-3 transform transition-all duration-300 ease-out",
                      msg.role === "user" ? "bg-primary/10 border border-primary/20 ml-8" : "bg-secondary/50 mr-8",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {msg.role === "user" ? (
                        <Terminal className="w-4 h-4 text-primary" />
                      ) : (
                        <Code2 className="w-4 h-4 text-emerald-500" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-semibold uppercase tracking-wide",
                          msg.role === "user" ? "text-primary" : "text-emerald-500",
                        )}
                      >
                        {msg.role === "user" ? "You" : "AI"}
                      </span>
                    </div>

                    {msg.isGenerating ? (
                      <div className="space-y-4">
                        <GenerationProgress stage={generationStage} progress={generationProgress} />
                        {streamingFiles.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <FileCode className="w-3 h-3" />
                              Generating {streamingFiles.length} files...
                            </p>
                            <StreamingFileDisplay
                              currentFile={currentStreamingFile}
                              content={currentStreamingContent}
                              allFiles={streamingFiles}
                            />
                          </div>
                        )}
                      </div>
                    ) : msg.role === "user" ? (
                      <p className="text-sm text-foreground/70 truncate max-w-full">
                        {msg.content.length > 60 ? `${msg.content.slice(0, 60)}...` : msg.content}
                      </p>
                    ) : (
                      <>
                        {msg.files && Object.keys(msg.files).length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Generated {Object.keys(msg.files).length} files successfully
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.keys(msg.files).map((file) => (
                                <Badge key={file} variant="secondary" className="text-[10px]">
                                  {file}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground">{msg.content}</p>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-3 flex-shrink-0">
          <div className="relative">
            <Textarea
              placeholder={
                mode === "generate-scratch"
                  ? "Describe the extension you want to create in detail..."
                  : "Describe the feature you want to add..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none pr-12 bg-background/50 focus:bg-background transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) {
                  handleGenerate()
                }
              }}
              disabled={isGenerating}
            />
            <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">⌘ + Enter</div>
          </div>

          <div className="flex gap-2">
            {isGenerating ? (
              <Button onClick={handleCancel} variant="destructive" className="flex-1 gap-2">
                <RefreshCw className="w-4 h-4" />
                Cancel
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="flex-1 gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                <Send className="w-4 h-4" />
                Generate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
