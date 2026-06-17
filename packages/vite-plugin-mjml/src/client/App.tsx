import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import type { CheckReport, PreviewData } from '../types'
import { Nav } from './components/Nav'
import { Preview } from './components/Preview'
import { Shell } from './components/Shell'
import { Sidebar } from './components/Sidebar'
import { setupHmr } from './hmr'

export type View = 'desktop' | 'mobile' | 'source' | 'check'

const base = window.__MJML_PREVIEW_DATA__?.base ?? '/'
const apiBase = `${base}__mjml`

// Desktop + Mobile are cumulative panes; Source and Check are exclusive tabs.
const EXCLUSIVE = new Set<View>(['source', 'check'])

const files = signal<string[]>([])
const currentFile = signal<string | null>(null)
const html = signal('')
const source = signal('')
const activeViews = signal<Set<View>>(new Set(['desktop', 'mobile']))
const mobileWidth = signal(375)
const editorUrl = signal('vscode://file/%f')
const checkReport = signal<CheckReport | null>(null)
const checkLoading = signal(false)
const initialized = signal(false)

// Remember the preview panes while an exclusive tab is shown.
let lastPreviewViews: Set<View> = new Set(['desktop', 'mobile'])

async function loadCheck(file: string | null): Promise<void> {
  if (!file) return
  checkLoading.value = true
  try {
    const res = await fetch(`${apiBase}/@api/check/${encodeURIComponent(file)}`)
    checkReport.value = (await res.json()) as CheckReport
  } catch (e) {
    console.error('Failed to load check:', e)
    checkReport.value = null
  } finally {
    checkLoading.value = false
  }
}

function toggleView(view: View): void {
  const current = activeViews.value
  const inExclusive = current.has('source') || current.has('check')

  if (EXCLUSIVE.has(view)) {
    if (current.has(view)) {
      activeViews.value = new Set(lastPreviewViews) // toggling the tab off restores the panes
    } else {
      if (!inExclusive) lastPreviewViews = new Set(current)
      activeViews.value = new Set([view])
      if (view === 'check') loadCheck(currentFile.value)
    }
    return
  }

  // Desktop / Mobile are cumulative; selecting one leaves an exclusive tab.
  if (inExclusive) {
    activeViews.value = new Set([view])
    return
  }
  const next = new Set(current)
  if (next.has(view)) {
    if (next.size > 1) next.delete(view) // keep at least one pane visible
  } else {
    next.add(view)
  }
  activeViews.value = next
}

async function loadFile(file: string): Promise<void> {
  currentFile.value = file
  try {
    const [htmlRes, sourceRes] = await Promise.all([
      fetch(`${apiBase}/@api/compile/${encodeURIComponent(file)}`),
      fetch(`${apiBase}/@api/source/${encodeURIComponent(file)}`),
    ])
    html.value = await htmlRes.text()
    source.value = await sourceRes.text()
    history.pushState(null, '', `${apiBase}/${encodeURIComponent(file)}`)
    if (activeViews.value.has('check')) loadCheck(file)
  } catch (e) {
    console.error('Failed to load file:', e)
  }
}

function openInEditor(): void {
  const file = currentFile.value
  if (!file) return
  fetch(`${apiBase}/@api/path/${encodeURIComponent(file)}`)
    .then((r) => r.text())
    .then((path) => {
      window.open(editorUrl.value.replace(/%f/g, path), '_blank')
    })
    .catch(() => {})
}

export function App(props: Partial<PreviewData>) {
  useEffect(() => {
    if (initialized.value) return
    if (props.files) files.value = props.files
    if (props.currentFile) currentFile.value = props.currentFile
    if (props.html) html.value = props.html
    if (props.source) source.value = props.source
    if (props.editorUrl) editorUrl.value = props.editorUrl
    initialized.value = true

    setupHmr((data) => {
      const file = currentFile.value
      if (file && (data.partial || data.file === file)) {
        loadFile(file)
      }
    })
  }, [])

  const isHome = !currentFile.value

  return (
    <Shell>
      <Sidebar
        files={files.value}
        currentFile={currentFile.value}
        onSelectFile={loadFile}
      />
      <main class="flex-1 flex flex-col bg-base overflow-hidden">
        {!isHome && (
          <Nav
            title={currentFile.value ?? ''}
            active={activeViews.value}
            onToggle={toggleView}
            onEdit={openInEditor}
            mobileWidth={mobileWidth.value}
            onMobileWidthChange={(w) => {
              mobileWidth.value = w
            }}
          />
        )}
        <Preview
          isHome={isHome}
          files={files.value}
          active={activeViews.value}
          html={html.value}
          source={source.value}
          mobileWidth={mobileWidth.value}
          report={checkReport.value}
          reportLoading={checkLoading.value}
        />
      </main>
    </Shell>
  )
}
