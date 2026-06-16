import { createGenerator } from '@unocss/core'
import presetMini from '@unocss/preset-mini'
import { describe, expect, it } from 'vitest'
import { presetTokens } from '../src/index'

// End-to-end checks against a real UnoCSS generator (presetMini supplies the
// color utilities). These verify that what the preset emits actually produces
// valid opacity CSS, for both opacity modes.

const COLOR_TOKENS = {
  color: {
    $type: 'color',
    brand: {
      primary: {
        $value: { colorSpace: 'srgb', components: [0.2, 0.4, 0.8], alpha: 1 },
      },
    },
  },
}

function makeSource(tokens: Record<string, unknown>, filename = 'tokens.json') {
  return { filename, src: JSON.stringify(tokens) }
}

async function generate(
  opacity: 'channels' | 'color-mix',
  utilities: string,
  extra: Parameters<typeof presetTokens>[0] = {},
): Promise<string> {
  const preset = await presetTokens({
    sources: [makeSource(COLOR_TOKENS)],
    theme: { color: ['color.*'] },
    // presetMini reads `theme.colors`; expose ours there too.
    themeAliases: { color: 'colors' },
    opacity,
    ...extra,
  })
  const uno = await createGenerator({ presets: [presetMini(), preset] })
  return (await uno.generate(utilities)).css
}

describe('UnoCSS integration (real preset-mini generator)', () => {
  describe('channels mode', () => {
    it('injects alpha into fn(var(--x--c)) for an opacity modifier', async () => {
      const css = await generate('channels', 'bg-brand-primary/50')
      expect(css).toContain('rgb(var(--color-brand-primary--c) / 0.5)')
    })

    it('uses the opacity variable when no modifier is given', async () => {
      const css = await generate('channels', 'bg-brand-primary')
      expect(css).toContain(
        'rgb(var(--color-brand-primary--c) / var(--un-bg-opacity))',
      )
    })
  })

  describe('color-mix mode', () => {
    it('substitutes <alpha-value> inside color-mix() for an opacity modifier', async () => {
      const css = await generate('color-mix', 'bg-brand-primary/50')
      expect(css).toContain(
        'color-mix(in oklab, var(--color-brand-primary) calc(0.5 * 100%), transparent)',
      )
    })

    it('substitutes <alpha-value> with the opacity variable when no modifier', async () => {
      const css = await generate('color-mix', 'bg-brand-primary')
      expect(css).toContain(
        'color-mix(in oklab, var(--color-brand-primary) calc(var(--un-bg-opacity) * 100%), transparent)',
      )
    })
  })

  it('A1: the same color is composite-safe (full --x) and opacity-capable (--x--c)', async () => {
    // With preflights on, --color-brand-primary stays a full color (so a border
    // or shadow referencing it via var() is valid) while the utility resolves
    // through the channel companion.
    const css = await generate('channels', 'bg-brand-primary/50', {
      preflights: true,
    })
    expect(css).toMatch(/--color-brand-primary:\s*rgb\(/)
    expect(css).toContain('rgb(var(--color-brand-primary--c) / 0.5)')
  })
})
