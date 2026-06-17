import type { PreviewData } from './types'

export interface RenderAppOptions {
  files: string[]
  currentFile: string | null
  html: string
  source: string
  editorUrl: string
  base: string
}

/** Render the HTML shell that boots the pre-built preview client. */
export function renderApp({
  files,
  currentFile,
  html,
  source,
  editorUrl,
  base,
}: RenderAppOptions): string {
  const data: PreviewData = {
    files,
    currentFile,
    html: currentFile ? html : '',
    source: currentFile ? source : '',
    editorUrl,
    base,
  }
  const assetBase = `${base}__mjml/@client`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>try{var t=localStorage.getItem('mjml-preview-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
  <title>${currentFile ? `${escapeHtml(currentFile)} - ` : ''}MJML Preview</title>
  <script type="module" src="${base}@vite/client"></script>
  <link rel="stylesheet" href="${assetBase}/main.css">
</head>
<body>
  <div id="app"></div>
  <script>window.__MJML_PREVIEW_DATA__ = ${serialize(data)}</script>
  <script type="module" src="${assetBase}/main.js"></script>
</body>
</html>`
}

/** Serialize for safe inline embedding inside a `<script>` tag. */
function serialize(data: PreviewData): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
