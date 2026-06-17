import 'virtual:uno.css'
import './styles.css'
import { render } from 'preact'
import type { PreviewData } from '../types'
import { App } from './App'

const data: PreviewData = window.__MJML_PREVIEW_DATA__ ?? {
  files: [],
  currentFile: null,
  html: '',
  source: '',
  editorUrl: 'vscode://file/%f',
  base: '/',
}

const root = document.getElementById('app')
if (root) {
  render(<App {...data} />, root)
}
