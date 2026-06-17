import { describe, expect, it } from 'vitest'
import { runChecks } from '../src/client/checks'

describe('runChecks', () => {
  it('passes a small, accessible email', () => {
    const html = '<html lang="en"><body><img src="x" alt="logo"></body></html>'
    expect(runChecks(html).every((c) => c.status === 'pass')).toBe(true)
  })

  it('fails when over Gmail’s 102KB clip limit', () => {
    const html = `<html lang="en"><body>${'x'.repeat(110 * 1024)}</body></html>`
    expect(runChecks(html).find((c) => c.id === 'size')?.status).toBe('fail')
  })

  it('warns on missing alt text and missing lang', () => {
    const byId = Object.fromEntries(
      runChecks(
        '<html><body><img src="a"><img src="b" alt="ok"></body></html>',
      ).map((c) => [c.id, c]),
    )
    expect(byId.alt.status).toBe('warn')
    expect(byId.alt.detail).toContain('1 of 2')
    expect(byId.lang.status).toBe('warn')
  })
})
