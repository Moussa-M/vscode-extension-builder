"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Key, Eye, EyeOff, ExternalLink, AlertCircle, Sparkles, Github, Store } from "lucide-react"
import { getStoredCredentials, saveCredentials } from "@/lib/storage"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [anthropicApiKey, setAnthropicApiKey] = useState("")
  const [githubToken, setGithubToken] = useState("")
  const [azureToken, setAzureToken] = useState("")
  const [openVsxToken, setOpenVsxToken] = useState("")
  const [publisherName, setPublisherName] = useState("")

  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showGithubToken, setShowGithubToken] = useState(false)
  const [showAzureToken, setShowAzureToken] = useState(false)
  const [showOpenVsxToken, setShowOpenVsxToken] = useState(false)

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      const stored = getStoredCredentials()
      setAnthropicApiKey(stored.anthropicApiKey || "")
      setGithubToken(stored.githubToken || "")
      setAzureToken(stored.azureToken || "")
      setOpenVsxToken(stored.openVsxToken || "")
      setPublisherName(stored.publisherName || "")
    }
  }, [open])

  const handleSave = () => {
    saveCredentials({
      anthropicApiKey,
      githubToken,
      azureToken,
      openVsxToken,
      publisherName
    })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-violet-400" />
            API Keys & Settings
          </DialogTitle>
          <DialogDescription>
            Configure your API keys and credentials
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ai" className="text-xs sm:text-sm">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                AI
              </TabsTrigger>
              <TabsTrigger value="github" className="text-xs sm:text-sm">
                <Github className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                GitHub
              </TabsTrigger>
              <TabsTrigger value="marketplaces" className="text-xs sm:text-sm">
                <Store className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Marketplaces
              </TabsTrigger>
            </TabsList>

            {/* AI Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
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
                    type={showAnthropicKey ? "text" : "password"}
                    value={anthropicApiKey}
                    onChange={(e) => setAnthropicApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            </TabsContent>

            {/* GitHub Tab */}
            <TabsContent value="github" className="space-y-4 mt-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-200">
                  GitHub Personal Access Token for creating releases and managing repositories.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-300">
                    GitHub Personal Access Token
                  </Label>
                  <a
                    href="https://github.com/settings/tokens/new?description=VSCode%20Extension%20Builder&scopes=repo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Create Token <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type={showGithubToken ? "text" : "password"}
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGithubToken(!showGithubToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showGithubToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Required for creating GitHub releases with VSIX files
                </p>
              </div>
            </TabsContent>

            {/* Marketplaces Tab */}
            <TabsContent value="marketplaces" className="space-y-4 mt-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-200">
                  Configure credentials for publishing to VS Code Marketplace and Open VSX Registry.
                </p>
              </div>

              <div className="space-y-4">
                {/* Publisher Name */}
                <div className="space-y-2">
                  <Label className="text-zinc-300">Publisher Name</Label>
                  <Input
                    type="text"
                    value={publisherName}
                    onChange={(e) => setPublisherName(e.target.value)}
                    placeholder="your-publisher-name"
                    className="bg-zinc-900 border-zinc-700 text-zinc-100"
                  />
                  <p className="text-xs text-zinc-500">
                    Your publisher identifier for both marketplaces
                  </p>
                </div>

                {/* Azure PAT */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-300">
                      Azure DevOps PAT (VS Code Marketplace)
                    </Label>
                    <a
                      href="https://dev.azure.com/_usersSettings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      Create Token <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      type={showAzureToken ? "text" : "password"}
                      value={azureToken}
                      onChange={(e) => setAzureToken(e.target.value)}
                      placeholder="Azure PAT token..."
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAzureToken(!showAzureToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showAzureToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Required for publishing to VS Code Marketplace
                  </p>
                </div>

                {/* OpenVSX Token */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-300">
                      Open VSX Access Token
                    </Label>
                    <a
                      href="https://open-vsx.org/user-settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                    >
                      Create Token <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      type={showOpenVsxToken ? "text" : "password"}
                      value={openVsxToken}
                      onChange={(e) => setOpenVsxToken(e.target.value)}
                      placeholder="OpenVSX token..."
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenVsxToken(!showOpenVsxToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showOpenVsxToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Required for publishing to Open VSX Registry
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

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
      </DialogContent>
    </Dialog>
  )
}
