/** Options forwarded to the MJML compiler (https://documentation.mjml.io/#inside-node-js). */
export interface MjmlCompileOptions {
  /** Base path for `mj-include` resolution. Auto-derived from the input glob if omitted. */
  filePath?: string
  /** Minify the HTML output. Auto-disabled in dev mode. */
  minify?: boolean
  /** Beautify the HTML output. */
  beautify?: boolean
  /** Keep comments in the output. Default `false`. */
  keepComments?: boolean
  /** Validation level. Default `'soft'`. */
  validationLevel?: 'strict' | 'soft' | 'skip'
  /** Custom fonts map. */
  fonts?: Record<string, string>
  [key: string]: unknown
}

/** Plugin options. */
export interface MjmlPluginOptions {
  /** Glob pattern for MJML files (required). Example: `'src/emails/**\/*.mjml'`. */
  input: string
  /** Output directory, relative to Vite's `build.outDir` or an absolute path. Default `'emails'`. */
  outputPath?: string
  /** Output file extension. Default `'.html'`. */
  extension?: string
  /** Enable the dev preview server. Default `true`. Ignored when `writeToDisk` is `true`. */
  preview?: boolean
  /** Write compiled files to disk in dev mode instead of serving the preview. Default `false`. */
  writeToDisk?: boolean
  /**
   * Editor for the "Edit" button. A known alias (`textmate`, `macvim`, `emacs`, `sublime`,
   * `phpstorm`, `idea`, `vscode`, `vscode-insiders`, `atom`, `nova`, `netbeans`, `xdebug`) or a
   * custom URL pattern with a `%f` placeholder for the file path. Default `'vscode'`.
   */
  editor?: string
  /** MJML compiler options. */
  mjml?: MjmlCompileOptions
}

export interface MjmlError {
  line?: number
  message?: string
  tagName?: string
  formattedMessage?: string
}

export interface CompileResult {
  html: string
  errors: MjmlError[]
  compilationTime: number
}

/** Shape injected into the preview page as `window.__MJML_PREVIEW_DATA__`. */
export interface PreviewData {
  files: string[]
  currentFile: string | null
  html: string
  source: string
  editorUrl: string
  base: string
}

/** One feature's client-support breakdown (across client families). */
export interface FeatureRow {
  /** Feature name, e.g. "text-align", "<style> element". */
  title: string
  /** Number of occurrences (HTML nodes) using the feature. */
  count: number
  /** Client families with full support. */
  supported: number
  /** Client families with partial support. */
  partial: number
  /** Client families with no support. */
  none: number
  /** Total client families considered. */
  total: number
}

/** Email-client compatibility report for a compiled template (caniemail-derived). */
export interface CheckReport {
  /** Overall support score 0-100 (supported share across flagged feature/family checks). */
  score: number
  supported: number
  partial: number
  none: number
  familyCount: number
  rows: FeatureRow[]
}
