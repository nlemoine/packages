import type { CompileResult } from './types'

export interface CacheEntry extends CompileResult {
  compiledAt: number
  mtime?: string
}

export interface MjmlCache {
  get(filePath: string): CacheEntry | undefined
  set(filePath: string, result: CompileResult & { mtime?: string }): void
  invalidate(filePath: string): boolean
  clear(): void
  has(filePath: string): boolean
}

/** In-memory cache for compiled MJML templates, keyed by absolute file path. */
export function createCache(): MjmlCache {
  const cache = new Map<string, CacheEntry>()

  return {
    get(filePath) {
      return cache.get(filePath)
    },
    set(filePath, result) {
      cache.set(filePath, { ...result, compiledAt: Date.now() })
    },
    invalidate(filePath) {
      return cache.delete(filePath)
    },
    clear() {
      cache.clear()
    },
    has(filePath) {
      return cache.has(filePath)
    },
  }
}
