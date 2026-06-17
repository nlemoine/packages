import type { ComponentChildren } from 'preact'

export function Shell({ children }: { children: ComponentChildren }) {
  return (
    <div class="flex h-screen bg-base text-fg overflow-hidden">{children}</div>
  )
}
