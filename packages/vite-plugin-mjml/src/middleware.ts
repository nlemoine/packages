import { readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, relative, resolve } from 'node:path'
import { globSync } from 'glob'
import type { Logger } from 'vite'
import type { MjmlCache } from './cache'
import { analyze } from './check'
import { compileFile } from './compiler'
import { renderApp } from './templates'
import type { MjmlCompileOptions } from './types'

export interface MjmlMiddlewareOptions {
  input: string
  inputBase: string
  /** Project root, used as the glob `cwd`. */
  root: string
  filePath: string
  mjmlOptions: MjmlCompileOptions
  cache: MjmlCache
  logger: Logger
  editorUrl: string
  base: string
}

function getValidFiles(input: string, root: string): Set<string> {
  return new Set(globSync(input, { nodir: true, absolute: true, cwd: root }))
}

/**
 * Connect handler for the preview, mounted under `${base}__mjml`. Serves the JSON
 * API (`/@api/*`) and the server-rendered HTML shell. Static client assets are
 * served separately by `sirv` under `${base}__mjml/@client`.
 */
export function createMjmlMiddleware(options: MjmlMiddlewareOptions) {
  const {
    input,
    inputBase,
    root,
    filePath,
    mjmlOptions,
    cache,
    logger,
    editorUrl,
    base,
  } = options

  // Valid file set, refreshed lazily to pick up newly created files.
  let validFiles = getValidFiles(input, root)
  let lastRefresh = Date.now()

  function isValidFile(absolutePath: string): boolean {
    const now = Date.now()
    if (now - lastRefresh > 2000) {
      validFiles = getValidFiles(input, root)
      lastRefresh = now
    }
    return validFiles.has(absolutePath)
  }

  function listFiles(): string[] {
    return globSync(input, { nodir: true, absolute: true, cwd: root })
      .filter((f) => !basename(f).startsWith('_'))
      .map((f) => relative(inputBase, f))
  }

  function getCompiledHtml(absolutePath: string): {
    html: string
    mtime: string
  } {
    const mtime = statSync(absolutePath).mtimeMs.toString()
    const cached = cache.get(absolutePath)
    if (cached && cached.mtime === mtime) {
      return { html: cached.html, mtime }
    }
    const result = compileFile(absolutePath, {
      filePath,
      minify: false,
      mjmlOptions,
    })
    cache.set(absolutePath, { ...result, mtime })
    return { html: result.html, mtime }
  }

  return async function mjmlMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname

    if (pathname === '/@api/files') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(listFiles()))
      return
    }

    if (pathname.startsWith('/@api/compile/')) {
      const file = decodeURIComponent(pathname.slice('/@api/compile/'.length))
      const absolutePath = resolve(inputBase, file)
      if (!isValidFile(absolutePath)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      try {
        const { html, mtime } = getCompiledHtml(absolutePath)
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('x-mjml-mtime', mtime)
        res.end(html)
      } catch (error) {
        logger.error(
          `[vite-plugin-mjml] Failed to compile ${file}: ${(error as Error).message}`,
        )
        res.statusCode = 500
        res.end(`Compilation error: ${(error as Error).message}`)
      }
      return
    }

    if (pathname.startsWith('/@api/source/')) {
      const file = decodeURIComponent(pathname.slice('/@api/source/'.length))
      const absolutePath = resolve(inputBase, file)
      if (!isValidFile(absolutePath)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      try {
        res.setHeader('Content-Type', 'text/plain')
        res.end(readFileSync(absolutePath, 'utf-8'))
      } catch {
        res.statusCode = 404
        res.end('File not found')
      }
      return
    }

    if (pathname.startsWith('/@api/path/')) {
      const file = decodeURIComponent(pathname.slice('/@api/path/'.length))
      const absolutePath = resolve(inputBase, file)
      if (!isValidFile(absolutePath)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      res.setHeader('Content-Type', 'text/plain')
      res.end(absolutePath)
      return
    }

    if (pathname.startsWith('/@api/check/')) {
      const file = decodeURIComponent(pathname.slice('/@api/check/'.length))
      const absolutePath = resolve(inputBase, file)
      if (!isValidFile(absolutePath)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      try {
        const { html } = getCompiledHtml(absolutePath)
        const report = await analyze(html)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(report))
      } catch (error) {
        logger.error(
          `[vite-plugin-mjml] Check failed for ${file}: ${(error as Error).message}`,
        )
        res.statusCode = 500
        res.end(JSON.stringify({ error: (error as Error).message }))
      }
      return
    }

    // HTML shell for `/` and `/:file` (file may be nested).
    const files = listFiles()
    let currentFile: string | null = null
    let html = ''
    let source = ''

    if (pathname !== '/' && pathname !== '') {
      const file = decodeURIComponent(pathname.slice(1))
      const absolutePath = resolve(inputBase, file)
      if (isValidFile(absolutePath)) {
        currentFile = file
        try {
          html = getCompiledHtml(absolutePath).html
          source = readFileSync(absolutePath, 'utf-8')
        } catch (error) {
          logger.error(
            `[vite-plugin-mjml] Error loading ${file}: ${(error as Error).message}`,
          )
        }
      }
    }

    res.setHeader('Content-Type', 'text/html')
    res.end(renderApp({ files, currentFile, html, source, editorUrl, base }))
  }
}
