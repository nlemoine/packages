# @n5s/unocss-preset-tokens

A [UnoCSS](https://unocss.dev) preset that turns [DTCG design tokens](https://www.designtokens.org/tr/drafts/format/) into UnoCSS theme utilities and CSS custom properties, using [Terrazzo](https://terrazzo.app) as the token parser.

Point it at your token files, map token namespaces to UnoCSS theme sections, and you get:

- **Theme utilities** — `color.brand.primary` becomes `bg-brand-primary`, `text-brand-primary`, etc.
- **Preflight CSS** — the matching `:root { --color-brand-primary: … }` custom properties, emitted once.
- **Opacity modifiers** — `bg-brand-primary/50` works. Colors keep their full value (so they stay valid in borders, shadows and gradients) and opacity comes from a companion channels variable, or from `color-mix()` if you opt in. See [Color spaces and opacity](#color-spaces-and-opacity).

One source of truth: edit the JSON, both the utilities and the variables regenerate.

## Install

```bash
pnpm add -D @n5s/unocss-preset-tokens
```

`@unocss/core` is a peer dependency (you already have it via `unocss`).

## Usage

```ts
// uno.config.ts
import { defineConfig } from 'unocss'
import { presetTokens } from '@n5s/unocss-preset-tokens'

export default defineConfig({
  presets: [
    presetTokens({
      tokens: ['./tokens/color.json', './tokens/spacing.json'],
      // Drop the raw palette from the theme (semantic tokens still reference it).
      exclude: ['color.primitive.*'],
      preflights: true,
      // Expose colors under both `color.*` and `colors.*` for preset-mini compat.
      themeAliases: { color: 'colors' },
      theme: {
        color: ['color.*'],
        spacing: ['spacing.*'],
        radius: ['radius.*'],
      },
    }),
  ],
})
```

Token files are standard DTCG JSON:

```jsonc
{
  "color": {
    "$type": "color",
    "brand": {
      "primary": {
        "$value": { "colorSpace": "oklch", "components": [0.7, 0.15, 250], "alpha": 1 }
      }
    }
  }
}
```

## Options

| Option         | Type                                                       | Description                                                                                                  |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tokens`       | `string \| string[]`                                       | DTCG token file path(s) relative to `cwd`. Default `./tokens.json`. Ignored if `sources` is set.              |
| `sources`      | `Array<{ filename: string; src: string }>`                 | Inline token sources, for when you don't read from disk (e.g. tests, virtual files).                          |
| `cwd`          | `string`                                                   | Working directory for resolving paths. Default `process.cwd()`.                                               |
| `theme`        | `Record<string, string \| string[] \| Record<string,string>>` | Map token globs (or explicit `{ key: tokenId }` aliases) to UnoCSS theme sections.                       |
| `themeAliases` | `Record<string, string>`                                  | Duplicate a theme section under another key, e.g. `{ color: 'colors' }`.                                      |
| `include`      | `Array<string \| RegExp>`                                  | Only include token ids matching these patterns (theme only).                                                  |
| `exclude`      | `Array<string \| RegExp>`                                  | Exclude token ids matching these patterns (theme only — excluded tokens stay in preflights for reference chains). |
| `filter`       | `(token) => boolean`                                       | Extra predicate to filter tokens.                                                                             |
| `variableName` | `(token) => string \| null \| undefined`                  | Override the CSS variable name. `null` skips the token, `undefined` uses the default.                         |
| `preflights`   | `boolean \| object`                                        | Emit CSS custom properties. `true` for defaults, or an options object forwarded to `@terrazzo/plugin-css`.    |
| `opacity`      | `'channels' \| 'color-mix'`                                | How color opacity modifiers work. Default `'channels'` (wide browser support). See [Color spaces and opacity](#color-spaces-and-opacity). |
| `presetName`   | `string`                                                   | Override the preset name.                                                                                     |

## Color spaces and opacity

Color tokens are exposed so UnoCSS opacity modifiers (`bg-x/50`) keep working, while staying valid wherever the variable is referenced (a border, shadow or gradient that points at a color token resolves it as a plain `var(--x)`). Pick the strategy with the `opacity` option.

### `channels` (default)

Each color custom property keeps its **full** value, and a companion `--x--c` holds the bare channels:

```css
:root {
  --color-brand-primary: rgb(20% 40% 80%); /* full color — valid in borders, shadows, gradients */
  --color-brand-primary--c: 20% 40% 80%;   /* channels — used for opacity */
}
```

The theme value is `fn(var(--x--c))` (e.g. `rgb(var(--color-brand-primary--c))`), so `bg-brand-primary/50` resolves to `rgb(20% 40% 80% / 0.5)`. This works in every browser.

Opacity modifiers apply to the **named-function spaces** (`srgb` → `rgb()`, plus `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`). Every other form — the `color()` spaces (`display-p3`, `rec2020`, `srgb-linear`, `xyz*`), the non-standard `lab-d65` / `okhsv`, and hex (via `legacyHex`) — is referenced whole as `var(--x)`. It renders correctly but does **not** support opacity modifiers, since UnoCSS cannot alpha-inject those forms.

### `color-mix`

Colors stay whole and opacity rides on `color-mix()`. The theme value becomes:

```css
color-mix(in oklab, var(--color-brand-primary) calc(<alpha-value> * 100%), transparent)
```

This supports opacity for **every** color form, including the `color()` spaces. It requires a `color-mix()`-capable stack (Baseline 2023: Safari 16.4+, Chrome 111+, Firefox 113+) — the same floor as Tailwind CSS v4 and UnoCSS `presetWind4`.

## How variable names are derived

Token ids map to kebab-case CSS variables, and a trailing `.default` is dropped:

- `color.brand.primary` → `--color-brand-primary`
- `color.bg.default` → `--color-bg`, and in the theme it maps to the `DEFAULT` key (`color.bg.default` + `color.bg.subtle` → `{ DEFAULT, subtle }`), so it's reachable as the bare utility.
- a token that is both a leaf and has children is also stored under `DEFAULT` in the theme (`color.brand.primary` + `color.brand.primary.light` → `{ DEFAULT, light }`).

> [!NOTE]
> Glob patterns (`theme`, `include`, `exclude`) match the token **id as authored** — case-sensitive and dot-separated. The kebab-case/lowercasing only applies to the derived CSS variable name. So a token `borderRadius` is matched by `borderRadius` or `border*`, not `border-radius` or `border.radius.*`, and its variable is `--border-radius`. If two ids collapse to the same variable (e.g. `fooBar` and `foo.bar` → `--foo-bar`), the preset warns at build time.

## License

MIT © [Nicolas Lemoine](https://github.com/nlemoine)
