import { describe, expect, it } from 'vitest'
import { presetTokens } from '../src/index'

// --- Test fixtures ---

function dtcgColor(r: number, g: number, b: number, alpha = 1) {
  return {
    colorSpace: 'srgb',
    components: [r, g, b],
    alpha,
  }
}

function dtcgColorSpace(colorSpace: string, components: number[], alpha = 1) {
  return { colorSpace, components, alpha }
}

function dtcgDimension(value: number, unit = 'px') {
  return { value, unit }
}

function makeSource(tokens: Record<string, unknown>, filename = 'tokens.json') {
  return { filename, src: JSON.stringify(tokens) }
}

const COLOR_TOKENS = {
  color: {
    $type: 'color',
    brand: {
      primary: { $value: dtcgColor(0.2, 0.4, 0.8) },
      secondary: { $value: dtcgColor(0.8, 0.2, 0.4) },
    },
    bg: {
      default: { $value: dtcgColor(1, 1, 1) },
    },
    primitive: {
      red: { $value: dtcgColor(1, 0, 0) },
    },
  },
}

const SPACING_TOKENS = {
  spacing: {
    $type: 'dimension',
    sm: { $value: dtcgDimension(8) },
    md: { $value: dtcgDimension(16) },
    lg: { $value: dtcgDimension(32) },
  },
}

const NESTED_COLOR_TOKENS = {
  color: {
    $type: 'color',
    brand: {
      primary: {
        $value: dtcgColor(0.2, 0.4, 0.8),
        light: { $value: dtcgColor(0.4, 0.6, 0.9) },
        dark: { $value: dtcgColor(0.1, 0.2, 0.5) },
      },
    },
  },
}

const MIXED_TOKENS = {
  color: {
    $type: 'color',
    primary: { $value: dtcgColor(0.2, 0.4, 0.8) },
  },
  spacing: {
    $type: 'dimension',
    sm: { $value: dtcgDimension(8) },
  },
}

const WIDE_GAMUT_TOKENS = {
  color: {
    $type: 'color',
    okl: { $value: dtcgColorSpace('oklch', [0.7, 0.15, 250]) },
    hsl: { $value: dtcgColorSpace('hsl', [220, 60, 50]) },
    p3: { $value: dtcgColorSpace('display-p3', [0.2, 0.4, 0.8]) },
    srgb: { $value: dtcgColorSpace('srgb', [0.2, 0.4, 0.8]) },
  },
}

async function buildPreset(options: Parameters<typeof presetTokens>[0] = {}) {
  return presetTokens(options)
}

function getPreflightCSS(
  preset: Awaited<ReturnType<typeof presetTokens>>,
): string {
  const preflights = preset.preflights
  if (!preflights?.length) {
    throw new Error('expected preflights to be generated')
  }
  return preflights[0].getCSS({} as never)
}

// --- Tests ---

describe('presetTokens', () => {
  describe('basic output', () => {
    it('returns preset with default name', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
      })
      expect(preset.name).toBe('@n5s/unocss-preset-tokens')
    })

    it('supports custom preset name', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        presetName: 'my-tokens',
      })
      expect(preset.name).toBe('my-tokens')
    })

    it('returns undefined theme when no mapping', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
      })
      expect(preset.theme).toBeUndefined()
    })

    it('returns undefined preflights when not requested', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
      })
      expect(preset.preflights).toBeUndefined()
    })
  })

  describe('theme mapping with patterns', () => {
    it('maps color tokens with rgb(var()) format', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      expect(colors).toBeDefined()
      const brand = colors.brand as Record<string, string>
      expect(brand.primary).toBe('rgb(var(--color-brand-primary--c))')
      expect(brand.secondary).toBe('rgb(var(--color-brand-secondary--c))')
    })

    it('maps dimension tokens with var() format', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        theme: { spacing: ['spacing.*'] },
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      expect(spacing).toBeDefined()
      expect(spacing.sm).toBe('var(--spacing-sm)')
      expect(spacing.md).toBe('var(--spacing-md)')
      expect(spacing.lg).toBe('var(--spacing-lg)')
    })

    it('strips .default suffix from CSS variable names', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      const bg = colors.bg as Record<string, unknown>
      // Token id "color.bg.default" → theme key "bg.DEFAULT" (UnoCSS bare-utility
      // convention), and the CSS variable strips .default: --color-bg.
      expect((bg as Record<string, string>).DEFAULT).toMatch(/--color-bg--c\)/)
      expect((bg as Record<string, string>).DEFAULT).not.toMatch(
        /--color-bg-default/,
      )
    })

    it('handles multiple sources', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource(COLOR_TOKENS, 'colors.json'),
          makeSource(SPACING_TOKENS, 'spacing.json'),
        ],
        theme: {
          color: ['color.*'],
          spacing: ['spacing.*'],
        },
      })
      expect(preset.theme?.color).toBeDefined()
      expect(preset.theme?.spacing).toBeDefined()
    })

    it('uses DEFAULT for tokens with both value and children', async () => {
      const preset = await buildPreset({
        sources: [makeSource(NESTED_COLOR_TOKENS)],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      const primary = (colors.brand as Record<string, unknown>)
        .primary as Record<string, string>
      // Parent token → DEFAULT, children → named keys
      expect(primary.DEFAULT).toMatch(/--color-brand-primary--c\)/)
      expect(primary.light).toMatch(/--color-brand-primary-light--c\)/)
      expect(primary.dark).toMatch(/--color-brand-primary-dark--c\)/)
    })

    it('supports object mapping (explicit aliases)', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        theme: {
          color: {
            primary: 'color.brand.primary',
            secondary: 'color.brand.secondary',
          },
        },
      })
      const colors = preset.theme?.color as Record<string, string>
      expect(colors.primary).toMatch(/--color-brand-primary/)
      expect(colors.secondary).toMatch(/--color-brand-secondary/)
    })
  })

  describe('themeAliases', () => {
    it('creates aliased theme section', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        theme: { color: ['color.*'] },
        themeAliases: { color: 'colors' },
      })
      expect(preset.theme?.color).toBeDefined()
      expect(preset.theme?.colors).toBeDefined()
    })

    it('alias has same values as original', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        theme: { color: ['color.*'] },
        themeAliases: { color: 'colors' },
      })
      const original = preset.theme?.color as Record<string, unknown>
      const alias = preset.theme?.colors as Record<string, unknown>
      expect(alias.brand).toBeDefined()
      // Equal by value, but a distinct object (aliasing must not share refs).
      expect(alias.brand).toEqual(original.brand)
      expect(alias.brand).not.toBe(original.brand)
    })

    it('merges into an existing target section', async () => {
      const preset = await buildPreset({
        sources: [makeSource(MIXED_TOKENS)],
        theme: {
          color: { primary: 'color.primary' },
          colors: { spacingSm: 'spacing.sm' },
        },
        themeAliases: { color: 'colors' },
      })
      const colors = preset.theme?.colors as Record<string, string>
      // Pre-existing target key is preserved, source keys are merged in.
      expect(colors.spacingSm).toMatch(/--spacing-sm/)
      expect(colors.primary).toMatch(/--color-primary/)
    })

    it('does nothing when source key has no tokens', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        theme: { spacing: ['spacing.*'] },
        themeAliases: { spacing: 'gap' },
      })
      // No spacing tokens exist in COLOR_TOKENS → no theme section
      expect(preset.theme?.spacing).toBeUndefined()
      expect(preset.theme?.gap).toBeUndefined()
    })

    it('supports multiple aliases', async () => {
      const preset = await buildPreset({
        sources: [makeSource(MIXED_TOKENS)],
        theme: {
          color: ['color.*'],
          spacing: ['spacing.*'],
        },
        themeAliases: {
          color: 'colors',
          spacing: 'gap',
        },
      })
      expect(preset.theme?.colors).toBeDefined()
      expect(preset.theme?.gap).toBeDefined()
    })
  })

  describe('filtering', () => {
    it('excludes tokens matching exclude patterns', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        exclude: ['color.primitive.*'],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      expect(colors.primitive).toBeUndefined()
      expect(colors.brand).toBeDefined()
    })

    it('includes only tokens matching include patterns', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        include: ['color.brand.*'],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      expect(colors.brand).toBeDefined()
      expect(colors.bg).toBeUndefined()
      expect(colors.primitive).toBeUndefined()
    })

    it('supports custom filter function', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        filter: (token) => token.id.includes('primary'),
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      const brand = colors.brand as Record<string, string>
      expect(brand.primary).toBeDefined()
      expect(brand.secondary).toBeUndefined()
    })

    it('combines include, exclude and filter', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        include: ['color.brand.*'],
        exclude: ['color.brand.secondary'],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      const brand = colors.brand as Record<string, string>
      expect(brand.primary).toBeDefined()
      expect(brand.secondary).toBeUndefined()
    })
  })

  describe('variable naming', () => {
    it('uses default naming convention', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        theme: { spacing: ['spacing.*'] },
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      expect(spacing.sm).toBe('var(--spacing-sm)')
    })

    it('supports custom variableName callback', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        variableName: (token) => `--custom-${token.id.replaceAll('.', '-')}`,
        theme: { spacing: ['spacing.*'] },
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      expect(spacing.sm).toBe('var(--custom-spacing-sm)')
    })

    it('skips token when variableName returns null', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        variableName: (token) => (token.id === 'spacing.sm' ? null : undefined),
        theme: { spacing: ['spacing.*'] },
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      expect(spacing.sm).toBeUndefined()
      expect(spacing.md).toBe('var(--spacing-md)')
    })

    it('falls back to default when variableName returns undefined', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        variableName: () => undefined,
        theme: { spacing: ['spacing.*'] },
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      expect(spacing.sm).toBe('var(--spacing-sm)')
    })
  })

  describe('preflight CSS', () => {
    it('generates CSS custom properties when preflights enabled', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        preflights: true,
      })
      expect(preset.preflights).toBeDefined()
      expect(preset.preflights).toHaveLength(1)
      const css = getPreflightCSS(preset)
      expect(css).toContain('--spacing-sm')
      expect(css).toContain('--spacing-md')
    })

    it('keeps excluded tokens in preflights for reference chains', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        exclude: ['color.primitive.*'],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const css = getPreflightCSS(preset)
      // Primitives excluded from theme but kept in preflights
      expect(css).toContain('--color-brand-primary')
      expect(css).toContain('--color-primitive-red')
      expect(preset.theme?.color).toBeDefined()
      const colors = preset.theme?.color as Record<string, unknown>
      expect(colors.primitive).toBeUndefined()
    })

    it('skips tokens from preflights when variableName returns null', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        variableName: (token) =>
          token.id.startsWith('color.primitive') ? null : undefined,
        preflights: true,
      })
      const css = getPreflightCSS(preset)
      expect(css).toContain('--color-brand-primary')
      expect(css).not.toContain('--color-primitive-red')
    })

    it('keeps the full color and adds a bare-channel companion for opacity', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        preflights: true,
      })
      const css = getPreflightCSS(preset)
      // The full color is retained so composites referencing it stay valid...
      expect(css).toMatch(/--color-brand-primary:\s*rgb\(/)
      // ...and a companion holds bare channels (no wrapper) for `bg-x/50`.
      expect(css).toMatch(/--color-brand-primary--c:\s*[\d.]/)
      expect(css).not.toMatch(/--color-brand-primary--c:\s*rgb\(/)
    })

    it('uses consistent variable names between theme and preflights', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        variableName: (token) => `--tok-${token.id.replaceAll('.', '-')}`,
        theme: { spacing: ['spacing.*'] },
        preflights: true,
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      const css = getPreflightCSS(preset)
      // Both should use the custom name
      expect(spacing.sm).toContain('--tok-spacing-sm')
      expect(css).toContain('--tok-spacing-sm')
    })
  })

  describe('token type formatting', () => {
    it('wraps color tokens in rgb() for theme() and opacity modifier support', async () => {
      // Using a non-standard theme key for colors
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        theme: { myColors: ['color.*'] },
      })
      const section = preset.theme?.myColors as Record<string, unknown>
      const brand = section.brand as Record<string, string>
      // Value is rgb(var(--x)) — parseable by UnoCSS for opacity modifiers
      // and valid CSS when used in theme() directives
      expect(brand.primary).toMatch(/^rgb\(var\(--/)
      expect(brand.primary).not.toMatch(/<alpha-value>/)
    })

    it('uses var() format for non-color tokens regardless of theme key', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        theme: { customKey: ['spacing.*'] },
      })
      const section = preset.theme?.customKey as Record<string, string>
      expect(section.sm).toBe('var(--spacing-sm)')
      expect(section.sm).not.toMatch(/rgb/)
    })
  })

  describe('wide-gamut and modern color spaces', () => {
    it('wraps each named-function space in its own CSS function', async () => {
      const preset = await buildPreset({
        sources: [makeSource(WIDE_GAMUT_TOKENS)],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      expect(colors.okl).toBe('oklch(var(--color-okl--c))')
      expect(colors.hsl).toBe('hsl(var(--color-hsl--c))')
      expect(colors.srgb).toBe('rgb(var(--color-srgb--c))')
    })

    it('references color() spaces as a whole var (no function wrapper)', async () => {
      const preset = await buildPreset({
        sources: [makeSource(WIDE_GAMUT_TOKENS)],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      // display-p3 serialises to color(display-p3 …) which UnoCSS cannot
      // alpha-inject, so it is referenced whole.
      expect(colors.p3).toBe('var(--color-p3)')
    })

    it('strips named color functions but keeps color() intact in preflights', async () => {
      const preset = await buildPreset({
        sources: [makeSource(WIDE_GAMUT_TOKENS)],
        preflights: true,
      })
      const css = getPreflightCSS(preset)
      // Named-function colors keep their full value and gain a channel companion.
      expect(css).toMatch(/--color-okl:\s*oklch\(/)
      expect(css).toMatch(/--color-okl--c:\s*[\d.]/)
      expect(css).not.toMatch(/--color-okl--c:\s*oklch\(/)
      // color() spaces are referenced whole — kept intact, no companion.
      expect(css).toMatch(/--color-p3:\s*color\(display-p3/)
      expect(css).not.toContain('--color-p3--c')
    })

    it('drops alpha from stripped channels (UnoCSS manages opacity)', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              translucent: {
                $value: dtcgColorSpace('oklch', [0.7, 0.15, 250], 0.5),
              },
            },
          }),
        ],
        preflights: true,
      })
      const css = getPreflightCSS(preset)
      // The full color keeps the authored alpha...
      const fullLine = css
        .split('\n')
        .find((l) => /--color-translucent:/.test(l))
      expect(fullLine).toBeDefined()
      expect(fullLine).toContain('/')
      // ...but the channel companion drops it (UnoCSS injects opacity).
      const channelLine = css
        .split('\n')
        .find((l) => l.includes('--color-translucent--c:'))
      expect(channelLine).toBeDefined()
      expect(channelLine).not.toContain('/')
    })
  })

  describe('opacity option', () => {
    it('defaults to channels mode (full color + channel companion)', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      const brand = colors.brand as Record<string, string>
      expect(brand.primary).toBe('rgb(var(--color-brand-primary--c))')
      const css = getPreflightCSS(preset)
      expect(css).toMatch(/--color-brand-primary:\s*rgb\(/)
      expect(css).toMatch(/--color-brand-primary--c:/)
    })

    it('color-mix mode wraps the theme value in color-mix() and keeps colors whole', async () => {
      const preset = await buildPreset({
        sources: [makeSource(COLOR_TOKENS)],
        preflights: true,
        opacity: 'color-mix',
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, unknown>
      const brand = colors.brand as Record<string, string>
      expect(brand.primary).toBe(
        'color-mix(in oklab, var(--color-brand-primary) calc(<alpha-value> * 100%), transparent)',
      )
      const css = getPreflightCSS(preset)
      // Full color kept, no channel companion emitted.
      expect(css).toMatch(/--color-brand-primary:\s*rgb\(/)
      expect(css).not.toContain('--color-brand-primary--c')
    })

    it('color-mix mode also covers color() spaces that channels mode cannot', async () => {
      const preset = await buildPreset({
        sources: [makeSource(WIDE_GAMUT_TOKENS)],
        opacity: 'color-mix',
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      expect(colors.p3).toBe(
        'color-mix(in oklab, var(--color-p3) calc(<alpha-value> * 100%), transparent)',
      )
    })

    it('color-mix mode leaves non-color tokens as plain var()', async () => {
      const preset = await buildPreset({
        sources: [makeSource(SPACING_TOKENS)],
        opacity: 'color-mix',
        theme: { spacing: ['spacing.*'] },
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      expect(spacing.sm).toBe('var(--spacing-sm)')
    })
  })

  describe('error handling', () => {
    it('throws for missing token file', async () => {
      await expect(
        buildPreset({ tokens: './nonexistent.json' }),
      ).rejects.toThrow('Token file not found')
    })
  })
})
