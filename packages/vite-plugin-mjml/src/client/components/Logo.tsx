/** The MJML wordmark, rendered as gradient text (adapts to light and dark). */
export function Logo({ class: className = '' }: { class?: string }) {
  return <span class={`mjml-wordmark ${className}`}>mjml</span>
}
