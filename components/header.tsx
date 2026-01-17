"use client"

import { Code2, Fingerprint, Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { getVisitorId } from "@/lib/fingerprint"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface HeaderProps {
  extensionName?: string
}

export function Header({ extensionName }: HeaderProps) {
  const [visitorId, setVisitorId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
      <div className="px-6 lg:px-8 py-4">
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

          {visitorId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs cursor-pointer hover:bg-accent transition-colors"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span className={copied ? "text-green-500" : "text-muted-foreground"}>
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
    </header>
  )
}
