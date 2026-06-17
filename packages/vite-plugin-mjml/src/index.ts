import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { globSync } from 'glob'
import pc from 'picocolors'
import picomatch from 'picomatch'
import sirv from 'sirv'
import type { Logger, Plugin, ResolvedConfig } from 'vite'
import { createCache } from './cache'
import { compileFile } from './compiler'
import { DIR_CLIENT } from './dirs'
import { createMjmlMiddleware } from './middleware'
import type { MjmlCompileOptions, MjmlPluginOptions } from './types'
import {
  getGlobBase,
  isPartial,
  mapOutputName,
  resolveEditorUrl,
} from './utils'

export type { MjmlCompileOptions, MjmlPluginOptions } from './types'

interface CompiledFile {
  output: string
  inputSize: number
  outputSize: number
  time: number
}

interface CompileWriteOptions {
  outDir: string
  globBase: string
  extension: string
  filePath: string
  minify: boolean
  mjmlOptions: MjmlCompileOptions
  logger: Logger
}

interface CompileWriteResult {
  success: boolean
  hasErrors: boolean
  file?: CompiledFile
}

function compileAndWriteFile(
  file: string,
  options: CompileWriteOptions,
): CompileWriteResult {
  const { outDir, globBase, extension, filePath, minify, mjmlOptions, logger } =
    options
  try {
    const mjmlContent = readFileSync(file, 'utf-8')
    const result = compileFile(file, { filePath, minify, mjmlOptions })

    if (result.errors.length > 0) {
      logger.error(pc.red(`[vite-plugin-mjml] Errors in ${file}:`))
      for (const err of result.errors) {
        logger.error(pc.red(`  - ${err.formattedMessage}`))
      }
    }

    const outputFilePath = resolve(
      outDir,
      mapOutputName(relative(globBase, file), extension),
    )
    mkdirSync(dirname(outputFilePath), { recursive: true })
    writeFileSync(outputFilePath, result.html, 'utf-8')

    return {
      success: true,
      hasErrors: result.errors.length > 0,
      file: {
        output: relative(process.cwd(), outputFilePath),
        inputSize: Buffer.byteLength(mjmlContent, 'utf-8'),
        outputSize: Buffer.byteLength(result.html, 'utf-8'),
        time: result.compilationTime,
      },
    }
  } catch (error) {
    logger.error(
      pc.red(
        `[vite-plugin-mjml] Failed to compile ${file}: ${(error as Error).message}`,
      ),
    )
    return { success: false, hasErrors: true }
  }
}

function printCompilationSummary(files: CompiledFile[], logger: Logger): void {
  if (files.length === 0) return

  logger.info(
    pc.green(`\n[vite-plugin-mjml] Compiled ${files.length} template(s):`),
  )
  for (const { output, inputSize, outputSize, time } of files) {
    const ratio =
      inputSize === 0 ? 0 : ((outputSize - inputSize) / inputSize) * 100
    const sign = ratio > 0 ? '+' : ''
    const inputKB = (inputSize / 1024).toFixed(2)
    const outputKB = (outputSize / 1024).toFixed(2)
    const percent = (ratio > 0 ? pc.green : pc.cyan)(
      `${sign}${ratio.toFixed(0)}%`,
    )
    logger.info(
      `  ${pc.cyan(output.padEnd(55))} ${percent.padStart(6)}  ${pc.dim(`${inputKB} kB`)} ${pc.dim('->')}  ${pc.bold(`${outputKB} kB`)} ${pc.dim(`(${time}ms)`)}`,
    )
  }
}

/**
 * Vite plugin that compiles MJML email templates to HTML.
 *
 * - **Build**: compiles every matching template and writes it to `outputPath`.
 * - **Dev**: serves an interactive preview at `/__mjml/`, or (with `writeToDisk`)
 *   compiles to disk on change.
 *
 * Files whose basename starts with `_` are treated as partials: watched for
 * changes but never compiled as standalone templates.
 */
export default function mjmlPlugin(
  options: MjmlPluginOptions = {} as MjmlPluginOptions,
): Plugin {
  const {
    input,
    outputPath = 'emails',
    extension = '.html',
    mjml: mjmlOptions = {},
    preview = true,
    writeToDisk = false,
    editor = 'vscode',
  } = options

  const editorUrl = resolveEditorUrl(editor)
  const cache = createCache()
  let config: ResolvedConfig

  return {
    name: 'vite-plugin-mjml',

    configResolved(resolvedConfig) {
      config = resolvedConfig
    },

    configureServer(server) {
      if (!input) {
        config.logger.warn(
          '[vite-plugin-mjml] Dev mode disabled: input option required',
        )
        return
      }

      const globBase = getGlobBase(input)
      const inputBase = resolve(config.root, globBase)
      const filePath = mjmlOptions.filePath ?? inputBase
      const patternAfterBase = input.slice(globBase.length).replace(/^\//, '')
      const matcher = picomatch(patternAfterBase)

      // writeToDisk mode: compile to disk instead of serving the preview.
      if (writeToDisk) {
        if (preview) {
          config.logger.warn(
            pc.yellow(
              '[vite-plugin-mjml] writeToDisk enabled, preview server disabled',
            ),
          )
        }
        const outDir = resolve(config.root, outputPath)

        const compileEntries = (): void => {
          const entryFiles = globSync(input, {
            nodir: true,
            absolute: true,
            cwd: config.root,
          }).filter((f) => !isPartial(f))
          if (entryFiles.length === 0) {
            config.logger.warn(
              pc.yellow(`[vite-plugin-mjml] No files found matching: ${input}`),
            )
            return
          }
          const compiled: CompiledFile[] = []
          for (const file of entryFiles) {
            const r = compileAndWriteFile(file, {
              outDir,
              globBase: inputBase,
              extension,
              filePath,
              minify: false,
              mjmlOptions,
              logger: config.logger,
            })
            if (r.file) compiled.push(r.file)
          }
          printCompilationSummary(compiled, config.logger)
        }

        compileEntries()

        server.watcher.on('change', (changedPath) => {
          const relPath = relative(inputBase, changedPath)
          if (relPath.startsWith('..') || !matcher(relPath)) return

          if (isPartial(changedPath)) {
            config.logger.info(
              pc.cyan(`[vite-plugin-mjml] Partial changed: ${relPath}`),
            )
            compileEntries()
            return
          }

          const r = compileAndWriteFile(changedPath, {
            outDir,
            globBase: inputBase,
            extension,
            filePath,
            minify: false,
            mjmlOptions,
            logger: config.logger,
          })
          if (r.file) {
            config.logger.info(
              pc.green(
                `[vite-plugin-mjml] Compiled: ${pc.cyan(r.file.output)} ${pc.dim(`(${r.file.time}ms)`)}`,
              ),
            )
          }
        })
        return
      }

      // Preview mode (default).
      if (!preview) return

      const base = config.base || '/'
      // Serve the pre-built preview client (Vite + UnoCSS output) from dist/client.
      server.middlewares.use(
        `${base}__mjml/@client`,
        sirv(DIR_CLIENT, { dev: true, etag: true }),
      )
      // JSON API + server-rendered shell.
      server.middlewares.use(
        `${base}__mjml`,
        createMjmlMiddleware({
          input,
          inputBase,
          root: config.root,
          filePath,
          mjmlOptions,
          cache,
          logger: config.logger,
          editorUrl,
          base,
        }),
      )

      server.watcher.on('change', (changedPath) => {
        const relPath = relative(inputBase, changedPath)
        if (relPath.startsWith('..') || !matcher(relPath)) return

        if (isPartial(changedPath)) {
          cache.clear()
          server.ws.send({
            type: 'custom',
            event: 'mjml:update',
            data: { file: relPath, partial: true },
          })
          config.logger.info(
            pc.cyan(`[vite-plugin-mjml] Partial changed: ${relPath}`),
          )
          return
        }

        cache.invalidate(changedPath)
        server.ws.send({
          type: 'custom',
          event: 'mjml:update',
          data: { file: relPath },
        })
        config.logger.info(pc.cyan(`[vite-plugin-mjml] ${relPath} changed`))
      })

      const printUrls = server.printUrls.bind(server)
      server.printUrls = () => {
        printUrls()
        const url =
          server.resolvedUrls?.local[0] ??
          server.resolvedUrls?.network[0] ??
          `http://localhost:${server.config.server.port}`
        const origin = new URL(url).origin
        config.logger.info(
          `  ${pc.green('➜')}  ${pc.bold('MJML Preview')}: ${pc.cyan(`${origin}${base}__mjml/`)}`,
        )
      }
    },

    closeBundle() {
      // closeBundle also runs when a dev server closes; only emit on real builds.
      if (config.command !== 'build') return

      const logger = config.logger
      if (!input) {
        throw new Error(
          "[vite-plugin-mjml] 'input' option is required. Example: input: 'src/emails/**/*.mjml'",
        )
      }

      const globBase = getGlobBase(input)
      const inputBase = resolve(config.root, globBase)
      const filePath = mjmlOptions.filePath ?? inputBase
      const mjmlFiles = globSync(input, {
        nodir: true,
        absolute: true,
        cwd: config.root,
      }).filter((f) => !isPartial(f))

      if (mjmlFiles.length === 0) {
        logger.warn(
          pc.yellow(`[vite-plugin-mjml] No files found matching: ${input}`),
        )
        return
      }

      const outDir = resolve(config.root, config.build.outDir, outputPath)
      const compiled: CompiledFile[] = []
      let hasErrors = false

      for (const file of mjmlFiles) {
        const r = compileAndWriteFile(file, {
          outDir,
          globBase: inputBase,
          extension,
          filePath,
          minify: mjmlOptions.minify ?? false,
          mjmlOptions,
          logger,
        })
        if (r.hasErrors || !r.success) hasErrors = true
        if (r.file) compiled.push(r.file)
      }

      printCompilationSummary(compiled, logger)
      if (hasErrors)
        logger.warn(pc.yellow('[vite-plugin-mjml] Completed with errors'))
    },
  }
}
