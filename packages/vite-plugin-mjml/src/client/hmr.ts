interface MjmlUpdate {
  file: string
  partial?: boolean
}

interface HotContext {
  on(event: string, cb: (data: MjmlUpdate) => void): void
}

/**
 * Subscribe to the plugin's `mjml:update` event via Vite's HMR client.
 *
 * The preview client is served statically (not transformed by Vite), so
 * `import.meta.hot` is unavailable. Instead we import the host's Vite client at
 * runtime — the specifier is computed so esbuild leaves it untouched.
 */
export async function setupHmr(
  onUpdate: (data: MjmlUpdate) => void,
): Promise<void> {
  const base = window.__MJML_PREVIEW_DATA__?.base ?? '/'
  try {
    const mod = (await import(/* @vite-ignore */ `${base}@vite/client`)) as {
      createHotContext: (path: string) => HotContext
    }
    mod.createHotContext('/__mjml').on('mjml:update', onUpdate)
  } catch {
    // Vite dev client unavailable — live reload disabled.
  }
}
