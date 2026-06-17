export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'mjml-preview-theme'

/** Read the persisted theme preference (defaults to following the system). */
export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // localStorage unavailable
  }
  return 'system'
}

/**
 * Apply a theme by toggling `data-theme` on <html> (which flips `color-scheme`,
 * and therefore every `light-dark()` token) and persisting the choice. `system`
 * clears the override so the OS preference wins again.
 */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = mode
  }
  try {
    if (mode === 'system') {
      localStorage.removeItem(KEY)
    } else {
      localStorage.setItem(KEY, mode)
    }
  } catch {
    // localStorage unavailable; the attribute still applies for this session
  }
}
