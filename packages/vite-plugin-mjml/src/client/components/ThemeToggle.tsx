import { signal } from '@preact/signals'
import { applyTheme, getTheme, type ThemeMode } from '../theme'

const ORDER: ThemeMode[] = ['system', 'light', 'dark']
const mode = signal<ThemeMode>(getTheme())

function SystemIcon() {
  return (
    <svg
      class="w-[18px] h-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      class="w-[18px] h-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      class="w-[18px] h-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
      />
    </svg>
  )
}

export function ThemeToggle() {
  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length]
    mode.value = next
    applyTheme(next)
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${mode.value} (click to change)`}
      aria-label={`Theme: ${mode.value}`}
      class="shrink-0 flex items-center justify-center w-[30px] h-[30px] rounded-lg border border-line bg-transparent text-muted hover:text-fg-strong hover:bg-subtle transition-colors duration-150"
    >
      {mode.value === 'system' ? (
        <SystemIcon />
      ) : mode.value === 'light' ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  )
}
