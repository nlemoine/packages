import { describe, expect, it } from 'vitest'
import { aggregate } from '../src/check'

describe('aggregate', () => {
  it('returns full support and no rows for no diagnostics', () => {
    const report = aggregate([])
    expect(report.score).toBe(100)
    expect(report.rows).toHaveLength(0)
  })

  it('groups by feature, keeps the worst level per family, and counts occurrences', () => {
    const report = aggregate([
      {
        title: 'display',
        family: 'outlook',
        support: 'none',
        position: { start: { line: 2, column: 3 } },
      },
      {
        title: 'display',
        family: 'gmail',
        support: 'partial',
        position: { start: { line: 2, column: 3 } },
      },
      // gmail again as 'none' at a new position — none beats partial, and a 2nd occurrence.
      {
        title: 'display',
        family: 'gmail',
        support: 'none',
        position: { start: { line: 5, column: 1 } },
      },
    ])

    const display = report.rows.find((r) => r.title === 'display')
    expect(display).toBeDefined()
    expect(display?.none).toBe(2) // outlook + gmail
    expect(display?.partial).toBe(0) // gmail upgraded partial -> none
    expect(display?.count).toBe(2) // two distinct positions
    expect(display?.supported).toBe((display?.total ?? 0) - 2)
  })

  it('scores by share of supported family-checks', () => {
    // one feature, unsupported in 1 family of 14 -> 13/14 ≈ 93%
    const report = aggregate([
      { title: 'gap', family: 'outlook', support: 'none' },
    ])
    expect(report.score).toBe(93)
  })
})
