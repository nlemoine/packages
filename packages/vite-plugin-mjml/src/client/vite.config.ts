import { presetWind3 } from 'unocss'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

// Builds the preview client to ../../dist/client/{main.js,main.css} as a
// self-contained bundle (preact, @preact/signals and prismjs are bundled in).
// The UnoCSS config is inlined so generation is independent of the cwd.
export default defineConfig({
  base: './',
  plugins: [
    UnoCSS({
      presets: [presetWind3()],
      theme: {
        // Semantic tokens backed by CSS variables (see styles.css), so utilities
        // flip automatically with prefers-color-scheme.
        colors: {
          base: 'var(--base)',
          panel: 'var(--panel)',
          card: 'var(--card)',
          subtle: 'var(--subtle)',
          track: 'var(--track)',
          line: 'var(--line)',
          fg: 'var(--fg)',
          'fg-strong': 'var(--fg-strong)',
          muted: 'var(--muted)',
          faint: 'var(--faint)',
          accent: 'var(--accent)',
          'on-accent': 'var(--on-accent)',
          'accent-soft': 'var(--accent-soft)',
          'accent-soft-strong': 'var(--accent-soft-strong)',
          'accent-row': 'var(--accent-row)',
          'code-bg': 'var(--code-bg)',
        },
      },
    }),
  ],
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'preact',
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: false,
    lib: {
      entry: 'main.tsx',
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        entryFileNames: 'main.js',
        assetFileNames: 'main.[ext]',
      },
    },
  },
})
