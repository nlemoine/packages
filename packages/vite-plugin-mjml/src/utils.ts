import { basename, dirname } from 'node:path'

/**
 * Editor URL patterns. `%f` is replaced with the file path.
 * @see https://github.com/symfony/error-handler/blob/7.2/ErrorRenderer/ErrorRendererInterface.php
 */
export const EDITOR_ALIASES: Record<string, string> = {
  textmate: 'txmt://open?url=file://%f',
  macvim: 'mvim://open?url=file://%f',
  emacs: 'emacs://open?url=file://%f',
  sublime: 'subl://open?url=file://%f',
  phpstorm: 'phpstorm://open?file=%f',
  idea: 'idea://open?file=%f',
  vscode: 'vscode://file/%f',
  'vscode-insiders': 'vscode-insiders://file/%f',
  atom: 'atom://core/open/file?filename=%f',
  nova: 'nova://core/open/file?filename=%f',
  netbeans: 'netbeans://open/?f=%f',
  xdebug: 'xdebug://%f',
}

/** Resolve an editor alias (or pass through a custom URL pattern). */
export function resolveEditorUrl(editor?: string): string {
  if (!editor) return EDITOR_ALIASES.vscode
  return EDITOR_ALIASES[editor] ?? editor
}

/** Extract the base path of a glob (everything before the first wildcard). */
export function getGlobBase(glob: string): string {
  const firstWildcard = glob.search(/[*?[\]]/)
  if (firstWildcard === -1) {
    return dirname(glob)
  }
  const base = glob.slice(0, firstWildcard)
  return base.endsWith('/') ? base.slice(0, -1) : dirname(base)
}

/**
 * A partial is a file whose basename starts with `_`. Partials are watched for
 * changes but never compiled as standalone templates.
 */
export function isPartial(filePath: string): boolean {
  return basename(filePath).startsWith('_')
}

/** Map an input MJML filename to its output name, e.g. `welcome.mjml.php` → `welcome.php`. */
export function mapOutputName(relativePath: string, extension: string): string {
  return relativePath.replace(/\.mjml(\.[^.]+)?$/, extension)
}
