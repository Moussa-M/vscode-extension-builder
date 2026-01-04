"use client"

import { Code2, Save, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HeaderProps {
  extensionName?: string
  onSaveExtension?: () => void
  canSave?: boolean
  isSaving?: boolean
  lastSaved?: Date | null
}

export function Header({ extensionName, onSaveExtension, canSave, isSaving, lastSaved }: HeaderProps) {
  const formatLastSaved = (date: Date | null) => {
    if (!date) return null
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)

    if (diffSec < 5) return "Just saved"
    if (diffSec < 60) return `Saved ${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `Saved ${diffMin}m ago`
    return `Saved at ${date.toLocaleTimeString()}`
  }

  return (
    <header className="border-b border-border bg-sidebar">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Code2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">VSCode Extension Builder</h1>
              <p className="text-sm text-muted-foreground">
                {extensionName ? `Editing: ${extensionName}` : "Build extensions with AI + Templates"}
              </p>
            </div>
          </div>
          {canSave && onSaveExtension && (
            <div className="flex items-center gap-3">
              {lastSaved && (
                <span className="text-xs text-muted-foreground animate-in fade-in duration-300">
                  {formatLastSaved(lastSaved)}
                </span>
              )}
              <Button
                onClick={onSaveExtension}
                variant="outline"
                size="sm"
                disabled={isSaving}
                className={cn(
                  "gap-2 bg-transparent transition-all duration-300",
                  isSaving && "border-green-500/50 text-green-600",
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : lastSaved ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
