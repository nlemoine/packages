import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import type { CheckReport, PreviewData } from '../types'
import { Nav } from './components/Nav'
import { Preview } from './components/Preview'
import { Shell } from './components/Shell'
import { Sidebar } from './components/Sidebar'
import { setupHmr } from './hmr'

export type ViewMode = 'preview' | 'source' | 'check'

export interface Device {
  name: string
  px: number
  h: number
}

export const DEVICES: Device[] = [
  { name: 'iPhone SE', px: 375, h: 667 },
  { name: 'iPhone 14', px: 390, h: 844 },
  { name: 'iPhone 14 Pro Max', px: 430, h: 932 },
  { name: 'Pixel 7', px: 412, h: 915 },
  { name: 'Galaxy S22', px: 360, h: 800 },
]

const base = window.__MJML_PREVIEW_DATA__?.base ?? '/'
const apiBase = `${base}__mjml`

const files = signal<string[]>([])
const currentFile = signal<string | null>(null)
const html = signal('')
const source = signal('')
// View (what you look at) is independent from Viewport (how the preview is sized).
const view = signal<ViewMode>('preview')
const showDesktop = signal(true)
const showMobile = signal(true)
const deviceIdx = signal(0)
const editorUrl = signal('vscode://file/%f')
const checkReport = signal<CheckReport | null>(null)
const checkLoading = signal(false)
const initialized = signal(false)

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

function setView(next: ViewMode): void {
  view.value = next
  if (next === 'check') loadCheck(currentFile.value)
}

// Viewport toggles are independent, but at least one must stay on.
function toggleDesktop(): void {
  if (showDesktop.value && !showMobile.value) return
  showDesktop.value = !showDesktop.value
}

function toggleMobile(): void {
  if (showMobile.value && !showDesktop.value) return
  showMobile.value = !showMobile.value
}

function setDevice(index: number): void {
  deviceIdx.value = index
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
    if (view.value === 'check') loadCheck(file)
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
  const device = DEVICES[deviceIdx.value]

  return (
    <Shell>
      <Sidebar
        files={files.value}
        currentFile={currentFile.value}
        onSelectFile={loadFile}
      />
      <main class="flex-1 flex flex-col bg-base overflow-hidden min-w-0">
        {!isHome && (
          <Nav
            title={currentFile.value ?? ''}
            view={view.value}
            onSetView={setView}
            showDesktop={showDesktop.value}
            showMobile={showMobile.value}
            onToggleDesktop={toggleDesktop}
            onToggleMobile={toggleMobile}
            devices={DEVICES}
            deviceIdx={deviceIdx.value}
            onSetDevice={setDevice}
            onEdit={openInEditor}
          />
        )}
        <Preview
          isHome={isHome}
          files={files.value}
          view={view.value}
          showDesktop={showDesktop.value}
          showMobile={showMobile.value}
          deviceWidth={device.px}
          deviceHeight={device.h}
          html={html.value}
          source={source.value}
          report={checkReport.value}
          reportLoading={checkLoading.value}
        />
      </main>
    </Shell>
  )
}
