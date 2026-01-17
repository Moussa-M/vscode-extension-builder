import FingerprintJS from "@fingerprintjs/fingerprintjs"

let visitorIdPromise: Promise<string> | null = null

export async function getVisitorId(): Promise<string> {
  if (typeof window === "undefined") return ""

  // Return cached promise to avoid multiple initializations
  if (visitorIdPromise) return visitorIdPromise

  visitorIdPromise = (async () => {
    try {
      const fp = await FingerprintJS.load()
      const result = await fp.get()
      return result.visitorId
    } catch (error) {
      console.error("FingerprintJS error:", error)
      // Fallback to localStorage-based ID if fingerprinting fails
      return getFallbackId()
    }
  })()

  return visitorIdPromise
}

function getFallbackId(): string {
  const STORAGE_KEY = "vscode-ext-builder:user-id"
  let userId = localStorage.getItem(STORAGE_KEY)
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(STORAGE_KEY, userId)
  }
  return userId
}

// Cached visitor ID for synchronous access (after initial load)
let cachedVisitorId: string | null = null

export function getCachedVisitorId(): string | null {
  return cachedVisitorId
}

export async function initializeVisitorId(): Promise<string> {
  const id = await getVisitorId()
  cachedVisitorId = id
  return id
}
