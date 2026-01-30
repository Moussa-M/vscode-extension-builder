"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Sparkles,
  Send,
  RefreshCw,
  FileCode,
  Check,
  Loader2,
  Terminal,
  Cpu,
  StopCircle,
  ChevronRight,
  AlertTriangle,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ExtensionConfig, Template } from "@/lib/types"
import { Progress } from "@/components/ui/progress"
import { motion, AnimatePresence } from "framer-motion"

interface AiAssistantProps {
  config: ExtensionConfig
  selectedTemplate: Template | null
  generatedCode: Record<string, string>
  onGenerate: (code: Record<string, string>, config?: Partial<ExtensionConfig>) => void
  onConfigUpdate: (config: ExtensionConfig) => void
  onStreamingUpdate?: (allFiles: Record<string, string>, currentFile: string | null) => void
}

interface ErrorState {
  message: string
  partialFiles: Record<string, string>
  lastPrompt: string
  timestamp: number
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
  isError?: boolean
  validationStatus?: "valid" | "has-errors" | undefined
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

// NOTE: The suggestions were also updated in the updates section,
// so this section is effectively redundant, but kept for structure.
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
  const [errorState, setErrorState] = useState<ErrorState | null>(null)
  const [recoveredFiles, setRecoveredFiles] = useState<Record<string, string>>({})
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [isValidating, setIsValidating] = useState(false)
  const [validationErrors, setValidationErrors] = useState<
    Array<{ file: string; line: number; column: number; message: string }>
  >([])
  const [fixAttempts, setFixAttempts] = useState(0)
  const [isAutoFixing, setIsAutoFixing] = useState(false)
  const MAX_FIX_ATTEMPTS = 3
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    adjustTextareaHeight()
  }, [prompt, adjustTextareaHeight])

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
        console.log("[App] No valid JSON boundaries found")
        return null
      }

      // Extract just the JSON part
      cleaned = cleaned.slice(firstBrace, lastBrace + 1)

      // Try parsing directly first
      try {
        const parsed = JSON.parse(cleaned)
        return processParseResult(parsed)
      } catch (directError) {
        console.log("[App] Direct parse failed, trying repairs...")
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
        console.log("[App] Repaired parse failed:", (repairedError as Error).message?.slice(0, 100))
      }

      // Final fallback: extract files using a state machine parser
      return extractFilesWithStateMachine(text)
    } catch (e) {
      console.log("[App] JSON parse error:", (e as Error).message?.slice(0, 100))
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

  const processParseResult = (parsed: any): GenerationResult | null => {
    if (parsed && typeof parsed === "object") {
      const files = parsed.files || {}
      if (Object.keys(files).length > 0) {
        let extractedConfig: Partial<ExtensionConfig> | undefined

        // Format JSON files with proper line breaks
        const formattedFiles: Record<string, string> = {}
        for (const [filePath, content] of Object.entries(files)) {
          if (filePath.endsWith(".json")) {
            try {
              // Parse and reformat JSON with proper indentation
              const jsonContent = typeof content === "string" ? JSON.parse(content as string) : content
              formattedFiles[filePath] = JSON.stringify(jsonContent, null, 2)
            } catch (e) {
              // If parsing fails, keep original content
              formattedFiles[filePath] = content as string
            }
          } else {
            formattedFiles[filePath] = content as string
          }
        }

        if (formattedFiles["package.json"]) {
          try {
            const pkg = JSON.parse(formattedFiles["package.json"])
            extractedConfig = {
              name: pkg.name,
              displayName: pkg.displayName,
              description: pkg.description,
              version: pkg.version,
              publisher: pkg.publisher,
              category: pkg.categories?.[0] || "Other",
              contributes: pkg.contributes,
            }
          } catch (e) {
            console.log("[App] Could not parse package.json for config extraction")
          }
        }

        return {
          files: formattedFiles,
          message: parsed.message || "Generated successfully",
          commands: parsed.commands || [],
          activationEvents: parsed.activationEvents || [],
          extractedConfig,
        }
      }
    }
    return null
  }

  const extractFilesWithStateMachine = (text: string): GenerationResult | null => {
    const files: Record<string, string> = {}
    const filePattern =
      /"([^"]+\.(ts|tsx|js|jsx|json|md|txt|gitignore|vscodeignore|yaml|yml|toml|Makefile|LICENSE|CHANGELOG\.md))"\s*:\s*"/gi

    let match
    while ((match = filePattern.exec(text)) !== null) {
      const filename = match[1]
      const startIndex = match.index + match[0].length

      let content = ""
      const depth = 0
      const inString = true
      let escapeNext = false

      for (let i = startIndex; i < text.length; i++) {
        const char = text[i]

        if (escapeNext) {
          if (char === "n") content += "\n"
          else if (char === "t") content += "\t"
          else if (char === "r") content += "\r"
          else if (char === '"') content += '"'
          else if (char === "\\") content += "\\"
          else content += char
          escapeNext = false
          continue
        }

        if (char === "\\") {
          escapeNext = true
          continue
        }

        if (char === '"' && !escapeNext) {
          break
        }

        content += char
      }

      if (content.length > 0) {
        files[filename] = content
      }
    }

    if (Object.keys(files).length > 0) {
      // Format JSON files with proper line breaks
      const formattedFiles: Record<string, string> = {}
      for (const [filePath, content] of Object.entries(files)) {
        if (filePath.endsWith(".json")) {
          try {
            // Parse and reformat JSON with proper indentation
            const jsonContent = JSON.parse(content)
            formattedFiles[filePath] = JSON.stringify(jsonContent, null, 2)
          } catch (e) {
            // If parsing fails, keep original content
            formattedFiles[filePath] = content
          }
        } else {
          formattedFiles[filePath] = content
        }
      }

      return {
        files: formattedFiles,
        message: "Extracted files from response",
        commands: [],
        activationEvents: [],
      }
    }

    return null
  }

  const extractPartialFiles = (
    text: string,
  ): {
    files: string[]
    currentFile: string | null
    currentContent: string
    completedFiles: Record<string, string>
  } => {
    const files: string[] = []
    const completedFiles: Record<string, string> = {}
    let currentFile: string | null = null
    let currentContent = ""

    const fileMatches = text.matchAll(
      /"([^"]+\.(ts|tsx|js|jsx|json|md|txt|gitignore|vscodeignore|yaml|yml|Makefile|LICENSE))"\s*:\s*"/gi,
    )

    const matchArray = Array.from(fileMatches)

    for (let i = 0; i < matchArray.length; i++) {
      const match = matchArray[i]
      const filename = match[1]

      if (!files.includes(filename)) {
        files.push(filename)
      }

      const startIndex = match.index! + match[0].length
      const nextMatch = matchArray[i + 1]
      const searchEndIndex = nextMatch ? nextMatch.index! : text.length

      let content = ""
      let escapeNext = false
      let foundEnd = false

      for (let j = startIndex; j < searchEndIndex; j++) {
        const char = text[j]

        if (escapeNext) {
          if (char === "n") content += "\n"
          else if (char === "t") content += "\t"
          else if (char === "r") content += "\r"
          else if (char === '"') content += '"'
          else if (char === "\\") content += "\\"
          else content += char
          escapeNext = false
          continue
        }

        if (char === "\\") {
          escapeNext = true
          continue
        }

        if (char === '"') {
          foundEnd = true
          break
        }

        content += char
      }

      if (foundEnd && content.length > 0) {
        // Format JSON files with proper line breaks
        if (filename.endsWith(".json")) {
          try {
            const jsonContent = JSON.parse(content)
            completedFiles[filename] = JSON.stringify(jsonContent, null, 2)
          } catch (e) {
            // If parsing fails, keep original content
            completedFiles[filename] = content
          }
        } else {
          completedFiles[filename] = content
        }
      }

      if (i === matchArray.length - 1) {
        currentFile = filename
        // Format current content if it's a JSON file
        if (filename.endsWith(".json")) {
          try {
            const jsonContent = JSON.parse(content)
            currentContent = JSON.stringify(jsonContent, null, 2)
          } catch (e) {
            currentContent = content
          }
        } else {
          currentContent = content
        }
      }
    }

    return { files, currentFile, currentContent, completedFiles }
  }

  const validateFiles = async (
    files: Record<string, string>,
  ): Promise<{ valid: boolean; errors: Array<{ file: string; line: number; column: number; message: string }> }> => {
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      })

      if (!response.ok) {
        throw new Error("Validation request failed")
      }

      return await response.json()
    } catch (error) {
      console.error("[App] Validation error:", error)
      return { valid: true, errors: [] } // Assume valid on error to not block
    }
  }

  const attemptAutoFix = async (
    files: Record<string, string>,
    errors: Array<{ file: string; line: number; column: number; message: string }>,
  ) => {
    if (fixAttempts >= MAX_FIX_ATTEMPTS) {
      setGenerationStage("Max fix attempts reached. Manual review needed.")
      setIsAutoFixing(false)
      return files
    }

    setIsAutoFixing(true)
    setFixAttempts((prev) => prev + 1)
    setGenerationStage(`Auto-fixing syntax errors (attempt ${fixAttempts + 1}/${MAX_FIX_ATTEMPTS})...`)
    setGenerationProgress(50)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Fix the syntax errors",
          config,
          template: selectedTemplate,
          mode: "modify",
          existingFiles: files,
          validationErrors: errors,
          isFixAttempt: true,
        }),
      })

      if (!response.ok) throw new Error("Fix attempt failed")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }
      }

      const result = parseAIResponse(fullText)

      if (result && Object.keys(result.files).length > 0) {
        // Merge fixed files with existing files
        const mergedFiles = { ...files, ...result.files }

        // Validate the fixed files
        setGenerationStage("Validating fixes...")
        const revalidation = await validateFiles(mergedFiles)

        if (revalidation.valid) {
          setGenerationStage("All syntax errors fixed!")
          setGenerationProgress(100)
          setValidationErrors([])
          setIsAutoFixing(false)
          return mergedFiles
        } else {
          // Still has errors, try again
          setValidationErrors(revalidation.errors)
          return attemptAutoFix(mergedFiles, revalidation.errors)
        }
      }
    } catch (error) {
      console.error("[App] Auto-fix error:", error)
    }

    setIsAutoFixing(false)
    return files
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setStreamingFiles([])
    setCurrentStreamingFile(null)
    setCurrentStreamingContent("")
    setGenerationStage("Starting generation...")
    setGenerationProgress(5)
    setErrorState(null)
    setRecoveredFiles({})
    setValidationErrors([])
    setFixAttempts(0)
    setIsAutoFixing(false)

    const userMessage: Message = { role: "user", content: prompt }
    const assistantMessage: Message = { role: "assistant", content: "", isGenerating: true }
    setMessages((prev) => [...prev, userMessage, assistantMessage])

    abortControllerRef.current = new AbortController()

    let streamedCompletedFiles: Record<string, string> = {}
    const currentPrompt = prompt

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
          recoveredFiles: Object.keys(recoveredFiles).length > 0 ? recoveredFiles : undefined,
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

          const { files, currentFile, currentContent, completedFiles } = extractPartialFiles(fullText)

          if (Object.keys(completedFiles).length > 0) {
            streamedCompletedFiles = { ...streamedCompletedFiles, ...completedFiles }
          }

          if (files.length > 0) {
            setStreamingFiles(files)
            setGenerationProgress(Math.min(20 + files.length * 10, 80))
          }

          if (currentFile) {
            setCurrentStreamingFile(currentFile)
            setCurrentStreamingContent(currentContent)
            setGenerationStage(`Writing ${currentFile}...`)
            const streamingFilesState = { ...completedFiles }
            if (currentFile && currentContent) {
              streamingFilesState[currentFile] = currentContent
            }
            onStreamingUpdate?.(streamingFilesState, currentFile)
          }
        }
      }

      setGenerationProgress(85)
      setGenerationStage("Parsing response...")
      onStreamingUpdate?.({}, null)
      setRecoveredFiles({})

      const result = parseAIResponse(fullText)

      if (result) {
        let finalFiles = result.files

        setGenerationStage("Validating syntax...")
        setIsValidating(true)
        setGenerationProgress(90)

        const validation = await validateFiles(finalFiles)
        setIsValidating(false)

        if (!validation.valid && validation.errors.length > 0) {
          setValidationErrors(validation.errors)
          setGenerationStage(`Found ${validation.errors.length} syntax error(s). Auto-fixing...`)

          // Attempt auto-fix
          finalFiles = await attemptAutoFix(finalFiles, validation.errors)
        }

        setGenerationProgress(100)
        setGenerationStage("Complete!")

        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? {
                  role: "assistant" as const,
                  content: result.message,
                  files: finalFiles,
                  isGenerating: false,
                  validationStatus: validationErrors.length > 0 ? "has-errors" : "valid",
                }
              : m,
          ),
        )

        onGenerate(finalFiles, result.extractedConfig)

        if (result.commands?.length || result.activationEvents?.length) {
          const existingCommands = (config.contributes?.commands as Array<{ command: string; title: string }>) || []
          const newCommands =
            result.commands?.map((cmd) => ({
              command: cmd.includes(".") ? cmd : `${config.name || "myext"}.${cmd}`,
              title: cmd
                .split(".")
                .pop()!
                .replace(/([A-Z])/g, " $1")
                .trim(),
            })) || []

          const mergedCommands = [...existingCommands]
          for (const cmd of newCommands) {
            if (!mergedCommands.some((c) => c.command === cmd.command)) {
              mergedCommands.push(cmd)
            }
          }

          onConfigUpdate({
            ...config,
            contributes: {
              ...config.contributes,
              commands: mergedCommands,
            },
          })
        }
      } else {
        if (Object.keys(streamedCompletedFiles).length > 0) {
          setErrorState({
            message: "Could not parse full response, but some files were captured.",
            partialFiles: streamedCompletedFiles,
            lastPrompt: currentPrompt,
            timestamp: Date.now(),
          })

          onGenerate(streamedCompletedFiles)
        }

        throw new Error("Could not parse AI response")
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        if (Object.keys(streamedCompletedFiles).length > 0) {
          setErrorState({
            message: "Generation was stopped, but partial files were saved.",
            partialFiles: streamedCompletedFiles,
            lastPrompt: currentPrompt,
            timestamp: Date.now(),
          })
          onGenerate(streamedCompletedFiles)
        }
        setGenerationStage("Stopped")
      } else {
        console.error("Generation error:", error)
        if (Object.keys(streamedCompletedFiles).length > 0) {
          setErrorState({
            message: `Error: ${(error as Error).message}. Partial files were saved.`,
            partialFiles: streamedCompletedFiles,
            lastPrompt: currentPrompt,
            timestamp: Date.now(),
          })
          onGenerate(streamedCompletedFiles)
        }

        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? {
                  role: "assistant" as const,
                  content: `Generation error: ${(error as Error).message}`,
                  isGenerating: false,
                  isError: true,
                }
              : m,
          ),
        )
      }
    } finally {
      setIsGenerating(false)
      setPrompt("")
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleContinue = () => {
    if (errorState) {
      setRecoveredFiles(errorState.partialFiles)
      setPrompt(`Continue from where we left off. Previous request: "${errorState.lastPrompt.slice(0, 100)}..."`)
      setErrorState(null)
    }
  }

  const handleRetry = () => {
    if (errorState) {
      setPrompt(errorState.lastPrompt)
      setErrorState(null)
      setTimeout(() => handleGenerate(), 100)
    }
  }

  const handleManualFix = async () => {
    if (validationErrors.length === 0) return

    const currentFiles = messages[messages.length - 1]?.files || generatedCode
    if (Object.keys(currentFiles).length === 0) return

    setIsGenerating(true)
    setGenerationStage("Attempting manual fix...")

    const fixedFiles = await attemptAutoFix(currentFiles, validationErrors)

    if (Object.keys(fixedFiles).length > 0) {
      onGenerate(fixedFiles)
      setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, files: fixedFiles } : m)))
    }

    setIsGenerating(false)
  }

  const suggestions =
    mode === "add-feature"
      ? [
          "Add a status bar item showing current file info",
          "Create a custom tree view for the sidebar",
          "Add keyboard shortcuts for common actions",
          "Implement a webview panel with interactive UI",
        ]
      : [
          "Create a Pomodoro timer extension w...",
          "Build a Git commit message generator...",
          "Create a code complexity analyzer e...",
          "Build a TODO comment highlighter an...",
        ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 border-b border-zinc-800 bg-zinc-900/50 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20 shrink-0">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm sm:text-base truncate">AI Extension Generator</h3>
          <p className="text-[10px] sm:text-xs text-zinc-400">Smart VS Code Extension Builder</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1.5 sm:gap-2 border-b border-zinc-800 bg-zinc-900/30 px-3 sm:px-4 py-2 overflow-x-auto">
        <Badge
          variant={mode === "add-feature" ? "default" : "outline"}
          className={cn(
            "cursor-pointer transition-colors text-xs whitespace-nowrap",
            mode === "add-feature" ? "bg-violet-600 hover:bg-violet-700" : "hover:bg-zinc-800",
          )}
          onClick={() => setMode("add-feature")}
        >
          + Add Feature
        </Badge>
        <Badge
          variant={mode === "generate-scratch" ? "default" : "outline"}
          className={cn(
            "cursor-pointer transition-colors text-xs whitespace-nowrap",
            mode === "generate-scratch" ? "bg-violet-600 hover:bg-violet-700" : "hover:bg-zinc-800",
          )}
          onClick={() => setMode("generate-scratch")}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          From Scratch
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 ? (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm text-zinc-400">
              {mode === "add-feature"
                ? "Describe the feature you want to add to your extension"
                : "Describe your extension idea and AI will generate everything"}
            </p>
            <div className="space-y-2">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(suggestion)}
                  className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 sm:px-3 py-2 text-left text-xs sm:text-sm text-zinc-300 transition-colors hover:border-violet-500/50 hover:bg-zinc-800"
                >
                  <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
                  <span className="line-clamp-2">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-2 text-sm text-white">
                    <span className="text-xs font-medium text-violet-200">{">"}_ YOU</span>
                    <p className="mt-1">{msg.content.length > 60 ? `${msg.content.slice(0, 60)}...` : msg.content}</p>
                  </div>
                ) : (
                  <div className="max-w-[95%] space-y-2">
                    <span className="text-xs font-medium text-violet-400">{"</>"} AI</span>
                    {msg.isGenerating ? (
                      <Card className="border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                            {isAutoFixing ? (
                              <Wrench className="h-5 w-5 animate-pulse text-amber-400" />
                            ) : isValidating ? (
                              <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
                            ) : (
                              <Terminal className="h-5 w-5 animate-pulse text-violet-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">
                              {currentStreamingFile ? `Writing ${currentStreamingFile}...` : generationStage}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {isAutoFixing
                                ? `Fix attempt ${fixAttempts}/${MAX_FIX_ATTEMPTS}`
                                : `Generating ${streamingFiles.length} file${streamingFiles.length !== 1 ? "s" : ""}...`}
                            </p>
                          </div>
                        </div>

                        <Progress value={generationProgress} className="mt-3 h-1" />

                        {streamingFiles.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {streamingFiles.map((file) => (
                              <motion.div
                                key={file}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                  "flex items-center gap-2 rounded px-2 py-1 text-xs",
                                  file === currentStreamingFile ? "bg-violet-500/20 text-violet-300" : "text-zinc-400",
                                )}
                              >
                                {file === currentStreamingFile ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 text-green-400" />
                                )}
                                <FileCode className="h-3 w-3" />
                                <span>{file}</span>
                                {file === currentStreamingFile && (
                                  <Badge variant="outline" className="ml-auto text-[10px]">
                                    {currentStreamingContent.length} chars
                                  </Badge>
                                )}
                                {file !== currentStreamingFile && (
                                  <Badge className="ml-auto bg-green-600 text-[10px]">Done</Badge>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </Card>
                    ) : msg.isError ? (
                      <Card className="border-red-500/30 bg-red-950/20 p-4">
                        <p className="text-sm text-red-300">{msg.content}</p>
                      </Card>
                    ) : msg.files && Object.keys(msg.files).length > 0 ? (
                      <Card className="border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="flex items-center gap-2 text-green-400">
                          <Check className="h-4 w-4" />
                          <span className="text-sm font-medium">Generated {Object.keys(msg.files).length} files</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.keys(msg.files).map((file) => (
                            <Badge key={file} variant="outline" className="text-xs">
                              {file}
                            </Badge>
                          ))}
                        </div>

                        {validationErrors.length > 0 && (
                          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                            <div className="flex items-center gap-2 text-amber-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {validationErrors.length} syntax error{validationErrors.length !== 1 ? "s" : ""}{" "}
                                remaining
                              </span>
                            </div>
                            <div className="mt-2 max-h-32 overflow-y-auto text-xs text-amber-300/70">
                              {validationErrors.slice(0, 5).map((err, idx) => (
                                <div key={idx} className="truncate">
                                  {err.file}:{err.line} - {err.message}
                                </div>
                              ))}
                              {validationErrors.length > 5 && (
                                <div className="text-zinc-500">...and {validationErrors.length - 5} more</div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleManualFix}
                              disabled={isGenerating}
                              className="mt-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 bg-transparent"
                            >
                              <Wrench className="mr-1 h-3 w-3" />
                              Try Auto-Fix Again
                            </Button>
                          </div>
                        )}
                      </Card>
                    ) : (
                      <Card className="border-zinc-800 bg-zinc-900/50 p-4">
                        <p className="text-sm text-zinc-300">Processing complete</p>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Error recovery UI */}
            <AnimatePresence>
              {errorState && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-300">{errorState.message}</p>
                      <p className="mt-1 text-xs text-amber-400/70">
                        Saved {Object.keys(errorState.partialFiles).length} file(s) before the error
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleContinue}
                          className="border-amber-500/50 text-amber-400 bg-transparent"
                        >
                          <ChevronRight className="mr-1 h-3 w-3" />
                          Continue
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRetry}
                          className="border-zinc-700 text-zinc-400 bg-transparent"
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Retry
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "add-feature" ? "Describe the feature to add..." : "Describe your extension idea..."}
            disabled={isGenerating}
            className="min-h-[50px] resize-none border-zinc-800 bg-zinc-900 pr-12 text-sm sm:text-base text-white placeholder:text-zinc-500"
            rows={1}
          />
          <div className="absolute bottom-2 right-2">
            {isGenerating ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleStop}
                className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="h-8 w-8 bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
