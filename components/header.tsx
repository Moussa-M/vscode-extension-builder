import { Code2, Github, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header() {
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
              <p className="text-sm text-muted-foreground">Build extensions with AI + Templates</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
