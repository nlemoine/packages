import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-php-extras'
import { useEffect, useMemo, useRef } from 'preact/hooks'
import type { CheckReport, FeatureRow } from '../../types'
import type { View } from '../App'
import { type CheckItem, runChecks } from '../checks'
import { Logo } from './Logo'

const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const RED = '#ef4444'

function HomeView({ files }: { files: string[] }) {
  if (files.length === 0) {
    return (
      <div class="flex-1 flex items-center justify-center bg-base">
        <div class="text-center p-8 max-w-md">
          <div class="text-6xl mb-6">
            <Logo />
          </div>
          <h2 class="text-xl font-semibold text-fg-strong mb-4">
            No MJML templates found
          </h2>
          <p class="text-muted">
            Make sure your{' '}
            <code class="bg-subtle px-2 py-1 rounded text-accent text-sm">
              input
            </code>{' '}
            glob pattern matches your MJML files.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div class="flex-1 flex items-center justify-center bg-base">
      <div class="text-center p-8 max-w-md">
        <div class="text-6xl mb-6">
          <Logo />
        </div>
        <p class="text-muted mb-6">
          Select a template from the sidebar to preview it.
        </p>
        <div class="inline-flex items-center gap-2 px-4 py-2 bg-subtle rounded-full text-sm text-fg">
          <span class="w-2 h-2 bg-accent rounded-full" />
          {files.length} template{files.length !== 1 ? 's' : ''} available
        </div>
      </div>
    </div>
  )
}

/** A single viewport pane (fluid for desktop, fixed-width for mobile). */
function Pane({
  label,
  html,
  width,
  isMobile,
}: {
  label: string
  html: string
  width?: number
  isMobile?: boolean
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !isMobile) return

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument
        if (!doc) return
        const style = doc.createElement('style')
        style.innerHTML =
          'table { overflow-wrap: anywhere; width: 100% !important; }'
        doc.head.appendChild(style)
      } catch {
        // Cross-origin iframe, ignore.
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [html, isMobile])

  return (
    <div
      class={`flex flex-col h-full ${width ? 'shrink-0' : 'flex-1 min-w-0'}`}
      style={width ? { width: `${width}px` } : undefined}
    >
      <div class="shrink-0 mb-2 px-0.5 text-xs font-medium text-muted">
        {label}
      </div>
      <div class="flex-1 min-h-0 bg-white rounded-lg shadow-2xl overflow-hidden">
        <iframe
          ref={iframeRef}
          title={label}
          srcdoc={html}
          class="w-full h-full bg-white"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  )
}

function SourceView({ source }: { source: string }) {
  const highlighted = useMemo(() => {
    if (!source) return ''
    // PHP grammar handles embedded markup (MJML/HTML) plus PHP tags.
    return Prism.highlight(source, Prism.languages.php, 'php')
  }, [source])

  return (
    <div class="flex-1 overflow-auto bg-code-bg">
      <pre class="p-6 text-sm leading-relaxed font-mono whitespace-pre-wrap">
        <code
          class="language-php"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  )
}

function Donut({ report }: { report: CheckReport }) {
  const total = report.supported + report.partial + report.none || 1
  const C = 2 * Math.PI * 42
  const seg = (n: number) => (n / total) * C
  const sup = seg(report.supported)
  const par = seg(report.partial)
  const non = seg(report.none)
  return (
    <div class="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" class="w-28 h-28 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--line)"
          stroke-width="9"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={GREEN}
          stroke-width="9"
          stroke-dasharray={`${sup} ${C}`}
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={AMBER}
          stroke-width="9"
          stroke-dasharray={`${par} ${C}`}
          stroke-dashoffset={`${-sup}`}
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={RED}
          stroke-width="9"
          stroke-dasharray={`${non} ${C}`}
          stroke-dashoffset={`${-(sup + par)}`}
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-2xl font-bold text-fg-strong">{report.score}%</span>
        <span class="text-[10px] text-muted -mt-1">support</span>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span class="inline-flex items-center gap-1.5 text-xs text-muted">
      <span class="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}

function FeatureBar({ row }: { row: FeatureRow }) {
  const pct = (n: number) => `${(n / row.total) * 100}%`
  return (
    <div class="flex items-center gap-3 py-2">
      <div class="w-44 shrink-0 truncate text-sm text-fg" title={row.title}>
        {row.title}
        {row.count > 0 && <span class="text-muted"> ×{row.count}</span>}
      </div>
      <div class="flex-1 flex h-2.5 rounded-full overflow-hidden bg-line">
        {row.supported > 0 && (
          <div style={{ width: pct(row.supported), background: GREEN }} />
        )}
        {row.partial > 0 && (
          <div style={{ width: pct(row.partial), background: AMBER }} />
        )}
        {row.none > 0 && (
          <div style={{ width: pct(row.none), background: RED }} />
        )}
      </div>
      <div class="w-10 shrink-0 text-right text-xs text-muted">
        {Math.round((row.supported / row.total) * 100)}%
      </div>
    </div>
  )
}

function ExtraRow({ item }: { item: CheckItem }) {
  const color =
    item.status === 'pass' ? GREEN : item.status === 'warn' ? AMBER : RED
  return (
    <li class="flex items-start gap-3 p-3 rounded-lg bg-panel border border-line">
      <span
        class="mt-1.5 w-2 h-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <div class="min-w-0">
        <div class="text-sm font-medium text-fg-strong">{item.label}</div>
        <div class="text-sm text-muted mt-0.5">{item.detail}</div>
      </div>
    </li>
  )
}

function CheckView({
  report,
  loading,
  html,
}: {
  report: CheckReport | null
  loading: boolean
  html: string
}) {
  const extras = useMemo(() => runChecks(html), [html])

  return (
    <div class="flex-1 overflow-auto bg-base p-8">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-lg font-semibold text-fg-strong mb-1">
          Email client compatibility
        </h2>
        <p class="text-sm text-muted mb-6">
          Support across {report?.familyCount ?? 14} client families
          (caniemail.com). MJML handles most quirks with fallbacks, so treat
          partial/limited support as informational.
        </p>

        <ul class="flex flex-col gap-2 mb-8">
          {extras.map((item) => (
            <ExtraRow key={item.id} item={item} />
          ))}
        </ul>

        {loading && !report ? (
          <div class="text-sm text-muted">Analyzing…</div>
        ) : !report ? (
          <div class="text-sm text-muted">Compatibility check unavailable.</div>
        ) : report.rows.length === 0 ? (
          <div class="text-sm text-muted">
            Every feature you used is widely supported. 🎉
          </div>
        ) : (
          <div>
            <div class="flex items-center gap-6 mb-6">
              <Donut report={report} />
              <div class="text-sm text-muted">
                <div>
                  <span class="font-medium text-fg-strong">
                    {report.rows.length}
                  </span>{' '}
                  features with limited client support.
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  <Legend color={GREEN} label="supported" />
                  <Legend color={AMBER} label="partial" />
                  <Legend color={RED} label="not supported" />
                </div>
              </div>
            </div>
            <div class="flex flex-col divide-y divide-line">
              {report.rows.map((row) => (
                <FeatureBar key={row.title} row={row} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Preview({
  isHome,
  files,
  active,
  html,
  source,
  mobileWidth,
  report,
  reportLoading,
}: {
  isHome: boolean
  files: string[]
  active: Set<View>
  html: string
  source: string
  mobileWidth: number
  report: CheckReport | null
  reportLoading: boolean
}) {
  if (isHome) {
    return <HomeView files={files} />
  }
  if (active.has('source')) {
    return <SourceView source={source} />
  }
  if (active.has('check')) {
    return <CheckView report={report} loading={reportLoading} html={html} />
  }
  return (
    <div class="flex-1 flex justify-center gap-6 overflow-auto bg-base p-6">
      {active.has('desktop') && <Pane label="Desktop" html={html} />}
      {active.has('mobile') && (
        <Pane
          label={`Mobile · ${mobileWidth}px`}
          html={html}
          width={mobileWidth}
          isMobile
        />
      )}
    </div>
  )
}
