/**
 * Central version management for the VS Code Extension Builder
 *
 * This file serves as the single source of truth for version numbers
 * across the application, generated extensions, and GitHub releases.
 *
 * IMPORTANT: When bumping the version, update APP_VERSION only.
 * All other systems will automatically use this version.
 */

/**
 * Main application version
 * This should match the version in package.json
 */
export const APP_VERSION = "1.0.2"

/**
 * Default version for newly created extensions
 */
export const DEFAULT_EXTENSION_VERSION = "0.0.1"

/**
 * Version format validation
 */
export function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/i.test(version)
}

/**
 * Increment version number
 */
export function incrementVersion(
  currentVersion: string,
  type: "major" | "minor" | "patch"
): string {
  const parts = currentVersion.split("-")[0].split(".")
  const [major, minor, patch] = parts.map(Number)

  switch (type) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
    default:
      return currentVersion
  }
}

/**
 * Compare two versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split("-")[0].split(".").map(Number)
  const parts2 = v2.split("-")[0].split(".").map(Number)

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1
    if (parts1[i] < parts2[i]) return -1
  }

  return 0
}

/**
 * Get version for display (with 'v' prefix)
 */
export function getDisplayVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`
}
