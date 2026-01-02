"use client"

import { useState, useRef, useEffect } from "react"
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
}

interface GenerationResult {
  message: string
  files: Record<string, string>
  commands?: string[]
  activationEvents?: string[]
}

interface Message {
  role: "user" | "assistant"
  content: string
  files?: Record<string, string>
  isGenerating?: boolean
}

function FileGenerationAnimation({
  files,
  isComplete,
  onFileClick,
}: {
  files: string[]
  isComplete: boolean
  onFileClick?: (file: string) => void
}) {
  const [visibleFiles, setVisibleFiles] = useState<string[]>([])
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set())
  const animatedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (files.length === 0) return

    // Only animate new files that haven't been animated yet
    files.forEach((file, index) => {
      if (animatedRef.current.has(file)) return
      animatedRef.current.add(file)

      setTimeout(() => {
        setVisibleFiles((prev) => {
          if (prev.includes(file)) return prev
          return [...prev, file]
        })

        setTimeout(() => {
          setCompletedFiles((prev) => new Set([...prev, file]))
        }, 400)
      }, index * 120)
    })
  }, [files])

  // Reset when files array changes completely (new generation)
  useEffect(() => {
    if (files.length === 0) {
      setVisibleFiles([])
      setCompletedFiles(new Set())
      animatedRef.current = new Set()
    }
  }, [files.length === 0])

  const getFileIcon = (filename: string) => {
    if (filename.endsWith(".json")) return "{ }"
    if (filename.endsWith(".ts") || filename.endsWith(".tsx")) return "TS"
    if (filename.endsWith(".md")) return "MD"
    if (filename.startsWith(".")) return "•"
    return "📄"
  }

  const getFileColor = (filename: string) => {
    if (filename.endsWith(".json")) return "text-yellow-500"
    if (filename.endsWith(".ts") || filename.endsWith(".tsx")) return "text-blue-500"
    if (filename.endsWith(".md")) return "text-emerald-500"
    if (filename.includes("extension")) return "text-purple-500"
    return "text-muted-foreground"
  }

  return (
    <div className="space-y-1.5">
      {visibleFiles.map((file) => {
        const isCompleted = completedFiles.has(file) || isComplete
        return (
          <div
            key={file}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-secondary/50",
              "transform transition-all duration-300 ease-out",
              isCompleted ? "bg-secondary/30 opacity-100 translate-x-0" : "bg-secondary/10 opacity-90",
            )}
            onClick={() => onFileClick?.(file)}
          >
            <div
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all duration-300",
                isCompleted ? "bg-primary/20" : "bg-muted",
                getFileColor(file),
              )}
            >
              {isCompleted ? <Check className="w-3 h-3 text-green-500" /> : <span>{getFileIcon(file)}</span>}
            </div>
            <span
              className={cn(
                "text-sm font-mono flex-1 transition-colors duration-300",
                isCompleted ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {file}
            </span>
            {isCompleted && (
              <Badge variant="outline" className="text-[10px] h-5">
                Ready
              </Badge>
            )}
            {!isCompleted && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
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

export function AiAssistant({ config, selectedTemplate, generatedCode, onGenerate, onConfigUpdate }: AiAssistantProps) {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [mode, setMode] = useState<"add-feature" | "generate-scratch">("add-feature")
  const [generatingFiles, setGeneratingFiles] = useState<string[]>([])
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
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7)
      if (cleaned.startsWith("```")) cleaned = cleaned.slice(3)
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
      cleaned = cleaned.trim()

      const parsed = JSON.parse(cleaned)
      return {
        message: parsed.message || "Code generated successfully",
        files: parsed.files || {},
        commands: parsed.commands || [],
        activationEvents: parsed.activationEvents || [],
      }
    } catch {
      return null
    }
  }

  const simulateProgress = () => {
    const stages = [
      { stage: "Analyzing requirements...", duration: 800 },
      { stage: "Designing architecture...", duration: 1200 },
      { stage: "Generating code...", duration: 2000 },
      { stage: "Creating files...", duration: 1500 },
      { stage: "Finalizing extension...", duration: 1000 },
    ]

    stages.forEach((s, index) => {
      setTimeout(
        () => {
          setGenerationStage(s.stage)
          setGenerationProgress(Math.min((index + 1) * 20, 95))
        },
        stages.slice(0, index).reduce((acc, st) => acc + st.duration, 0),
      )
    })
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setGeneratingFiles([])
    setGenerationStage("Starting generation...")
    setGenerationProgress(5)

    const userMessage: Message = { role: "user", content: prompt }
    const assistantMessage: Message = { role: "assistant", content: "", isGenerating: true }
    setMessages((prev) => [...prev, userMessage, assistantMessage])

    simulateProgress()
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
      const foundFiles = new Set<string>()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk

          // Extract file names as they appear
          const fileMatches = fullText.match(/"([^"]+\.(ts|tsx|json|md|gitignore|vscodeignore))":/g)
          if (fileMatches) {
            const files = fileMatches.map((m) => m.replace(/["':]/g, ""))
            files.forEach((f) => {
              if (!foundFiles.has(f)) {
                foundFiles.add(f)
                setGeneratingFiles((prev) => [...prev, f])
              }
            })
          }
        }
      }

      setGenerationProgress(100)
      setGenerationStage("Complete!")

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

        onGenerate(result.files)

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
      setGeneratingFiles([])
      setGenerationStage("")
      setGenerationProgress(0)
      setPrompt("")
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort()
    setIsGenerating(false)
    setGeneratingFiles([])
    setGenerationStage("")
    setGenerationProgress(0)
    setMessages((prev) => prev.slice(0, -1))
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
                        {generatingFiles.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <FileCode className="w-3 h-3" />
                              Generating files...
                            </p>
                            <FileGenerationAnimation files={generatingFiles} isComplete={false} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-foreground">{msg.content}</p>
                        {msg.files && Object.keys(msg.files).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <FileCode className="w-3 h-3" />
                              {Object.keys(msg.files).length} files generated
                            </p>
                            <FileGenerationAnimation files={Object.keys(msg.files)} isComplete={true} />
                          </div>
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

        {/* Input Area - stays at bottom */}
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
                Cancel Generation
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="flex-1 gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                {mode === "generate-scratch" ? (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Extension
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Add Feature
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
