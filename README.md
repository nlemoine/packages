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

### Adding a new package

The first publish is manual. npm trusted publishing (OIDC) can only publish to a
package that already exists, so CI's publish step 404s on a brand-new name. After
nx tags the first version, publish it once by hand, then add a Trusted Publisher
for it on npmjs.com (GitHub Actions → `nlemoine/packages` → `release.yml`); later
releases publish automatically.

```bash
npm login
pnpm --filter @n5s/<package> publish --access public --no-git-checks
```

Keep `feat:`/`fix:` commits scoped to a single package's files. nx maps commits
to projects by changed path (`useCommitScope: false`), and root files (the
lockfile, `pnpm-workspace.yaml`) count as touching every project — so a `feat`
that also edits the lockfile bumps every package. Put root/lockfile/workspace
changes in their own `chore:` commit.
