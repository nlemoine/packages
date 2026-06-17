import { describe, expect, it } from 'vitest'
import {
  EDITOR_ALIASES,
  getGlobBase,
  isPartial,
  mapOutputName,
  resolveEditorUrl,
} from '../src/utils'

describe('getGlobBase', () => {
  it('returns the directory before the first wildcard', () => {
    expect(getGlobBase('src/emails/**/*.mjml')).toBe('src/emails')
    expect(getGlobBase('templates/*.mjml')).toBe('templates')
  })

  it('handles patterns with no wildcard', () => {
    expect(getGlobBase('a/b/c.mjml')).toBe('a/b')
  })
})

describe('isPartial', () => {
  it('detects underscore-prefixed basenames', () => {
    expect(isPartial('_header.mjml')).toBe(true)
    expect(isPartial('emails/_header.mjml')).toBe(true)
    expect(isPartial('emails/welcome.mjml')).toBe(false)
  })
})

describe('mapOutputName', () => {
  it('maps .mjml to the target extension', () => {
    expect(mapOutputName('welcome.mjml', '.html')).toBe('welcome.html')
    expect(mapOutputName('nested/a.mjml', '.html')).toBe('nested/a.html')
  })

  it('maps .mjml.<ext> templates', () => {
    expect(mapOutputName('welcome.mjml.php', '.php')).toBe('welcome.php')
  })
})

describe('resolveEditorUrl', () => {
  it('resolves known aliases', () => {
    expect(resolveEditorUrl('vscode')).toBe(EDITOR_ALIASES.vscode)
    expect(resolveEditorUrl('phpstorm')).toBe('phpstorm://open?file=%f')
  })

  it('passes through custom URL patterns', () => {
    expect(resolveEditorUrl('myeditor://open?file=%f')).toBe(
      'myeditor://open?file=%f',
    )
  })

  it('defaults to vscode', () => {
    expect(resolveEditorUrl()).toBe(EDITOR_ALIASES.vscode)
  })
})
