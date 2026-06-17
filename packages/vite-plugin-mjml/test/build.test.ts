import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createServer } from 'vite'
import { describe, expect, it } from 'vitest'
import mjml from '../src/index'

const VALID =
  '<mjml><mj-body><mj-section><mj-column><mj-text>__T__</mj-text></mj-column></mj-section></mj-body></mjml>'
const PARTIAL =
  '<mj-section><mj-column><mj-text>P</mj-text></mj-column></mj-section>'

describe('build', () => {
  it('emits compiled HTML to the output path and skips partials', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mjml-build-'))
    mkdirSync(join(root, 'emails', 'nested'), { recursive: true })
    writeFileSync(
      join(root, 'emails', 'welcome.mjml'),
      VALID.replace('__T__', 'Hi'),
    )
    writeFileSync(join(root, 'emails', '_partial.mjml'), PARTIAL)
    writeFileSync(
      join(root, 'emails', 'nested', 'confirm.mjml'),
      VALID.replace('__T__', 'Bye'),
    )
    writeFileSync(join(root, 'entry.js'), 'export default 1')

    await build({
      root,
      logLevel: 'silent',
      build: {
        outDir: join(root, 'dist'),
        emptyOutDir: true,
        rollupOptions: { input: join(root, 'entry.js') },
      },
      plugins: [mjml({ input: 'emails/**/*.mjml' })],
    })

    const welcome = join(root, 'dist', 'emails', 'welcome.html')
    const confirm = join(root, 'dist', 'emails', 'nested', 'confirm.html')

    expect(existsSync(welcome)).toBe(true)
    expect(readFileSync(welcome, 'utf-8')).toContain('Hi')
    expect(existsSync(confirm)).toBe(true)
    expect(readFileSync(confirm, 'utf-8')).toContain('Bye')
    expect(existsSync(join(root, 'dist', 'emails', '_partial.html'))).toBe(
      false,
    )
  }, 30000)

  it('does not write to disk when only a dev server runs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mjml-serve-'))
    mkdirSync(join(root, 'emails'), { recursive: true })
    writeFileSync(
      join(root, 'emails', 'welcome.mjml'),
      VALID.replace('__T__', 'Hi'),
    )

    const server = await createServer({
      root,
      logLevel: 'silent',
      server: { port: 0 },
      plugins: [mjml({ input: 'emails/**/*.mjml' })],
    })
    await server.listen()
    await server.close()

    // closeBundle also fires when a dev server closes; it must not emit in serve mode.
    expect(existsSync(join(root, 'dist'))).toBe(false)
  }, 30000)
})
