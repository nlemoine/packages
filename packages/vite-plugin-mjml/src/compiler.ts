import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mjml2html from 'mjml'
import type { CompileResult, MjmlCompileOptions } from './types'

export interface CompileOptions {
  /** Base path for `mj-include` resolution. */
  filePath?: string
  /** Minify the HTML output. */
  minify?: boolean
  /** Additional MJML compiler options. */
  mjmlOptions?: MjmlCompileOptions
}

/** Compile a single MJML file to HTML. */
export function compileFile(
  filePath: string,
  options: CompileOptions = {},
): CompileResult {
  const content = readFileSync(filePath, 'utf-8')
  return compileContent(content, {
    ...options,
    filePath: options.filePath ?? resolve(filePath, '..'),
  })
}

/** Compile an MJML string to HTML. */
export function compileContent(
  content: string,
  options: CompileOptions = {},
): CompileResult {
  const { filePath, minify = false, mjmlOptions = {} } = options
  const startTime = Date.now()

  const result = mjml2html(content, {
    validationLevel: 'soft',
    keepComments: false,
    ...mjmlOptions,
    minify,
    filePath,
  })

  return {
    html: result.html,
    errors: result.errors ?? [],
    compilationTime: Date.now() - startTime,
  }
}
