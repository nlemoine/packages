# @n5s/vite-plugin-mjml

Vite plugin that compiles [MJML](https://mjml.io) email templates to HTML, with a live dev preview.

## Features

- Compiles MJML templates to HTML on `vite build`.
- Dev preview at `/__mjml/`: file-tree sidebar; **side-by-side Desktop + Mobile** viewports; a **Source** view; a **Check** tab (email-client compatibility from [caniemail](https://www.caniemail.com) data, plus Gmail-clipping size and accessibility checks); light/dark/system theme; open-in-editor; and live reload on change.
- **Partials**: files whose basename starts with `_` are watched but never compiled standalone — include them with `mj-include`.
- Works with plain `.mjml` and templated files such as `.mjml.php`.
- The preview client is pre-bundled and served by the plugin — it does **not** touch your project's JSX config.

## Install

```bash
pnpm add -D @n5s/vite-plugin-mjml
```

## Usage

```ts
// vite.config.ts
import mjml from '@n5s/vite-plugin-mjml'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [mjml({ input: 'src/emails/**/*.mjml' })],
})
```

On `vite build`, every matching template is compiled and written to `outputPath` (default `emails/`, relative to Vite's `build.outDir`). In dev, open the preview URL printed on startup.

## Options

| Option        | Type      | Default      | Description                                                                 |
| ------------- | --------- | ------------ | --------------------------------------------------------------------------- |
| `input`       | `string`  | —            | Glob pattern for MJML files (required).                                      |
| `outputPath`  | `string`  | `'emails'`   | Output directory, relative to `build.outDir` or an absolute path.           |
| `extension`   | `string`  | `'.html'`    | Output file extension.                                                       |
| `preview`     | `boolean` | `true`       | Enable the dev preview server. Ignored when `writeToDisk` is `true`.        |
| `writeToDisk` | `boolean` | `false`      | In dev, compile to disk on change instead of serving the preview.           |
| `editor`      | `string`  | `'vscode'`   | Editor for the preview's "Edit" button — an alias or a custom URL with `%f`. |
| `mjml`        | `object`  | `{}`         | [MJML compiler options](https://documentation.mjml.io/#inside-node-js).     |

Editor aliases: `textmate`, `macvim`, `emacs`, `sublime`, `phpstorm`, `idea`, `vscode`, `vscode-insiders`, `atom`, `nova`, `netbeans`, `xdebug`.

```ts
mjml({
  input: 'templates/emails/**/*.mjml.php',
  outputPath: 'emails',
  extension: '.php',
  editor: 'phpstorm',
  mjml: { validationLevel: 'soft' },
})
```

The MJML `filePath` option (for `mj-include` resolution) is derived from the input glob's base path, and `minify` is automatically disabled in dev.

## How the preview works

The preview UI is a small pre-built Preact app shipped inside the package. The plugin serves it under `/__mjml/` alongside a tiny JSON API, and live-reloads it via Vite's HMR channel when a template changes. Nothing is injected into your app's bundle or its JSX configuration.

## License

MIT © [Nicolas Lemoine](https://github.com/nlemoine)
