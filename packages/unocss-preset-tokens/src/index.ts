import { existsSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { TokenNormalized } from '@terrazzo/parser'
import { build, defineConfig, Logger, parse } from '@terrazzo/parser'
import type { CSSPluginOptions } from '@terrazzo/plugin-css'
import cssPlugin from '@terrazzo/plugin-css'
import { CachedWildcardMatcher } from '@terrazzo/token-tools'
import { makeCSSVar } from '@terrazzo/token-tools/css'
import type { Preset } from '@unocss/core'
import { definePreset } from '@unocss/core'
import type {
  PresetTokensOptions,
  PresetTokensPreflights,
  ThemeMapping,
  ThemeMappingEntry,
} from './types'

export type { PresetTokensOptions, ThemeMapping, ThemeMappingEntry }

type ParsedToken = TokenNormalized & { id: string; $type: string }

type TokenMap = Record<string, ParsedToken>

// --- Utilities ---

// Token-id glob matching. @terrazzo/token-tools no longer exports a
// `getTokenMatch` helper, so we wrap CachedWildcardMatcher (default `/`
// separator, which makes `*` span the `.` segments of a token id).
const wildcardMatcher = new CachedWildcardMatcher()

function matchGlob(id: string, pattern: string): boolean {
  return wildcardMatcher.match(pattern)(id)
}

/** Return the first glob that matches `id`, or undefined. */
function firstMatchingGlob(id: string, globs: string[]): string | undefined {
  return globs.find((glob) => matchGlob(id, glob))
}

function toArray<T>(value?: T | T[]): T[] {
  if (value == null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function matchesPatterns(
  id: string,
  patterns: Array<string | RegExp>,
): boolean {
  const globs = patterns.filter((p): p is string => typeof p === 'string')
  if (globs.length > 0 && firstMatchingGlob(id, globs)) {
    return true
  }
  return patterns.some((p) => p instanceof RegExp && p.test(id))
}

function normalizeToken(id: string, raw: TokenNormalized): ParsedToken {
  return { ...raw, id: raw.id ?? id } as ParsedToken
}

function hasKeys(record: Record<string, unknown>): boolean {
  return Object.keys(record).length > 0
}

function isObjectEntry(
  entry: ThemeMappingEntry,
): entry is Record<string, string> {
  return typeof entry === 'object' && !Array.isArray(entry)
}

// --- Color handling ---

// DTCG colorSpaces that terrazzo serialises to a *named* CSS color function
// (`rgb()`, `hsl()`, `oklch()`, …), mapped to that function name. UnoCSS can
// alpha-inject these, so in the default `channels` mode the token is exposed as
// `fn(var(--x--c))` over a companion custom property holding bare channels (see
// addChannelVars). Every other space — the `color()` spaces (display-p3,
// rec2020, xyz…), the non-standard `lab-d65`/`okhsv`, and anything unknown —
// cannot be alpha-injected, so it is referenced whole as `var(--x)`.
const NAMED_COLOR_FUNCTION: Record<string, string> = {
  srgb: 'rgb',
  hsl: 'hsl',
  hwb: 'hwb',
  lab: 'lab',
  lch: 'lch',
  oklab: 'oklab',
  oklch: 'oklch',
}

// The named functions above, used to detect single-color declarations when
// generating channel companions. `rgba`/`hsla` are matched defensively in case
// a value serialises to the legacy comma syntax.
const NAMED_COLOR_FUNCTION_NAMES = [
  ...new Set(Object.values(NAMED_COLOR_FUNCTION)),
  'rgba',
  'hsla',
]

// Suffix for the companion custom property holding bare channels. A double dash
// cannot be produced by makeCSSVar (it collapses punctuation runs to a single
// dash), so `--x--c` never collides with a real token's variable name.
const CHANNEL_SUFFIX = '--c'

function colorSpaceOf(token: ParsedToken): string | undefined {
  const value = token.$value as { colorSpace?: unknown } | undefined
  if (
    value &&
    typeof value === 'object' &&
    typeof value.colorSpace === 'string'
  ) {
    return value.colorSpace
  }
  return undefined
}

function opacityMode(options: PresetTokensOptions): 'channels' | 'color-mix' {
  return options.opacity ?? 'channels'
}

function usesLegacyHex(options: PresetTokensOptions): boolean {
  return (
    typeof options.preflights === 'object' &&
    options.preflights.legacyHex === true
  )
}

/**
 * The CSS function a color token's value is wrapped in for `channels` mode, or
 * undefined when the token must be referenced whole as `var(--x)`: the `color()`
 * spaces, `lab-d65`/`okhsv`, unknown spaces, and — because hex cannot be
 * channel-wrapped — every color when `legacyHex` is enabled.
 */
function namedColorFunction(
  token: ParsedToken,
  options: PresetTokensOptions,
): string | undefined {
  if (usesLegacyHex(options)) {
    return undefined
  }
  const space = colorSpaceOf(token)
  if (!space) {
    // No colorSpace recorded: terrazzo emits plain sRGB values as rgb().
    return 'rgb'
  }
  return NAMED_COLOR_FUNCTION[space]
}

function toThemeValue(
  token: ParsedToken,
  cssVar: string,
  options: PresetTokensOptions,
): string {
  if (token.$type !== 'color') {
    return `var(${cssVar})`
  }
  if (opacityMode(options) === 'color-mix') {
    // Keep the full color in --x; opacity rides on color-mix(). Works for every
    // color form, but requires a color-mix()-capable stack (Baseline 2023).
    return `color-mix(in oklab, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`
  }
  const fn = namedColorFunction(token, options)
  if (!fn) {
    // color() space / lab-d65 / okhsv / hex — reference the whole color.
    return `var(${cssVar})`
  }
  return `${fn}(var(${cssVar}${CHANNEL_SUFFIX}))`
}

/**
 * `channels`-mode preflight transform. Terrazzo emits each color as a full
 * value (`--x: rgb(…)`). We keep that — so composite tokens referencing it via
 * `var(--x)` (borders, shadows, gradients) stay valid — and append a companion
 * `--x--c` holding the bare channels, which the theme references as
 * `fn(var(--x--c))` so UnoCSS opacity modifiers resolve:
 *
 *   --x: rgb(R% G% B% / A);  (unchanged)
 *   --x--c: R% G% B%;        (added; alpha dropped, UnoCSS manages it)
 *
 * Color aliases (`--a: var(--b);`) get a mirrored companion `--a--c: var(--b--c)`
 * so opacity works through the alias chain. Composite values (shadows,
 * gradients), `color()`/hex values, and non-color aliases are left untouched.
 */
function addChannelVars(css: string): string {
  const fns = NAMED_COLOR_FUNCTION_NAMES.join('|')
  const colorDecl = new RegExp(
    `^(\\s*)(--[\\w-]+):\\s*(?:${fns})\\(\\s*([^;)]+?)\\s*\\)\\s*;\\s*$`,
    'i',
  )
  const aliasDecl = /^(\s*)(--[\w-]+):\s*var\(\s*(--[\w-]+)\s*\)\s*;\s*$/
  const lines = css.split('\n')

  // Pass 1: which custom properties are colors that get a channel companion? A
  // var qualifies if it is a direct named-function color, or an alias that
  // (transitively) points at one. Propagate across alias edges to a fixpoint.
  const colorVars = new Set<string>()
  const aliasEdges: Array<[from: string, to: string]> = []
  for (const line of lines) {
    const color = line.match(colorDecl)
    if (color) {
      colorVars.add(color[2])
      continue
    }
    const alias = line.match(aliasDecl)
    if (alias) {
      aliasEdges.push([alias[2], alias[3]])
    }
  }
  for (let changed = true; changed; ) {
    changed = false
    for (const [from, to] of aliasEdges) {
      if (!colorVars.has(from) && colorVars.has(to)) {
        colorVars.add(from)
        changed = true
      }
    }
  }

  // Pass 2: emit each line, appending a companion for color declarations and
  // color aliases.
  const out: string[] = []
  for (const line of lines) {
    out.push(line)
    const color = line.match(colorDecl)
    if (color) {
      const [, indent, name, body] = color
      out.push(
        `${indent}${name}${CHANNEL_SUFFIX}: ${body.split('/')[0].trim()};`,
      )
      continue
    }
    const alias = line.match(aliasDecl)
    if (alias && colorVars.has(alias[2])) {
      const [, indent, name, target] = alias
      out.push(
        `${indent}${name}${CHANNEL_SUFFIX}: var(${target}${CHANNEL_SUFFIX});`,
      )
    }
  }
  return out.join('\n')
}

// --- CSS variable naming (single source of truth) ---

function defaultVarName(tokenId: string): string {
  return makeCSSVar(tokenId.replace(/\.default$/, ''))
}

function resolveVarName(
  token: TokenNormalized,
  options: PresetTokensOptions,
): string | null {
  if (options.variableName) {
    const custom = options.variableName(token)
    if (custom !== undefined) {
      return custom
    }
  }
  return defaultVarName(token.id)
}

/**
 * Warn (without failing) when two distinct token ids resolve to the same CSS
 * variable. makeCSSVar collapses `.`/`-`/`_` and lowercases, so ids like
 * `color.fooBar` and `color.foo.bar` both become `--color-foo-bar`; the
 * preflight would then emit that property twice (last wins) and the theme would
 * reference one variable for two different tokens.
 */
function warnVarNameCollisions(
  tokens: TokenMap,
  options: PresetTokensOptions,
): void {
  const idsByVar = new Map<string, string[]>()
  for (const [id, rawToken] of Object.entries(tokens)) {
    const token = normalizeToken(id, rawToken)
    const cssVar = resolveVarName(token, options)
    if (!cssVar) {
      continue
    }
    const ids = idsByVar.get(cssVar)
    if (ids) {
      ids.push(token.id)
    } else {
      idsByVar.set(cssVar, [token.id])
    }
  }
  for (const [cssVar, ids] of idsByVar) {
    if (ids.length > 1) {
      console.warn(
        `[unocss-preset-tokens] Multiple tokens map to ${cssVar}: ${ids.join(', ')}. ` +
          'Only the last applies; rename the tokens or use the variableName option.',
      )
    }
  }
}

// --- Token filtering ---

function shouldInclude(
  token: ParsedToken,
  options: PresetTokensOptions,
): boolean {
  if (options.filter && !options.filter(token)) {
    return false
  }
  const include = toArray(options.include)
  const exclude = toArray(options.exclude)
  if (include.length > 0 && !matchesPatterns(token.id, include)) {
    return false
  }
  if (exclude.length > 0 && matchesPatterns(token.id, exclude)) {
    return false
  }
  return true
}

// --- Theme building ---

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Recursively merge `source` into a deep clone of `target`, returning a fresh
 * object that shares no references with either input. Theme values are strings
 * (leaves) or nested objects; on a leaf conflict the source wins. Used for theme
 * aliases so aliasing never mutates a source section or clobbers nested keys
 * already present on the target.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(target)) {
    result[key] = isPlainObject(value) ? deepMerge(value, {}) : value
  }
  for (const [key, value] of Object.entries(source)) {
    const existing = result[key]
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value)
    } else {
      result[key] = isPlainObject(value) ? deepMerge(value, {}) : value
    }
  }
  return result
}

/**
 * The nested theme key for a token matched by a glob pattern. The pattern's
 * leading wildcard-free segments are stripped from the id (so `color.*` maps
 * `color.brand.primary` → `brand.primary`). A wildcard-free pattern is an exact
 * match, keyed by the token's last segment. A pattern whose first segment is a
 * wildcard leaves the id untrimmed rather than dropping or mangling it.
 *
 * A trailing `default` segment becomes UnoCSS's `DEFAULT` key (so `color.bg.default`
 * → `{ bg: { DEFAULT } }`, reachable as the bare utility), matching the var name
 * which also strips `.default` (see defaultVarName).
 */
function themeKeyFor(id: string, pattern: string): string {
  const segments = pattern.split('.')
  let fixed = 0
  while (fixed < segments.length && !segments[fixed].includes('*')) {
    fixed += 1
  }
  let key: string
  if (fixed === segments.length) {
    const idSegments = id.split('.').filter(Boolean)
    key = idSegments[idSegments.length - 1] ?? id
  } else {
    const prefix = fixed > 0 ? `${segments.slice(0, fixed).join('.')}.` : ''
    key = id.startsWith(prefix) ? id.slice(prefix.length) : id
  }
  return key.replace(/(^|\.)default$/, '$1DEFAULT')
}

function setNestedValue(
  target: Record<string, unknown>,
  keyPath: string,
  value: string,
): void {
  const segments = keyPath.split('.').filter(Boolean)
  if (segments.length === 0) {
    return
  }
  let current: Record<string, unknown> = target
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const existing = current[segment]
    if (typeof existing === 'string') {
      // Parent token already set as leaf — promote to object with DEFAULT
      current[segment] = { DEFAULT: existing }
    } else if (!existing || typeof existing !== 'object') {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }
  const lastKey = segments[segments.length - 1]
  const existing = current[lastKey]
  if (existing && typeof existing === 'object') {
    // Children already exist — store this value as DEFAULT
    ;(existing as Record<string, unknown>).DEFAULT = value
  } else {
    current[lastKey] = value
  }
}

function buildPatternSection(
  tokens: TokenMap,
  options: PresetTokensOptions,
  patterns: string[],
  section: Record<string, unknown>,
): void {
  for (const [id, rawToken] of Object.entries(tokens)) {
    const token = normalizeToken(id, rawToken)
    if (!shouldInclude(token, options)) {
      continue
    }

    const matchedPattern = firstMatchingGlob(id, patterns)
    if (!matchedPattern) {
      continue
    }

    const cssVar = resolveVarName(token, options)
    if (!cssVar) {
      continue
    }
    const value = toThemeValue(token, cssVar, options)
    setNestedValue(section, themeKeyFor(id, matchedPattern), value)
  }
}

function buildAliasSection(
  tokens: TokenMap,
  options: PresetTokensOptions,
  aliases: Record<string, string>,
  section: Record<string, unknown>,
): void {
  for (const [aliasKey, tokenId] of Object.entries(aliases)) {
    const rawToken = tokens[tokenId]
    if (!rawToken) {
      continue
    }
    const token = normalizeToken(tokenId, rawToken)
    if (!shouldInclude(token, options)) {
      continue
    }
    const cssVar = resolveVarName(token, options)
    if (!cssVar) {
      continue
    }
    setNestedValue(section, aliasKey, toThemeValue(token, cssVar, options))
  }
}

function buildTheme(
  tokens: TokenMap,
  options: PresetTokensOptions,
  mapping: ThemeMapping,
): Record<string, unknown> {
  const theme: Record<string, unknown> = {}

  for (const [themeKey, entry] of Object.entries(mapping)) {
    const section = (theme[themeKey] ?? {}) as Record<string, unknown>
    theme[themeKey] = section

    if (typeof entry === 'string' || Array.isArray(entry)) {
      buildPatternSection(tokens, options, toArray(entry), section)
    } else if (isObjectEntry(entry)) {
      buildAliasSection(tokens, options, entry, section)
    }
  }

  // Apply theme aliases (e.g. color → colors for UnoCSS preset compatibility).
  // Deep-merge into a fresh object so aliasing never mutates a source section
  // or clobbers nested keys already present on the target.
  for (const [from, to] of Object.entries(options.themeAliases ?? {})) {
    const fromSection = theme[from]
    if (!isPlainObject(fromSection) || !hasKeys(fromSection)) {
      continue
    }
    const toSection = theme[to]
    theme[to] = deepMerge(
      isPlainObject(toSection) ? toSection : {},
      fromSection,
    )
  }

  for (const key of Object.keys(theme)) {
    if (!hasKeys(theme[key] as Record<string, unknown>)) {
      delete theme[key]
    }
  }

  return theme
}

// --- Preflight CSS generation ---

/**
 * Collect tokens explicitly skipped by the variableName callback.
 * Note: include/exclude/filter only affect the theme, not preflights.
 * Primitive tokens must remain in preflights as they are referenced
 * by semantic tokens (e.g. --color-brand-primary: var(--color-primitive-...)).
 */
function collectSkippedTokenIds(
  tokens: TokenMap,
  options: PresetTokensOptions,
): string[] {
  if (!options.variableName) {
    return []
  }
  const skipped: string[] = []
  for (const [id, rawToken] of Object.entries(tokens)) {
    const token = normalizeToken(id, rawToken)
    if (!resolveVarName(token, options)) {
      skipped.push(token.id)
    }
  }
  return skipped
}

function mergeExcludes(
  base: string[] | undefined,
  extra: string[],
): string[] | undefined {
  if (!base?.length && extra.length === 0) {
    return base
  }
  return [...new Set([...(base ?? []), ...extra])]
}

async function buildPreflightCSS({
  tokens,
  sources,
  resolver,
  options,
  sourceFilenames,
  cwdUrl,
  logger,
}: {
  tokens: TokenMap
  sources: Awaited<ReturnType<typeof parse>>['sources']
  resolver: Awaited<ReturnType<typeof parse>>['resolver']
  options: PresetTokensOptions
  sourceFilenames: string[]
  cwdUrl: URL
  logger: Logger
}): Promise<string | null> {
  if (!options.preflights) {
    return null
  }
  const preflightOpts: PresetTokensPreflights =
    options.preflights === true ? {} : options.preflights

  const pluginOptions: CSSPluginOptions = {
    ...preflightOpts,
    exclude: mergeExcludes(
      preflightOpts.exclude,
      collectSkippedTokenIds(tokens, options),
    ),
    variableName: (token) =>
      resolveVarName(token, options) ?? makeCSSVar(token.id),
  }

  const config = defineConfig(
    {
      tokens: sourceFilenames,
      lint: { build: { enabled: false }, rules: {} },
      plugins: [cssPlugin(pluginOptions)],
    },
    { cwd: cwdUrl, logger },
  )

  const result = await build(tokens, {
    config,
    sources,
    resolver,
    logger,
  })

  const contents = result.outputFiles.find(
    (file) => file.plugin === '@terrazzo/plugin-css',
  )?.contents

  if (contents == null) {
    return null
  }
  const css =
    typeof contents === 'string' ? contents : contents.toString('utf8')
  // color-mix mode (and legacyHex) keep terrazzo's full colors untouched;
  // channels mode appends bare-channel companions for opacity modifiers.
  return opacityMode(options) === 'channels' && !usesLegacyHex(options)
    ? addChannelVars(css)
    : css
}

// --- Main preset ---

export const presetTokens = definePreset(
  async (
    options: PresetTokensOptions = {},
  ): Promise<Preset<Record<string, unknown>>> => {
    const cwd = options.cwd ?? process.cwd()
    // Trailing separator so relative token paths resolve under cwd; pathToFileURL
    // (not string interpolation) so spaces, `#`, `%` etc. are encoded correctly
    // and on Windows drive paths produce a valid file URL.
    const cwdUrl = pathToFileURL(resolve(cwd) + sep)
    const tokensPaths = toArray(options.tokens ?? './tokens.json')

    // String filenames for defineConfig (it resolves them against cwd).
    const sourceFilenames = options.sources
      ? options.sources.map((source) => source.filename)
      : tokensPaths

    // Parse requires URL filenames since @terrazzo/parser 2.x.
    const inputSources = options.sources
      ? options.sources.map((source) => ({
          filename: new URL(source.filename, cwdUrl),
          src: source.src,
        }))
      : tokensPaths.map((tokensPath) => {
          const fullPath = resolve(cwd, tokensPath)
          if (!existsSync(fullPath)) {
            throw new Error(
              `[unocss-preset-tokens] Token file not found: ${fullPath}`,
            )
          }
          return {
            // Derive the URL from the same resolved path we validated and read,
            // so the parser's filename can never diverge from it.
            filename: pathToFileURL(fullPath),
            src: readFileSync(fullPath, 'utf8'),
          }
        })

    const logger = new Logger()

    const config = defineConfig(
      {
        tokens: sourceFilenames,
        lint: { build: { enabled: false }, rules: {} },
      },
      { cwd: cwdUrl, logger },
    )

    const result = await parse(inputSources, { config, logger })
    const tokens = result.tokens as TokenMap

    warnVarNameCollisions(tokens, options)

    const theme = buildTheme(
      tokens,
      options,
      (options.theme ?? {}) as ThemeMapping,
    )

    const preflightCSS = await buildPreflightCSS({
      tokens,
      sources: result.sources,
      resolver: result.resolver,
      options,
      sourceFilenames,
      cwdUrl,
      logger,
    })

    return {
      name: options.presetName ?? '@n5s/unocss-preset-tokens',
      theme: hasKeys(theme) ? theme : undefined,
      preflights: preflightCSS ? [{ getCSS: () => preflightCSS }] : undefined,
      options,
    }
  },
)
