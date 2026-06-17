export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface CheckItem {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

// Gmail clips messages larger than ~102 KB of HTML.
const GMAIL_CLIP_BYTES = 102 * 1024
const GMAIL_WARN_BYTES = 90 * 1024

function byteLength(str: string): number {
  return new TextEncoder().encode(str).length
}

/**
 * Curated, high-signal checks on compiled email HTML. MJML already handles
 * cross-client CSS compatibility, so these cover what it can't: size,
 * accessibility, and metadata — things the author can actually fix.
 */
export function runChecks(html: string): CheckItem[] {
  const checks: CheckItem[] = []

  // Size / Gmail clipping.
  const bytes = byteLength(html)
  const kb = (bytes / 1024).toFixed(1)
  if (bytes > GMAIL_CLIP_BYTES) {
    checks.push({
      id: 'size',
      label: 'Email size',
      status: 'fail',
      detail: `${kb} KB — over Gmail's ~102 KB limit. Gmail clips the bottom of the email, hiding content and the unsubscribe link.`,
    })
  } else if (bytes > GMAIL_WARN_BYTES) {
    checks.push({
      id: 'size',
      label: 'Email size',
      status: 'warn',
      detail: `${kb} KB — approaching Gmail's ~102 KB clipping limit.`,
    })
  } else {
    checks.push({
      id: 'size',
      label: 'Email size',
      status: 'pass',
      detail: `${kb} KB — comfortably under Gmail's ~102 KB clip limit.`,
    })
  }

  // Image alt text.
  const imgs = html.match(/<img\b[^>]*>/gi) ?? []
  const missingAlt = imgs.filter((tag) => !/\balt\s*=/i.test(tag)).length
  const plural = imgs.length === 1 ? '' : 's'
  if (imgs.length === 0) {
    checks.push({
      id: 'alt',
      label: 'Image alt text',
      status: 'pass',
      detail: 'No images in this email.',
    })
  } else if (missingAlt > 0) {
    checks.push({
      id: 'alt',
      label: 'Image alt text',
      status: 'warn',
      detail: `${missingAlt} of ${imgs.length} image${plural} missing alt text — add it via mj-image's alt attribute.`,
    })
  } else {
    checks.push({
      id: 'alt',
      label: 'Image alt text',
      status: 'pass',
      detail: `All ${imgs.length} image${plural} have alt text.`,
    })
  }

  // Language attribute.
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''
  const lang = htmlTag.match(/\blang\s*=\s*["']([^"']+)["']/i)?.[1]
  if (lang && lang.toLowerCase() !== 'und') {
    checks.push({
      id: 'lang',
      label: 'Language attribute',
      status: 'pass',
      detail: `<html lang="${lang}"> is set.`,
    })
  } else {
    checks.push({
      id: 'lang',
      label: 'Language attribute',
      status: 'warn',
      detail:
        lang === 'und'
          ? 'lang="und" (MJML default) — set a real language via <mjml lang="en"> for screen readers.'
          : 'No lang on <html> — set it via <mjml lang="en"> for screen readers.',
    })
  }

  return checks
}
