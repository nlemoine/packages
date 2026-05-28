# @n5s/octofolio

A TypeScript library that wraps GitHub's GraphQL API into a clean, high-level interface for fetching user profile data. Designed for generating profile READMEs.

Call `createOctofolio({ token })` and get back an object with methods like `.repos()`, `.pullRequests()`, `.contributions()` that return flat, well-typed results instead of raw GraphQL shapes.

## Install

```bash
npm install @n5s/octofolio
```

Requires Node 22+. ESM-only.

## Quick start

```ts
import { createOctofolio } from '@n5s/octofolio'

const octofolio = createOctofolio({ token: process.env.GITHUB_TOKEN })

const profile = await octofolio.profile()
const repos = await octofolio.repos({ count: 10 })
const langs = await octofolio.languages()
```

## API

### `createOctofolio({ token })`

Returns an object with the following methods. All methods are async and return clean, flat types.

#### `profile()`

Returns your GitHub profile.

```ts
const profile = await octofolio.profile()
// { login, name, bio, avatarUrl, url, email, location, company,
//   websiteUrl, twitterUsername, createdAt, followersCount,
//   followingCount, socialAccounts }
```

#### `repos(opts?)` / `forks(opts?)`

Returns your repositories or forks. Sorted by most recently pushed.

```ts
const repos = await octofolio.repos({ count: 10 })
// [{ name, nameWithOwner, url, description, isPrivate, isFork,
//    stargazerCount, forkCount, primaryLanguage, primaryLanguageColor,
//    topics, createdAt, pushedAt, lastRelease }]
```

#### `repo(nameWithOwner)`

Returns a single repository by `owner/name`. Unlike the other methods, this is not viewer-scoped: it can fetch **any public repo** on GitHub, plus private repos the token can access. Throws `NotFoundError` if the repo doesn't exist or isn't accessible, and `TypeError` if the identifier isn't `owner/name`.

```ts
const repo = await octofolio.repo('nlemoine/octofolio')
// Same shape as repos(): { name, nameWithOwner, url, description, isPrivate,
//   isFork, stargazerCount, forkCount, primaryLanguage, primaryLanguageColor,
//   topics, createdAt, pushedAt, lastRelease }
```

#### `pullRequests(opts?)`

```ts
const prs = await octofolio.pullRequests({ count: 10, state: 'MERGED' })
// [{ title, url, state, createdAt, additions, deletions,
//    repoNameWithOwner, repoUrl }]
```

`state` can be `'OPEN'`, `'CLOSED'`, or `'MERGED'` (default: `'MERGED'`).

#### `issues(opts?)`

```ts
const issues = await octofolio.issues({ count: 10, state: 'OPEN' })
// [{ title, url, state, createdAt, number, commentsCount,
//    repoNameWithOwner, repoUrl }]
```

`state` can be `'OPEN'` (default) or `'CLOSED'`.

#### `stars(opts?)`

```ts
const stars = await octofolio.stars({ count: 10 })
// [{ starredAt, repoName, repoNameWithOwner, repoUrl,
//    description, stargazerCount, primaryLanguage }]
```

#### `gists(opts?)`

```ts
const gists = await octofolio.gists({ count: 10 })
// [{ name, description, url, createdAt, isPublic,
//    files: [{ name, extension, language, size }] }]
```

#### `followers(opts?)` / `following(opts?)`

```ts
const followers = await octofolio.followers({ count: 10 })
// [{ login, name, avatarUrl, url }]
```

#### `organizations(opts?)`

```ts
const orgs = await octofolio.organizations({ count: 10 })
// [{ login, name, description, avatarUrl, url }]
```

#### `pinnedRepos()`

Returns your pinned repositories (up to 6).

```ts
const pinned = await octofolio.pinnedRepos()
// Same shape as repos()
```

#### `contributions(opts?)`

Returns repositories you've contributed to, with commit counts and star counts.

```ts
const contribs = await octofolio.contributions({
  from: 2018,
  to: 2026,
  source: ['external'],
  includePrivate: false,
  includeCommits: true,
})
// [{ repoName, repoNameWithOwner, repoUrl, commitCount,
//    stargazerCount, occurredAt, commits? }]
```

Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `year` | `number` | — | Single year to query |
| `from` / `to` | `number` | — | Year range (inclusive). Fetches each year and merges results. |
| `source` | `ContributionSource[]` | `['owned', 'org', 'external']` | Filter by repo ownership. `owned` = your repos, `org` = repos in your orgs, `external` = everything else. |
| `includePrivate` | `boolean` | `true` | Include private repos. Set to `false` for public profiles. |
| `includeCommits` | `boolean` | `false` | Attach individual commit objects (`sha`, `url`, `message`, `date`) to each contribution. |

When `includePrivate: false`, the library automatically supplements GitHub's GraphQL API (which caps at 100 repos and prioritizes private ones) with a REST commit search to ensure public contributions aren't missed.

**Highlight notable open-source contributions:**

```ts
const notable = await octofolio.contributions({
  from: 2012,
  to: 2026,
  source: ['external'],
  includePrivate: false,
  includeCommits: true,
})
notable.sort((a, b) => b.stargazerCount - a.stargazerCount)
```

#### `contributionStats(opts?)`

Returns aggregate contribution statistics for a year.

```ts
const stats = await octofolio.contributionStats({ year: 2025 })
// { year, totalCommitContributions, totalIssueContributions,
//   totalPullRequestContributions, totalPullRequestReviewContributions,
//   totalRepositoriesWithContributedCommits, restrictedContributionsCount,
//   startedAt, endedAt }
```

#### `languages()`

Returns aggregated language usage across all your public repos, sorted by bytes.

```ts
const langs = await octofolio.languages()
// [{ name, color, bytes, percentage }]
```

#### `sponsors(opts?)` / `sponsoring(opts?)`

```ts
const sponsors = await octofolio.sponsors({ count: 10 })
// [{ login, name, avatarUrl, url, type, createdAt,
//    tier: { name, monthlyPriceInDollars, isOneTime } | null }]
```

#### `releases(opts?)`

Returns recent releases from repositories you've contributed to.

```ts
const releases = await octofolio.releases({ count: 10 })
// [{ name, tagName, publishedAt, url,
//    repoName, repoNameWithOwner, repoUrl }]
```

## Error handling

All API errors are wrapped into typed errors:

```ts
import { AuthError, RateLimitError, NotFoundError, GraphQLError } from '@n5s/octofolio'

try {
  await octofolio.profile()
} catch (e) {
  if (e instanceof RateLimitError) {
    console.log(`Rate limited, resets at ${e.resetAt}`)
  }
}
```

## Token scopes

For public profile data, you need a [Personal Access Token](https://github.com/settings/tokens/new) with:

- `read:user`
- `read:org`
- `public_repo`

For private data, add `repo` and `gist`.

Or use your existing `gh` CLI token:

```bash
GITHUB_TOKEN=$(gh auth token) node your-script.js
```

## License

MIT
