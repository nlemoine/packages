import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { presetTokens } from '../src/index'

// Regression tests for the correctness bugs found in the first code review.

function dtcgColor(r: number, g: number, b: number, alpha = 1) {
  return { colorSpace: 'srgb', components: [r, g, b], alpha }
}
function dtcgDimension(value: number, unit = 'px') {
  return { value, unit }
}
function makeSource(tokens: Record<string, unknown>, filename = 'tokens.json') {
  return { filename, src: JSON.stringify(tokens) }
}
async function buildPreset(options: Parameters<typeof presetTokens>[0] = {}) {
  return presetTokens(options)
}

const SPACING_TOKENS = {
  spacing: {
    $type: 'dimension',
    sm: { $value: dtcgDimension(8) },
    md: { $value: dtcgDimension(16) },
  },
}

describe('themeAliases merge', () => {
  it('does not pollute the first source when two aliases target one key', async () => {
    const preset = await buildPreset({
      sources: [
        makeSource({
          color: { $type: 'color', red: { $value: dtcgColor(1, 0, 0) } },
          spacing: { $type: 'dimension', sm: { $value: dtcgDimension(8) } },
        }),
      ],
      theme: { color: ['color.*'], spacing: ['spacing.*'] },
      themeAliases: { color: 'merged', spacing: 'merged' },
    })
    const color = preset.theme?.color as Record<string, unknown>
    // The `color` section must not gain `spacing`'s keys via shared references.
    expect(color.red).toBeDefined()
    expect(color.sm).toBeUndefined()
    const merged = preset.theme?.merged as Record<string, unknown>
    expect(merged.red).toBeDefined()
    expect(merged.sm).toBeDefined()
  })

  it('deep-merges aliased sections without dropping nested siblings', async () => {
    const preset = await buildPreset({
      sources: [
        makeSource({
          color: {
            $type: 'color',
            brand: { primary: { $value: dtcgColor(0.2, 0.4, 0.8) } },
          },
        }),
      ],
      theme: {
        color: ['color.*'],
        // Pre-existing target with a nested key under `brand` that collides.
        colors: { 'brand.legacy': 'color.brand.primary' },
      },
      themeAliases: { color: 'colors' },
    })
    const colors = preset.theme?.colors as Record<
      string,
      Record<string, string>
    >
    // Both the pre-existing `legacy` and the aliased `primary` survive.
    expect(colors.brand.legacy).toBeDefined()
    expect(colors.brand.primary).toBeDefined()
  })
})

describe('pattern key derivation', () => {
  it('does not silently drop a token matched by a wildcard-free pattern', async () => {
    const preset = await buildPreset({
      sources: [makeSource(SPACING_TOKENS)],
      theme: { out: ['spacing.sm'] },
    })
    const out = preset.theme?.out as Record<string, unknown> | undefined
    expect(out).toBeDefined()
    expect(out?.sm).toBe('var(--spacing-sm)')
  })

  it('does not mangle keys for a mid-segment wildcard pattern', async () => {
    const preset = await buildPreset({
      sources: [makeSource(SPACING_TOKENS)],
      theme: { out: ['spac*'] },
    })
    const out = preset.theme?.out as Record<string, unknown>
    // The old code stripped the literal "spac", producing an "ing" key.
    expect(out.ing).toBeUndefined()
    const spacing = out.spacing as Record<string, string> | undefined
    expect(spacing?.sm).toBe('var(--spacing-sm)')
  })
})

describe('reading tokens from disk', () => {
  it('reads a token file from cwd (incl. a path with a space) and builds output', async () => {
    // Space in the directory exercises pathToFileURL encoding vs the old
    // `file://${cwd}` interpolation.
    const dir = mkdtempSync(join(tmpdir(), 'uno preset '))
    try {
      writeFileSync(join(dir, 'tokens.json'), JSON.stringify(SPACING_TOKENS))
      const preset = await buildPreset({
        cwd: dir,
        tokens: 'tokens.json',
        preflights: true,
        theme: { spacing: ['spacing.*'] },
      })
      const spacing = preset.theme?.spacing as Record<string, string>
      expect(spacing.sm).toBe('var(--spacing-sm)')
      const css = (
        preset.preflights as Array<{ getCSS: (c: unknown) => string }>
      )[0].getCSS({})
      expect(css).toContain('--spacing-sm')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('.default theme key', () => {
  it('maps a trailing .default segment to the UnoCSS DEFAULT key', async () => {
    const preset = await buildPreset({
      sources: [
        makeSource({
          color: {
            $type: 'color',
            bg: {
              default: { $value: dtcgColor(1, 1, 1) },
              subtle: { $value: dtcgColor(0.9, 0.9, 0.9) },
            },
          },
        }),
      ],
      theme: { color: ['color.*'] },
    })
    const bg = (preset.theme?.color as Record<string, unknown>).bg as Record<
      string,
      string
    >
    // The var name strips `.default` (→ --color-bg), so the theme key should be
    // DEFAULT (the bare-utility convention), not a literal `default` sibling.
    expect(bg.DEFAULT).toBe('rgb(var(--color-bg--c))')
    expect(bg.default).toBeUndefined()
    expect(bg.subtle).toBe('rgb(var(--color-bg-subtle--c))')
  })
})

describe('preflights option pass-through', () => {
  it('forwards permutations to terrazzo and keeps the theme mode-agnostic', async () => {
    // `permutations` is terrazzo's supported theming mechanism, so the preset
    // must forward it (unlike the deprecated baseSelector/modeSelectors, which
    // the type now blocks). It type-checks here because it is kept in
    // PresetTokensPreflights. Meaningful per-mode output needs a terrazzo
    // resolver (out of scope for a unit test); the contract verified here is
    // that the option is accepted and the theme stays a mode-agnostic var().
    const preset = await buildPreset({
      sources: [
        makeSource({
          color: {
            $type: 'color',
            brand: { primary: { $value: dtcgColor(0.2, 0.4, 0.8) } },
          },
        }),
      ],
      theme: { color: ['color.*'] },
      preflights: {
        permutations: [{ input: {}, prepare: (c) => `:root {\n${c}\n}` }],
      },
    })
    expect(preset.preflights).toBeDefined()
    const colors = preset.theme?.color as Record<string, Record<string, string>>
    expect(colors.brand.primary).toBe('rgb(var(--color-brand-primary--c))')
  })
})

describe('variable name collisions', () => {
  it('warns when two token ids map to the same CSS variable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // `color.fooBar` and `color.foo.bar` both kebab/lowercase to --color-foo-bar.
      await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              fooBar: { $value: dtcgColor(1, 0, 0) },
              foo: { bar: { $value: dtcgColor(0, 1, 0) } },
            },
          }),
        ],
      })
      const msg = warn.mock.calls.flat().join('\n')
      expect(msg).toContain('--color-foo-bar')
      expect(msg).toContain('color.fooBar')
      expect(msg).toContain('color.foo.bar')
    } finally {
      warn.mockRestore()
    }
  })

  it('does not warn when variable names are unique', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await buildPreset({ sources: [makeSource(SPACING_TOKENS)] })
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining('[unocss-preset-tokens]'),
      )
    } finally {
      warn.mockRestore()
    }
  })
})
