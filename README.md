# packages

Monorepo for my published JS packages.

## Packages

- [`@n5s/bruno-wordpress-converter`](packages/bruno-wordpress-converter): convert a WordPress REST API into a [Bruno](https://www.usebruno.com/) collection.
- [`@n5s/octofolio`](packages/octofolio): clean TypeScript interface for GitHub profile data via GraphQL.
- [`@n5s/unocss-preset-tokens`](packages/unocss-preset-tokens): UnoCSS preset that turns DTCG design tokens into theme utilities and CSS variables via [Terrazzo](https://terrazzo.app).

## Development

pnpm workspaces + nx.

```bash
pnpm install
pnpm test         # vitest in each package
pnpm lint         # biome check
pnpm typecheck    # tsc --noEmit per package
pnpm knip         # unused files, exports, deps
pnpm publint      # publish-readiness
pnpm normalize    # sort every package.json
pnpm check        # all of the above, sequential
```

## Release

Versioning and publishing via [nx release](https://nx.dev/features/manage-releases) with conventional commits. Each package versions independently. Tag pattern: `{projectName}@{version}`.

```bash
pnpm nx release --dry-run
```

CI runs lint, typecheck, test, knip, publint on every PR and push to `main`.
