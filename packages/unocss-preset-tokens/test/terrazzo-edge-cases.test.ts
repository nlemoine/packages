import { describe, expect, it } from 'vitest'
import { presetTokens } from '../src/index'
import type { PresetTokensPreflights } from '../src/types'

// Edge cases mined from terrazzo's own fixtures (packages/plugin-css/test/fixtures)
// and verified against the installed @terrazzo/* 2.3.x. Tests asserting DESIRED
// behavior fail today and prove the bugs in the report; the fix lands separately.

// --- fixtures ---

function dtcgColor(r: number, g: number, b: number, alpha = 1) {
  return { colorSpace: 'srgb', components: [r, g, b], alpha }
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
/** First value of a `--name:` declaration (base :root block). */
function varValue(css: string, name: string): string | undefined {
  return css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim()
}
/** A complete CSS <color>: a function call, hex, or var() — not bare channels. */
function looksLikeColor(value: string): boolean {
  return /^(#|var\(|[a-z][a-z0-9-]*\()/i.test(value.trim())
}

describe('terrazzo edge cases', () => {
  // ===================================================================
  // RED — confirmed bugs (assert desired behavior; fail until fixed)
  // ===================================================================

  describe('composite tokens referencing colors (A1)', () => {
    it('keeps a color usable by a border that references it via var()', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              gray: { $value: dtcgColor(0.65, 0.69, 0.71) },
            },
            border: {
              $type: 'border',
              solid: {
                $value: {
                  color: '{color.gray}',
                  width: dtcgDimension(1),
                  style: 'solid',
                },
              },
            },
          }),
        ],
        preflights: true,
        theme: { color: ['color.*'], border: ['border.*'] },
      })
      const css = getPreflightCSS(preset)
      // --border-solid is `1px solid var(--color-gray)`, so --color-gray must
      // resolve to a valid <color>, not bare channels like "65% 69% 71%".
      expect(varValue(css, '--border-solid')).toContain('var(--color-gray)')
      const gray = varValue(css, '--color-gray')
      expect(gray).toBeDefined()
      expect(looksLikeColor(gray as string)).toBe(true)
    })

    it('keeps colors usable by a gradient that references them via var()', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              a: { $value: dtcgColor(0.2, 0.4, 0.8) },
              b: { $value: dtcgColor(0, 0.5, 0.3) },
            },
            gradient: {
              $type: 'gradient',
              g: {
                $value: [
                  { color: '{color.a}', position: 0 },
                  { color: '{color.b}', position: 1 },
                ],
              },
            },
          }),
        ],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const css = getPreflightCSS(preset)
      expect(varValue(css, '--gradient-g')).toContain('var(--color-a)')
      expect(looksLikeColor(varValue(css, '--color-a') as string)).toBe(true)
      expect(looksLikeColor(varValue(css, '--color-b') as string)).toBe(true)
    })

    it('keeps a color usable by a shadow that references it via var()', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              shadowc: { $value: dtcgColor(0, 0, 0, 0.2) },
            },
            shadow: {
              $type: 'shadow',
              md: {
                $value: {
                  offsetX: dtcgDimension(0),
                  offsetY: dtcgDimension(4),
                  blur: dtcgDimension(8),
                  spread: dtcgDimension(0),
                  color: '{color.shadowc}',
                },
              },
            },
          }),
        ],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const css = getPreflightCSS(preset)
      expect(varValue(css, '--shadow-md')).toContain('var(--color-shadowc)')
      expect(looksLikeColor(varValue(css, '--color-shadowc') as string)).toBe(
        true,
      )
    })
  })

  describe('color spaces missing from the classification tables (A2)', () => {
    it('does not wrap a lab-d65 color in rgb()', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              x: { $value: dtcgColorSpace('lab-d65', [50, 20, -30]) },
            },
          }),
        ],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      // preflight holds `lab-d65(...)`, so `rgb(var(--color-x))` -> rgb(lab-d65(...)) invalid.
      expect(colors.x).not.toMatch(/^rgb\(/)
    })

    it('exposes an okhsv color as a plain var (a color() space)', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              x: { $value: dtcgColorSpace('okhsv', [220, 0.5, 0.7]) },
            },
          }),
        ],
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      // terrazzo emits `color(--okhsv ...)`; must be referenced whole, not rgb()-wrapped.
      expect(colors.x).toBe('var(--color-x)')
    })
  })

  describe('legacyHex preflight option (A3)', () => {
    it('does not wrap a hex custom property in rgb()', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              blue: { $value: dtcgColor(0.2, 0.4, 0.8) },
            },
          }),
        ],
        preflights: { legacyHex: true } satisfies PresetTokensPreflights,
        theme: { color: ['color.*'] },
      })
      const css = getPreflightCSS(preset)
      const blue = varValue(css, '--color-blue')
      // terrazzo legacyHex emits a hex custom property...
      expect(blue?.startsWith('#')).toBe(true)
      // ...so the theme value must not wrap it in rgb() (rgb(#36c) is invalid).
      const colors = preset.theme?.color as Record<string, string>
      expect(colors.blue).not.toMatch(/^rgb\(/)
    })
  })

  // ===================================================================
  // GREEN — regression pins (currently-correct behavior)
  // ===================================================================

  describe('named-function color spaces round-trip (B)', () => {
    const cases: Array<[string, number[]]> = [
      ['hsl', [220, 60, 50]],
      ['hwb', [220, 30, 20]],
      ['lab', [50, 20, -30]],
      ['lch', [50, 40, 250]],
      ['oklab', [0.6, 0.1, -0.1]],
      ['oklch', [0.7, 0.15, 250]],
    ]
    it.each(
      cases,
    )('wraps %s as fn(var(--x--c)) over a channel companion', async (space, components) => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              x: { $value: dtcgColorSpace(space, components) },
            },
          }),
        ],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      expect(colors.x).toBe(`${space}(var(--color-x--c))`)
      const css = getPreflightCSS(preset)
      // --color-x keeps the full color (so composites stay valid)...
      expect(looksLikeColor(varValue(css, '--color-x') as string)).toBe(true)
      // ...and --color-x--c holds the bare channels for opacity.
      expect(looksLikeColor(varValue(css, '--color-x--c') as string)).toBe(
        false,
      )
    })
  })

  describe('color() color spaces (B)', () => {
    it.each([
      'display-p3',
      'rec2020',
      'xyz-d65',
      'xyz-d50',
      'srgb-linear',
    ])('exposes %s as plain var() and keeps the color() value', async (space) => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              x: { $value: dtcgColorSpace(space, [0.2, 0.4, 0.8]) },
            },
          }),
        ],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      expect(colors.x).toBe('var(--color-x)')
      expect(varValue(getPreflightCSS(preset), '--color-x')).toMatch(/^color\(/)
    })
  })

  describe('wide-gamut media output (B)', () => {
    it('emits @media (color-gamut) blocks and strips every occurrence consistently', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              hdr: { $value: dtcgColorSpace('oklch', [0.45, 0.31, 266]) },
            },
          }),
        ],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const css = getPreflightCSS(preset)
      expect(css).toContain('@media (color-gamut: p3)')
      // the full color is kept (oklch) at :root and in every gamut override...
      const fullLines = css
        .split('\n')
        .filter((l) => l.includes('--color-hdr:'))
      expect(fullLines.length).toBeGreaterThan(1)
      for (const line of fullLines) {
        expect(line).toMatch(/oklch\(/)
      }
      // ...with a bare-channel companion emitted alongside each occurrence.
      const channelLines = css
        .split('\n')
        .filter((l) => l.includes('--color-hdr--c:'))
      expect(channelLines.length).toBe(fullLines.length)
      for (const line of channelLines) {
        expect(line).not.toMatch(/oklch\(/)
      }
    })
  })

  describe('inline composite colors are not stripped (B)', () => {
    it('leaves an inline shadow color intact', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            shadow: {
              $type: 'shadow',
              s: {
                $value: {
                  offsetX: dtcgDimension(0),
                  offsetY: dtcgDimension(4),
                  blur: dtcgDimension(8),
                  spread: dtcgDimension(0),
                  color: dtcgColor(0, 0, 0, 0.15),
                },
              },
            },
          }),
        ],
        preflights: true,
      })
      const css = getPreflightCSS(preset)
      expect(varValue(css, '--shadow-s')).toMatch(/rgb\(/)
    })
  })

  describe('color alias chains (B)', () => {
    it('resolves an alias chain to consistently-wrapped colors', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            color: {
              $type: 'color',
              base: { $value: dtcgColorSpace('oklch', [0.7, 0.15, 250]) },
              a: { $value: '{color.base}' },
              b: { $value: '{color.a}' },
            },
          }),
        ],
        preflights: true,
        theme: { color: ['color.*'] },
      })
      const colors = preset.theme?.color as Record<string, string>
      expect(colors.base).toBe('oklch(var(--color-base--c))')
      expect(colors.a).toBe('oklch(var(--color-a--c))')
      expect(colors.b).toBe('oklch(var(--color-b--c))')
      const css = getPreflightCSS(preset)
      // alias custom properties point at the referenced color...
      expect(varValue(css, '--color-a')).toBe('var(--color-base)')
      // ...and their channel companions mirror the chain so opacity resolves.
      expect(varValue(css, '--color-a--c')).toBe('var(--color-base--c)')
      expect(varValue(css, '--color-base--c')).toBeDefined()
    })

    it('does not emit channel companions for non-color aliases', async () => {
      const preset = await buildPreset({
        sources: [
          makeSource({
            spacing: {
              $type: 'dimension',
              md: { $value: dtcgDimension(16) },
              lg: { $value: '{spacing.md}' },
            },
          }),
        ],
        preflights: true,
      })
      const css = getPreflightCSS(preset)
      expect(css).toContain('--spacing-lg: var(--spacing-md)')
      expect(css).not.toContain('--spacing-lg--c')
      expect(css).not.toContain('--spacing-md--c')
    })
  })

  // ===================================================================
  // TRIPWIRE — documents current reality; flips when terrazzo is unpinned (A4)
  // ===================================================================

  describe('unsupported color spaces in pinned terrazzo (A4)', () => {
    it('a98-rgb currently throws during preflight serialization (tripwire)', async () => {
      // parse/theme tolerate a98-rgb (a color() space), but terrazzo's colorjs
      // cannot serialize it (still true as of 2.4.0), so preflight generation
      // throws. This tripwire flips if a future terrazzo/colorjs gains a98-rgb
      // serialization, prompting a review of the color classification.
      await expect(
        buildPreset({
          sources: [
            makeSource({
              color: {
                $type: 'color',
                x: { $value: dtcgColorSpace('a98-rgb', [0.2, 0.4, 0.8]) },
              },
            }),
          ],
          preflights: true,
          theme: { color: ['color.*'] },
        }),
      ).rejects.toThrow(/color space/i)
    })
  })
})
