import { fileURLToPath } from 'node:url'

/**
 * Absolute path to the built preview client (`dist/client`).
 *
 * `src/dirs.ts` is bundled into `dist/index.js`, so at runtime `import.meta.url`
 * points at `dist/index.js` and `./client/` resolves to `dist/client/`.
 */
export const DIR_CLIENT = fileURLToPath(new URL('./client/', import.meta.url))
