// Storage keys
const STORAGE_KEYS = {
  GITHUB_TOKEN: "vscode-ext-builder:github-token",
  AZURE_TOKEN: "vscode-ext-builder:azure-token",
  OPENVSX_TOKEN: "vscode-ext-builder:openvsx-token",
  PUBLISHER_NAME: "vscode-ext-builder:publisher-name",
  ANTHROPIC_API_KEY: "vscode-ext-builder:anthropic-api-key",
  TEMPLATE_CONFIG: "vscode-ext-builder:template-config:",
  TEMPLATE_ICON: "vscode-ext-builder:template-icon:",
  ACTIVE_PROJECT_ID: "vscode-ext-builder:active-project-id",
  USER_ID: "vscode-ext-builder:user-id",
}

export interface StoredCredentials {
  githubToken: string
  azureToken: string
  openVsxToken: string
  publisherName: string
  anthropicApiKey: string
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
    return { githubToken: "", azureToken: "", openVsxToken: "", publisherName: "", anthropicApiKey: "" }
  }

  return {
    githubToken: localStorage.getItem(STORAGE_KEYS.GITHUB_TOKEN) || "",
    azureToken: localStorage.getItem(STORAGE_KEYS.AZURE_TOKEN) || "",
    openVsxToken: localStorage.getItem(STORAGE_KEYS.OPENVSX_TOKEN) || "",
    publisherName: localStorage.getItem(STORAGE_KEYS.PUBLISHER_NAME) || "",
    anthropicApiKey: localStorage.getItem(STORAGE_KEYS.ANTHROPIC_API_KEY) || "",
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

  if (credentials.anthropicApiKey !== undefined) {
    if (credentials.anthropicApiKey) {
      localStorage.setItem(STORAGE_KEYS.ANTHROPIC_API_KEY, credentials.anthropicApiKey)
    } else {
      localStorage.removeItem(STORAGE_KEYS.ANTHROPIC_API_KEY)
    }
  }
}

export function clearCredentials() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEYS.GITHUB_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.AZURE_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.OPENVSX_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.PUBLISHER_NAME)
  localStorage.removeItem(STORAGE_KEYS.ANTHROPIC_API_KEY)
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

const DB_NAME = "vscode-ext-builder"
const DB_VERSION = 2
const PROJECTS_STORE = "projects"
const USER_EXTENSIONS_STORE = "user-extensions"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB not available"))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const store = db.createObjectStore(PROJECTS_STORE, { keyPath: "id" })
        store.createIndex("updatedAt", "updatedAt", { unique: false })
      }
      if (!db.objectStoreNames.contains(USER_EXTENSIONS_STORE)) {
        const store = db.createObjectStore(USER_EXTENSIONS_STORE, { keyPath: "id" })
        store.createIndex("updatedAt", "updatedAt", { unique: false })
      }
    }
  })
}

import type { ExtensionProject, UserExtension } from "./types"
import { getVisitorId, getCachedVisitorId, initializeVisitorId } from "./fingerprint"

export async function getAllProjects(): Promise<ExtensionProject[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROJECTS_STORE, "readonly")
      const store = tx.objectStore(PROJECTS_STORE)
      const request = store.index("updatedAt").getAll()
      request.onsuccess = () => {
        const projects = request.result as ExtensionProject[]
        resolve(projects.sort((a, b) => b.updatedAt - a.updatedAt))
      }
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

export async function getProject(id: string): Promise<ExtensionProject | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROJECTS_STORE, "readonly")
      const store = tx.objectStore(PROJECTS_STORE)
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

export async function saveProject(project: ExtensionProject): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROJECTS_STORE, "readwrite")
      const store = tx.objectStore(PROJECTS_STORE)
      const request = store.put({ ...project, updatedAt: Date.now() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Ignore storage errors
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROJECTS_STORE, "readwrite")
      const store = tx.objectStore(PROJECTS_STORE)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Ignore storage errors
  }
}

export function createNewProject(name: string, templateId: string | null = null): ExtensionProject {
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    templateId,
    config: {
      name: "",
      displayName: "",
      description: "",
      publisher: "",
      version: "0.0.1",
      category: "Other",
      activationEvents: [],
      contributes: {},
    },
    code: {},
    logoDataUrl: undefined,
  }
}

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT_ID)
}

export function setActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return
  if (id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, id)
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID)
  }
}

// Generate or get user ID for DynamoDB partitioning
export async function getUserId(): Promise<string> {
  if (typeof window === "undefined") return ""
  return await getVisitorId()
}

// Synchronous version for when we know the ID is already cached
export function getUserIdSync(): string {
  if (typeof window === "undefined") return ""
  return getCachedVisitorId() || ""
}

// Initialize fingerprint on app load
export async function initializeUser(): Promise<string> {
  return await initializeVisitorId()
}

// DynamoDB-backed user extension functions
export async function getAllUserExtensions(): Promise<UserExtension[]> {
  try {
    const userId = await getUserId()
    if (!userId) return []

    const res = await fetch(`/api/extensions?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) {
      console.error("Failed to fetch extensions:", await res.text())
      return []
    }
    return await res.json()
  } catch (error) {
    console.error("Error fetching extensions:", error)
    return []
  }
}

export async function saveUserExtension(extension: UserExtension): Promise<void> {
  try {
    const userId = await getUserId()
    if (!userId) return

    const res = await fetch("/api/extensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extension, userId, updatedAt: Date.now() }),
    })

    if (!res.ok) {
      console.error("Failed to save extension:", await res.text())
    }
  } catch (error) {
    console.error("Error saving extension:", error)
  }
}

export async function deleteUserExtension(id: string): Promise<void> {
  try {
    const userId = await getUserId()
    if (!userId) return

    const res = await fetch(`/api/extensions/${id}?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    })

    if (!res.ok) {
      console.error("Failed to delete extension:", await res.text())
    }
  } catch (error) {
    console.error("Error deleting extension:", error)
  }
}

export async function getUserExtension(id: string): Promise<UserExtension | null> {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const res = await fetch(`/api/extensions/${id}?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error("Error fetching extension:", error)
    return null
  }
}
