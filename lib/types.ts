export interface ExtensionConfig {
  name: string
  displayName: string
  description: string
  publisher: string
  version: string
  category: string
  activationEvents: string[]
  contributes: Record<string, unknown>
}

export interface LogoConfig {
  variant: "marble" | "beam" | "pixel" | "sunset" | "ring" | "bauhaus"
  palette: number
  seed?: string
}

export interface Template {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  defaultConfig: Partial<ExtensionConfig>
  boilerplate: Record<string, string>
  suggestedConfig: {
    name: string
    displayName: string
    description: string
    publisher: string
    category: string
  }
  suggestedLogo?: LogoConfig
}
