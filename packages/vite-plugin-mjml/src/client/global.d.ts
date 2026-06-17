import type { PreviewData } from '../types'

declare global {
  interface Window {
    __MJML_PREVIEW_DATA__?: PreviewData
  }
}

declare module 'virtual:uno.css'
declare module 'prismjs/components/*'
