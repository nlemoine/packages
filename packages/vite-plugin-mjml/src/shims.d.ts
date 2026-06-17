// Minimal ambient types for dependencies that ship no types.

declare module 'mjml' {
  export interface MJMLParseError {
    line: number
    message: string
    tagName: string
    formattedMessage: string
  }

  export interface MJMLParsingOptions {
    fonts?: Record<string, string>
    keepComments?: boolean
    beautify?: boolean
    minify?: boolean
    validationLevel?: 'strict' | 'soft' | 'skip'
    filePath?: string
    mjmlConfigPath?: string
    [key: string]: unknown
  }

  export interface MJMLParseResults {
    html: string
    errors?: MJMLParseError[]
  }

  export default function mjml2html(
    mjml: string,
    options?: MJMLParsingOptions,
  ): MJMLParseResults
}

declare module 'picomatch' {
  export type Matcher = (str: string) => boolean
  export default function picomatch(
    pattern: string | string[],
    options?: Record<string, unknown>,
  ): Matcher
}
