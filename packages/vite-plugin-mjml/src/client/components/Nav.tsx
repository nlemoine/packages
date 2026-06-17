import type { View } from '../App'

const PREVIEW_VIEWS: {
  id: 'desktop' | 'mobile'
  label: string
  icon: string
}[] = [
  {
    id: 'desktop',
    label: 'Desktop',
    icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    icon: 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3',
  },
]

const SOURCE_ICON =
  'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5'

const CHECK_ICON =
  'M9 12.75 11.25 15 15 9.75m-3-7.036A11.96 11.96 0 0 1 3.6 6 12 12 0 0 0 3 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15a11.96 11.96 0 0 1-8.25-3.29Z'

const TABS: { id: 'source' | 'check'; label: string; icon: string }[] = [
  { id: 'source', label: 'Source', icon: SOURCE_ICON },
  { id: 'check', label: 'Check', icon: CHECK_ICON },
]

const MOBILE_SIZES: { name: string; width: number }[] = [
  { name: 'iPhone SE', width: 375 },
  { name: 'iPhone 14', width: 390 },
  { name: 'iPhone 14 Pro Max', width: 430 },
  { name: 'Pixel 7', width: 412 },
  { name: 'Galaxy S22', width: 360 },
]

function ViewIcon({ path }: { path: string }) {
  return (
    <svg
      class="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path d={path} stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg
      class="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function MobileSubBar({
  mobileWidth,
  onMobileWidthChange,
}: {
  mobileWidth: number
  onMobileWidthChange: (width: number) => void
}) {
  return (
    <div class="h-10 shrink-0 border-b border-line flex items-center gap-2 px-5 bg-base overflow-x-auto">
      {MOBILE_SIZES.map((size) => (
        <button
          type="button"
          key={size.width}
          class={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full whitespace-nowrap transition-all duration-150 ${
            mobileWidth === size.width
              ? 'bg-accent text-on-accent font-medium'
              : 'text-muted hover:text-fg-strong hover:bg-subtle border border-line'
          }`}
          onClick={() => onMobileWidthChange(size.width)}
        >
          {size.name}
          <span class="text-[10px] opacity-70">{size.width}px</span>
        </button>
      ))}
    </div>
  )
}

export function Nav({
  title,
  active,
  onToggle,
  onEdit,
  mobileWidth,
  onMobileWidthChange,
}: {
  title: string
  active: Set<View>
  onToggle: (view: View) => void
  onEdit: () => void
  mobileWidth: number
  onMobileWidthChange: (width: number) => void
}) {
  return (
    <div class="shrink-0">
      <header class="h-14 border-b border-line flex items-center justify-between px-5 bg-panel">
        <div class="flex items-center gap-4 min-w-0">
          <h2 class="font-medium text-fg-strong truncate text-sm">{title}</h2>
        </div>

        <div class="flex items-center gap-3">
          {/* Desktop + Mobile are cumulative (show one or both side by side). */}
          <div class="flex rounded-lg overflow-hidden bg-base p-1 gap-1">
            {PREVIEW_VIEWS.map((view) => {
              const pressed = active.has(view.id)
              return (
                <button
                  type="button"
                  key={view.id}
                  aria-pressed={pressed}
                  class={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all duration-150 ${
                    pressed
                      ? 'bg-accent text-on-accent font-medium'
                      : 'text-muted hover:text-fg-strong hover:bg-subtle'
                  }`}
                  onClick={() => onToggle(view.id)}
                  title={`Toggle ${view.label}`}
                >
                  <ViewIcon path={view.icon} />
                  <span class="hidden sm:inline">{view.label}</span>
                </button>
              )
            })}
          </div>

          {/* Source and Check are exclusive tabs. */}
          {TABS.map((tab) => {
            const pressed = active.has(tab.id)
            return (
              <button
                type="button"
                key={tab.id}
                aria-pressed={pressed}
                class={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all duration-150 ${
                  pressed
                    ? 'bg-accent text-on-accent font-medium'
                    : 'text-muted hover:text-fg-strong hover:bg-subtle'
                }`}
                onClick={() => onToggle(tab.id)}
                title={tab.label}
              >
                <ViewIcon path={tab.icon} />
                <span class="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}

          <button
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 bg-accent-soft text-accent border border-accent-soft-strong rounded-md text-sm hover:bg-accent-soft-strong transition-all duration-150"
            onClick={() => onEdit()}
            title="Open in editor"
          >
            <EditIcon />
            <span class="hidden sm:inline">Edit</span>
          </button>
        </div>
      </header>

      {active.has('mobile') && (
        <MobileSubBar
          mobileWidth={mobileWidth}
          onMobileWidthChange={onMobileWidthChange}
        />
      )}
    </div>
  )
}
