// Storage keys
const STORAGE_KEYS = {
  GITHUB_TOKEN: "vscode-ext-builder:github-token",
  AZURE_TOKEN: "vscode-ext-builder:azure-token",
  OPENVSX_TOKEN: "vscode-ext-builder:openvsx-token",
  PUBLISHER_NAME: "vscode-ext-builder:publisher-name",
}

export interface StoredCredentials {
  githubToken: string
  azureToken: string
  openVsxToken: string
  publisherName: string
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
