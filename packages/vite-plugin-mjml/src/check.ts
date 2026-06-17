import type { CheckReport, FeatureRow } from './types'

// Client families in the caniemail dataset — the denominator for support bars.
const FAMILIES = [
  'apple-mail',
  'gmail',
  'orange',
  'outlook',
  'yahoo',
  'aol',
  'samsung-email',
  'sfr',
  'thunderbird',
  'protonmail',
  'hey',
  'mail-ru',
  'fastmail',
  'laposte',
]
const TOTAL_FAMILIES = FAMILIES.length

interface Diagnostic {
  title: string
  family: string
  support: 'full' | 'partial' | 'none'
  position?: { start: { line: number; column: number } }
}

/**
 * Aggregate per-(feature, client) diagnostics into Mailpit-style per-feature
 * support rows: how many client families fully/partially/don't support each
 * feature the email uses, plus an overall support score. Pure + unit-tested.
 */
export function aggregate(diagnostics: Diagnostic[]): CheckReport {
  const features = new Map<
    string,
    { fams: Map<string, 'partial' | 'none'>; positions: Set<string> }
  >()

  for (const d of diagnostics) {
    if (d.support === 'full') continue
    let feature = features.get(d.title)
    if (!feature) {
      feature = { fams: new Map(), positions: new Set() }
      features.set(d.title, feature)
    }
    // Keep the worst level seen for a family (none beats partial).
    if (feature.fams.get(d.family) !== 'none') {
      feature.fams.set(d.family, d.support === 'none' ? 'none' : 'partial')
    }
    if (d.position)
      feature.positions.add(
        `${d.position.start.line}:${d.position.start.column}`,
      )
  }

  let supported = 0
  let partial = 0
  let none = 0

  const rows: FeatureRow[] = [...features.entries()]
    .map(([title, feature]) => {
      let n = 0
      let p = 0
      for (const level of feature.fams.values()) {
        if (level === 'none') n++
        else p++
      }
      const ok = TOTAL_FAMILIES - n - p
      supported += ok
      partial += p
      none += n
      return {
        title,
        count: feature.positions.size,
        supported: ok,
        partial: p,
        none: n,
        total: TOTAL_FAMILIES,
      }
    })
    .sort((a, b) => a.supported - b.supported || b.count - a.count)

  const total = supported + partial + none
  const score = total === 0 ? 100 : Math.round((supported / total) * 100)

  return { score, supported, partial, none, familyCount: TOTAL_FAMILIES, rows }
}

/** Run the email-client compatibility analysis on compiled HTML. */
export async function analyze(html: string): Promise<CheckReport> {
  const { lint } = await import('@email-lint/core')
  const result = lint(html)
  return aggregate(result.diagnostics as Diagnostic[])
}
