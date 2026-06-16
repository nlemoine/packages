import type { TokenNormalized } from '@terrazzo/parser'
import type { CSSPluginOptions } from '@terrazzo/plugin-css'
import type { PresetOptions } from '@unocss/core'

export type ThemeMappingEntry = string | string[] | Record<string, string>

export type ThemeMapping = Record<string, ThemeMappingEntry>

/**
 * Options forwarded to @terrazzo/plugin-css for preflight generation.
 * Variable naming is controlled at the preset level, not here.
 *
 * `baseSelector` / `baseScheme` / `modeSelectors` are omitted: they are
 * deprecated in terrazzo and relocate the base custom properties off `:root`,
 * which leaves the theme's `var(--x)` references dangling in the default state.
 * Use `permutations` (terrazzo's supported theming mechanism) instead — it keeps
 * the theme mode-agnostic and carries modes in the variable cascade.
 */
export type PresetTokensPreflights = Omit<
  CSSPluginOptions,
  | 'variableName'
  | 'filename'
  | 'skipBuild'
  | 'utility'
  | 'baseSelector'
  | 'baseScheme'
  | 'modeSelectors'
>

export interface PresetTokensOptions extends PresetOptions {
  /**
   * DTCG tokens file path(s) relative to `cwd`.
   * @default './tokens.json'
   */
  tokens?: string | string[]
  /**
   * Inline token sources. If provided, `tokens` is ignored.
   */
  sources?: Array<{ filename: string; src: string }>
  /**
   * Working directory for resolving paths.
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Include only matching token ids (globs or RegExp).
   */
  include?: Array<string | RegExp>
  /**
   * Exclude matching token ids (globs or RegExp).
   */
  exclude?: Array<string | RegExp>
  /**
   * Additional predicate to filter tokens.
   */
  filter?: (token: TokenNormalized) => boolean
  /**
   * Control the CSS variable name for a token.
   * Return `null` to skip the token entirely.
   * Return `undefined` to use the default name.
   */
  variableName?: (token: TokenNormalized) => string | null | undefined
  /**
   * Map token glob patterns to UnoCSS theme sections.
   * Keys are your DTCG namespace (e.g. `color`, `spacing`).
   */
  theme?: ThemeMapping
  /**
   * Map DTCG theme keys to UnoCSS-preset-specific keys.
   * E.g. `{ color: 'colors' }` makes tokens available under
   * both `theme('color.brand.primary')` and `theme('colors.brand.primary')`.
   */
  themeAliases?: Record<string, string>
  /**
   * Generate preflight CSS via @terrazzo/plugin-css.
   * Pass `true` for defaults or an options object.
   */
  preflights?: boolean | PresetTokensPreflights
  /**
   * How color tokens expose opacity to UnoCSS modifiers (e.g. `bg-x/50`).
   *
   * - `'channels'` (default): each color keeps its full value in `--x` (so
   *   borders/shadows/gradients that reference it stay valid) and a companion
   *   `--x--c` holds bare channels, referenced as `fn(var(--x--c))`. Works in
   *   every browser, but opacity modifiers only apply to the named-function
   *   color spaces (`srgb`, `hsl`, `oklch`, …), not `color()` spaces or hex.
   * - `'color-mix'`: colors stay whole and opacity uses `color-mix()`. Works
   *   for every color form, but requires a `color-mix()`-capable stack
   *   (Baseline 2023: Safari 16.4+, Chrome 111+, Firefox 113+).
   *
   * @default 'channels'
   */
  opacity?: 'channels' | 'color-mix'
  /**
   * Override preset name.
   * @default '@n5s/unocss-preset-tokens'
   */
  presetName?: string
}
