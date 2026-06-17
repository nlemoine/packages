import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compileContent, compileFile } from '../src/compiler'

const emailsDir = fileURLToPath(new URL('./fixtures/emails/', import.meta.url))

describe('compileFile', () => {
  it('compiles MJML to HTML', () => {
    const result = compileFile(`${emailsDir}welcome.mjml`)
    expect(result.html).toContain('<html')
    expect(result.html).toContain('Welcome')
    expect(result.errors).toEqual([])
  })

  it('resolves mj-include relative to the file', () => {
    const result = compileFile(`${emailsDir}welcome.mjml`)
    expect(result.html).toContain('Header')
  })

  it('reports a compilation time', () => {
    const result = compileFile(`${emailsDir}welcome.mjml`)
    expect(typeof result.compilationTime).toBe('number')
  })
})

describe('compileContent', () => {
  it('collects validation errors under the soft level', () => {
    // mj-column outside mj-section is invalid.
    const result = compileContent(
      '<mjml><mj-body><mj-column><mj-text>x</mj-text></mj-column></mj-body></mjml>',
    )
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('accepts the minify option', () => {
    const src =
      '<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>'
    const result = compileContent(src, { minify: true })
    expect(result.html).toContain('<html')
  })
})
