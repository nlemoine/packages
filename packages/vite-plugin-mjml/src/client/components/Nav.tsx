import type { ComponentChildren } from 'preact'
import type { Device, ViewMode } from '../App'

function Icon({
  size = 14,
  children,
}: {
  size?: number
  children: ComponentChildren
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {children}
    </svg>
  )
}

function ViewIcon({ id }: { id: ViewMode }) {
  if (id === 'preview') {
    return (
      <Icon>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </Icon>
    )
  }
  if (id === 'source') {
    return (
      <Icon>
        <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
      </Icon>
    )
  }
  return (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9.4 12 2 2 3.4-3.4" />
    </Icon>
  )
}

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'source', label: 'Source' },
  { id: 'check', label: 'Check' },
]

const SEG_BASE =
  'flex items-center gap-1.5 px-[13px] py-[7px] rounded-md text-[13px] font-semibold leading-none whitespace-nowrap transition-all duration-150'
const VP_BASE =
  'flex items-center gap-[7px] px-[14px] text-[13px] font-semibold leading-none whitespace-nowrap transition-all duration-150'

export function Nav({
  title,
  view,
  onSetView,
  showDesktop,
  showMobile,
  onToggleDesktop,
  onToggleMobile,
  devices,
  deviceIdx,
  onSetDevice,
  onEdit,
}: {
  title: string
  view: ViewMode
  onSetView: (view: ViewMode) => void
  showDesktop: boolean
  showMobile: boolean
  onToggleDesktop: () => void
  onToggleMobile: () => void
  devices: Device[]
  deviceIdx: number
  onSetDevice: (index: number) => void
  onEdit: () => void
}) {
  const isPreview = view === 'preview'

  return (
    <div class="shrink-0">
      <header class="flex items-center justify-between gap-[18px] px-[22px] py-[14px] border-b border-line bg-panel">
        <div class="text-sm font-semibold text-fg-strong truncate">{title}</div>

        <div class="flex items-center gap-4 shrink-0">
          {/* View — exclusive segmented switch */}
          <div class="flex items-center gap-0.5 p-[3px] rounded-[9px] bg-base">
            {VIEW_TABS.map((tab) => {
              const selected = view === tab.id
              return (
                <button
                  type="button"
                  key={tab.id}
                  aria-pressed={selected}
                  onClick={() => onSetView(tab.id)}
                  class={`${SEG_BASE} ${selected ? 'bg-card text-accent shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-muted hover:text-fg-strong'}`}
                >
                  <ViewIcon id={tab.id} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Viewport — independent toggles, dim outside Preview */}
          <div
            class={`flex items-stretch h-[34px] rounded-[9px] border border-line overflow-hidden bg-card transition-opacity duration-150 ${
              isPreview ? '' : 'opacity-40 pointer-events-none'
            }`}
          >
            <button
              type="button"
              aria-pressed={showDesktop}
              onClick={onToggleDesktop}
              title="Show desktop preview"
              class={`${VP_BASE} ${showDesktop ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg-strong'}`}
            >
              <Icon size={15}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </Icon>
              Desktop
            </button>
            <div class="w-px bg-line" />
            <button
              type="button"
              aria-pressed={showMobile}
              onClick={onToggleMobile}
              title="Show mobile preview"
              class={`${VP_BASE} ${showMobile ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg-strong'}`}
            >
              <Icon size={15}>
                <rect x="6" y="2" width="12" height="20" rx="2.5" />
                <path d="M11 18h2" />
              </Icon>
              Mobile
            </button>
          </div>

          <div class="w-px h-[30px] bg-line self-center" />

          {/* Action */}
          <button
            type="button"
            onClick={onEdit}
            title="Open this template in your editor"
            class="flex items-center justify-center gap-1.5 min-w-[104px] px-4 py-2 rounded-[7px] text-[13px] font-semibold whitespace-nowrap text-on-accent bg-accent shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 hover:brightness-105"
          >
            <Icon>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </Icon>
            Edit
          </button>
        </div>
      </header>

      {/* Inline device strip — only in Preview; pills dim when Mobile is off */}
      {isPreview && (
        <div class="flex items-center gap-3 px-[22px] py-[10px] border-b border-line bg-panel">
          <div
            class={`flex flex-wrap flex-1 justify-end gap-2 transition-opacity duration-150 ${
              showMobile ? '' : 'opacity-45 pointer-events-none'
            }`}
          >
            {devices.map((device, i) => {
              const selected = i === deviceIdx
              return (
                <button
                  type="button"
                  key={device.name}
                  aria-pressed={selected}
                  onClick={() => onSetDevice(i)}
                  class={`flex items-baseline gap-1.5 px-[11px] py-1.5 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-all duration-150 ${
                    selected
                      ? 'border-transparent bg-accent-soft text-accent'
                      : 'border-line bg-card text-muted hover:text-fg-strong'
                  }`}
                >
                  {device.name}
                  <span class="font-medium opacity-70">{device.px}px</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
