// Storage keys
const STORAGE_KEYS = {
  GITHUB_TOKEN: "vscode-ext-builder:github-token",
  AZURE_TOKEN: "vscode-ext-builder:azure-token",
  OPENVSX_TOKEN: "vscode-ext-builder:openvsx-token",
  PUBLISHER_NAME: "vscode-ext-builder:publisher-name",
  TEMPLATE_CONFIG: "vscode-ext-builder:template-config:",
  TEMPLATE_ICON: "vscode-ext-builder:template-icon:",
}

export interface StoredCredentials {
  githubToken: string
  azureToken: string
  openVsxToken: string
  publisherName: string
}

// Template config persistence
export interface StoredTemplateConfig {
  name?: string
  displayName?: string
  description?: string
  publisher?: string
  version?: string
  category?: string
  activationEvents?: string[]
  contributes?: Record<string, unknown>
}

export function getStoredCredentials(): StoredCredentials {
  if (typeof window === "undefined") {
    return { githubToken: "", azureToken: "", openVsxToken: "", publisherName: "" }
  }

  return {
    githubToken: localStorage.getItem(STORAGE_KEYS.GITHUB_TOKEN) || "",
    azureToken: localStorage.getItem(STORAGE_KEYS.AZURE_TOKEN) || "",
    openVsxToken: localStorage.getItem(STORAGE_KEYS.OPENVSX_TOKEN) || "",
    publisherName: localStorage.getItem(STORAGE_KEYS.PUBLISHER_NAME) || "",
  }
}

export function saveCredentials(credentials: Partial<StoredCredentials>) {
  if (typeof window === "undefined") return

  if (credentials.githubToken !== undefined) {
    if (credentials.githubToken) {
      localStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, credentials.githubToken)
    } else {
      localStorage.removeItem(STORAGE_KEYS.GITHUB_TOKEN)
    }
  }

  if (credentials.azureToken !== undefined) {
    if (credentials.azureToken) {
      localStorage.setItem(STORAGE_KEYS.AZURE_TOKEN, credentials.azureToken)
    } else {
      localStorage.removeItem(STORAGE_KEYS.AZURE_TOKEN)
    }
  }

  if (credentials.openVsxToken !== undefined) {
    if (credentials.openVsxToken) {
      localStorage.setItem(STORAGE_KEYS.OPENVSX_TOKEN, credentials.openVsxToken)
    } else {
      localStorage.removeItem(STORAGE_KEYS.OPENVSX_TOKEN)
    }
  }

  if (credentials.publisherName !== undefined) {
    if (credentials.publisherName) {
      localStorage.setItem(STORAGE_KEYS.PUBLISHER_NAME, credentials.publisherName)
    } else {
      localStorage.removeItem(STORAGE_KEYS.PUBLISHER_NAME)
    }
  }
}

export function clearCredentials() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEYS.GITHUB_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.AZURE_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.OPENVSX_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.PUBLISHER_NAME)
}

export function getStoredTemplateConfig(templateId: string): StoredTemplateConfig | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.TEMPLATE_CONFIG}${templateId}`)
    if (!raw) return null
    return JSON.parse(raw) as StoredTemplateConfig
  } catch {
    return null
  }
}

export function saveTemplateConfig(templateId: string, config: StoredTemplateConfig) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${STORAGE_KEYS.TEMPLATE_CONFIG}${templateId}`, JSON.stringify(config))
  } catch {
    // Ignore storage errors (private mode, quota exceeded)
  }
}

export function getStoredTemplateIcon(templateId: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(`${STORAGE_KEYS.TEMPLATE_ICON}${templateId}`)
  } catch {
    return null
  }
}

export function saveTemplateIcon(templateId: string, dataUrl: string | null) {
  if (typeof window === "undefined") return
  try {
    const key = `${STORAGE_KEYS.TEMPLATE_ICON}${templateId}`
    if (dataUrl) {
      localStorage.setItem(key, dataUrl)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignore storage errors
  }
}
