"use client"

import { Code2, Fingerprint, Check, Copy, Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { getVisitorId } from "@/lib/fingerprint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SettingsModal } from "@/components/settings-modal"
import { APP_VERSION } from "@/lib/version"

interface HeaderProps {
  extensionName?: string
  version?: string
  settingsOpen?: boolean
  onSettingsOpenChange?: (open: boolean) => void
}

export function Header({ extensionName, version, settingsOpen, onSettingsOpenChange }: HeaderProps) {
  const [visitorId, setVisitorId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false)

  // Use controlled state if provided, otherwise use local state
  const isSettingsOpen = settingsOpen !== undefined ? settingsOpen : localSettingsOpen
  const setSettingsOpen = onSettingsOpenChange || setLocalSettingsOpen

  useEffect(() => {
    getVisitorId().then(setVisitorId)
  }, [])

  const copyToClipboard = async () => {
    if (visitorId) {
      await navigator.clipboard.writeText(visitorId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="border-b border-border bg-sidebar">
      <div className="px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex-shrink-0">
              <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-foreground truncate">VSCode Extension Builder</h1>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {APP_VERSION}
                </Badge>
              </div>
              {extensionName ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    Editing: {extensionName}
                  </p>
                  {version && (
                    <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 h-4 sm:h-5 font-mono">
                      v{version}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Build extensions with AI + Templates
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSettingsOpen(true)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">API Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {visitorId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 font-mono text-[10px] sm:text-xs cursor-pointer hover:bg-accent transition-colors flex-shrink-0"
                      onClick={copyToClipboard}
                    >
                      {copied ? (
                        <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" />
                      ) : (
                        <Fingerprint className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                      )}
                      <span className={`hidden sm:inline ${copied ? "text-green-500" : "text-muted-foreground"}`}>
                        {copied ? "Copied!" : visitorId.slice(0, 8)}
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs">{visitorId}</p>
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">Click to copy your device ID</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      <SettingsModal open={isSettingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}
