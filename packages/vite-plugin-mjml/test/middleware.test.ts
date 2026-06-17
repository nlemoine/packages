import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Logger } from 'vite'
import { describe, expect, it } from 'vitest'
import { createCache } from '../src/cache'
import { createMjmlMiddleware } from '../src/middleware'

const root = fileURLToPath(new URL('.', import.meta.url))
const input = fileURLToPath(
  new URL('./fixtures/emails/**/*.mjml', import.meta.url),
)
const inputBase = fileURLToPath(new URL('./fixtures/emails', import.meta.url))

const logger = {
  info() {},
  warn() {},
  warnOnce() {},
  error() {},
  clearScreen() {},
  hasErrorLogged: () => false,
  hasWarned: false,
} as unknown as Logger

function makeHandler() {
  return createMjmlMiddleware({
    input,
    inputBase,
    root,
    filePath: inputBase,
    mjmlOptions: {},
    cache: createCache(),
    logger,
    editorUrl: 'vscode://file/%f',
    base: '/',
  })
}

interface MockRes {
  statusCode: number
  headers: Record<string, string>
  body: string
  setHeader(key: string, value: string): void
  end(chunk?: string): void
}

function call(url: string): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value
    },
    end(chunk) {
      if (chunk !== undefined) this.body += chunk
    },
  }
  makeHandler()({ url } as IncomingMessage, res as unknown as ServerResponse)
  return res
}

describe('mjml middleware', () => {
  it('lists files, excluding partials', () => {
    const files = JSON.parse(call('/@api/files').body) as string[]
    expect(files).toContain('welcome.mjml')
    expect(files.some((f) => f.endsWith('confirm.mjml'))).toBe(true)
    expect(files.some((f) => f.includes('_header'))).toBe(false)
  })

  it('serves raw source', () => {
    const res = call(`/@api/source/${encodeURIComponent('welcome.mjml')}`)
    expect(res.headers['content-type']).toBe('text/plain')
    expect(res.body).toContain('<mjml>')
  })

  it('serves compiled html', () => {
    const res = call(`/@api/compile/${encodeURIComponent('welcome.mjml')}`)
    expect(res.headers['content-type']).toBe('text/html')
    expect(res.body).toContain('Welcome')
  })

  it('forbids files outside the glob', () => {
    expect(call('/@api/source/nope.mjml').statusCode).toBe(403)
    expect(
      call(`/@api/compile/${encodeURIComponent('nope.mjml')}`).statusCode,
    ).toBe(403)
  })

  it('returns the absolute path for the editor', () => {
    const res = call(`/@api/path/${encodeURIComponent('welcome.mjml')}`)
    expect(res.body).toContain('welcome.mjml')
  })

  it('renders the shell with preview data and asset links', () => {
    const res = call('/')
    expect(res.headers['content-type']).toBe('text/html')
    expect(res.body).toContain('__MJML_PREVIEW_DATA__')
    expect(res.body).toContain('/__mjml/@client/main.js')
    expect(res.body).toContain('/__mjml/@client/main.css')
    expect(res.body).toContain('@vite/client')
  })
})
