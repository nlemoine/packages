import { describe, expect, it } from 'vitest'
import { createCache } from '../src/cache'

describe('createCache', () => {
  it('stores and retrieves entries with a timestamp', () => {
    const c = createCache()
    expect(c.has('/a')).toBe(false)
    c.set('/a', { html: 'x', errors: [], compilationTime: 1, mtime: '10' })
    expect(c.has('/a')).toBe(true)
    expect(c.get('/a')?.html).toBe('x')
    expect(c.get('/a')?.mtime).toBe('10')
    expect(typeof c.get('/a')?.compiledAt).toBe('number')
  })

  it('invalidates a single entry', () => {
    const c = createCache()
    c.set('/a', { html: 'x', errors: [], compilationTime: 1 })
    expect(c.invalidate('/a')).toBe(true)
    expect(c.invalidate('/a')).toBe(false)
    expect(c.has('/a')).toBe(false)
  })

  it('clears every entry', () => {
    const c = createCache()
    c.set('/a', { html: 'x', errors: [], compilationTime: 1 })
    c.set('/b', { html: 'y', errors: [], compilationTime: 1 })
    c.clear()
    expect(c.has('/a')).toBe(false)
    expect(c.has('/b')).toBe(false)
  })
})
