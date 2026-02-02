"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Settings, Eye, EyeOff, ExternalLink, AlertCircle } from "lucide-react"
import { getStoredCredentials, saveCredentials } from "@/lib/storage"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [anthropicApiKey, setAnthropicApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = getStoredCredentials()
    setAnthropicApiKey(stored.anthropicApiKey || "")
  }, [open])

  const handleSave = () => {
    saveCredentials({ anthropicApiKey })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-violet-400" />
            API Settings
          </DialogTitle>
          <DialogDescription>
            Configure your AI provider credentials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
            <p className="text-sm text-violet-200">
              Your API key is stored locally in your browser and only sent to Anthropic's API when generating code.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-zinc-300">
                Anthropic API Key <span className="text-red-400">*</span>
              </Label>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                Get API Key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Required for AI-powered code generation
            </p>
          </div>

          {!anthropicApiKey && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-400">
                An Anthropic API key is required to use AI code generation features.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!anthropicApiKey}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
            >
              {saved ? "Saved!" : "Save Settings"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
