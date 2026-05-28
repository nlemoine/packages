import { Octokit } from '@octokit/core'
import { graphql as baseGraphql } from '@octokit/graphql'
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql'
import { NotFoundError, wrapError } from './errors.js'
import type {
  RawCommitContributionsByRepo,
  RawContributedRepoNode,
  RawContributionStatsCollection,
  RawGistNode,
  RawIssueNode,
  RawLanguageEdge,
  RawOrganizationNode,
  RawPinnedItemNode,
  RawProfileUser,
  RawPullRequestNode,
  RawRepoNode,
  RawSponsorshipNode,
  RawStarEdge,
  RawUserNode,
} from './mappers.js'
import {
  mapContribution,
  mapContributionStats,
  mapGist,
  mapIssue,
  mapOrganization,
  mapPinnedRepos,
  mapProfile,
  mapPullRequest,
  mapRelease,
  mapRepo,
  mapSponsorship,
  mapStar,
  mapUser,
} from './mappers.js'
import {
  CONTRIBUTION_STATS_QUERY,
  CONTRIBUTIONS_QUERY,
} from './queries/contributions.js'
import { GISTS_QUERY } from './queries/gists.js'
import { ISSUES_QUERY } from './queries/issues.js'
import { REPOS_WITH_LANGUAGES_QUERY } from './queries/languages.js'
import { PINNED_REPOS_QUERY } from './queries/pinnedRepos.js'
import { PROFILE_QUERY, VIEWER_QUERY } from './queries/profile.js'
import { PULL_REQUESTS_QUERY } from './queries/pullRequests.js'
import { RELEASES_QUERY } from './queries/releases.js'
import { REPO_QUERY, REPOS_QUERY } from './queries/repos.js'
import {
  FOLLOWERS_QUERY,
  FOLLOWING_QUERY,
  ORGS_QUERY,
} from './queries/social.js'
import { SPONSORING_QUERY, SPONSORS_QUERY } from './queries/sponsors.js'
import { STARS_QUERY } from './queries/stars.js'
import type {
  Contribution,
  ContributionCommit,
  ContributionSource,
  ContributionStats,
  Gist,
  Issue,
  Language,
  Organization,
  Profile,
  PullRequest,
  Release,
  Repo,
  Sponsor,
  Star,
  User,
} from './types.js'

// OctokitWithPaginate is created at module scope (not inside createOctofolio) to avoid
// re-running Octokit.plugin() on every createOctofolio call — safe since plugin() is idempotent
// but wasteful; module-level ensures the class is created exactly once.
const OctokitWithPaginate = Octokit.plugin(paginateGraphQL)

const RETRYABLE_STATUS = new Set([500, 502, 503, 504])
const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e: unknown) {
      const status = (e as { status?: number }).status
      if (status && RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt))
        continue
      }
      throw e
    }
  }
}

interface RawReposPage {
  user: {
    repositories: {
      nodes: Array<RawRepoNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawPullRequestsPage {
  user: {
    pullRequests: {
      nodes: Array<RawPullRequestNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawIssuesPage {
  user: {
    issues: {
      nodes: Array<RawIssueNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawStarsPage {
  user: {
    starredRepositories: {
      edges: Array<RawStarEdge | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawGistsPage {
  user: {
    gists: {
      nodes: Array<RawGistNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawFollowersPage {
  user: {
    followers: {
      nodes: Array<RawUserNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawFollowingPage {
  user: {
    following: {
      nodes: Array<RawUserNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawOrgsPage {
  user: {
    organizations: {
      nodes: Array<RawOrganizationNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawPinnedReposResponse {
  user: {
    pinnedItems: {
      nodes: Array<RawPinnedItemNode | null> | null
    }
  }
}

interface RawContributionsResponse {
  user: {
    contributionsCollection: {
      startedAt: string
      commitContributionsByRepository: RawCommitContributionsByRepo[]
    }
  }
}

interface RawContributionStatsResponse {
  user: {
    contributionsCollection: RawContributionStatsCollection
  }
}

interface RawReposWithLanguagesPage {
  user: {
    repositories: {
      nodes: Array<{
        nameWithOwner: string
        languages: {
          edges: Array<RawLanguageEdge | null> | null
        } | null
      } | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawSponsorsPage {
  user: {
    sponsorshipsAsMaintainer: {
      nodes: Array<RawSponsorshipNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawSponsoringPage {
  user: {
    sponsorshipsAsSponsor: {
      nodes: Array<RawSponsorshipNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

interface RawReleasesPage {
  user: {
    repositoriesContributedTo: {
      nodes: Array<RawContributedRepoNode | null> | null
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
}

export function createOctofolio({ token }: { token: string }) {
  const baseGql = baseGraphql.defaults({
    headers: { authorization: `token ${token}` },
  })

  // Wrap gql with retry for transient 5xx errors
  const gql = <T>(...args: Parameters<typeof baseGql>) =>
    withRetry(() => baseGql<T>(...args))

  const octokit = new OctokitWithPaginate({ auth: token })

  // Retry transient 5xx errors on all requests (including paginated GraphQL)
  octokit.hook.wrap('request', async (request, options) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await request(options)
      } catch (e: unknown) {
        const status = (e as { status?: number }).status
        if (status && RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt))
          continue
        }
        throw e
      }
    }
  })

  // Viewer username: resolved once, memoized as a Promise<string>.
  // Caching the promise (not the resolved value) prevents a race condition
  // where two concurrent method calls both trigger the viewer query.
  let viewerPromise: Promise<string> | null = null

  function getViewer(): Promise<string> {
    if (!viewerPromise) {
      viewerPromise = gql<{ viewer: { login: string } }>(VIEWER_QUERY)
        .then((data) => data.viewer.login)
        .catch((e: unknown) => {
          // Reset cache on error so transient failures don't permanently break the client
          viewerPromise = null
          throw e
        })
    }
    return viewerPromise
  }

  // Org logins: resolved once, memoized as a Promise<Set<string>>.
  // Same caching pattern as getViewer to avoid duplicate fetches.
  let orgLoginsPromise: Promise<Set<string>> | null = null

  async function getOrgLogins(): Promise<Set<string>> {
    if (!orgLoginsPromise) {
      orgLoginsPromise = (async () => {
        const login = await getViewer()
        const logins = new Set<string>()
        try {
          for await (const page of octokit.graphql.paginate.iterator<RawOrgsPage>(
            ORGS_QUERY,
            { login },
          )) {
            for (const node of page.user.organizations.nodes ?? []) {
              if (node) logins.add(node.login)
            }
          }
        } catch (e: unknown) {
          orgLoginsPromise = null
          throw e
        }
        return logins
      })()
    }
    return orgLoginsPromise
  }

  function buildDateRange(year?: number): string {
    if (year !== undefined) {
      return `committer-date:${year}-01-01..${year}-12-31`
    }
    const now = new Date()
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(now.getFullYear() - 1)
    return `committer-date:${oneYearAgo.toISOString().slice(0, 10)}..${now.toISOString().slice(0, 10)}`
  }

  // Fetch all commits from the REST search API for a given query, paginating up to 1000 results.
  async function searchCommits(q: string): Promise<
    Array<{
      sha: string
      url: string
      message: string
      date: string
      repoName: string
      repoNameWithOwner: string
      repoUrl: string
      isFork: boolean
    }>
  > {
    const commits: Array<{
      sha: string
      url: string
      message: string
      date: string
      repoName: string
      repoNameWithOwner: string
      repoUrl: string
      isFork: boolean
    }> = []
    let page = 1
    while (page <= 10) {
      const response = await octokit.request('GET /search/commits', {
        q,
        per_page: 100,
        page,
        sort: 'committer-date',
      })
      for (const item of response.data.items) {
        commits.push({
          sha: item.sha,
          url: item.html_url,
          message: item.commit.message.split('\n')[0],
          date: item.commit.author?.date ?? item.commit.committer?.date ?? '',
          repoName: item.repository.name,
          repoNameWithOwner: item.repository.full_name,
          repoUrl: item.repository.html_url,
          isFork: item.repository.fork,
        })
      }
      if (response.data.items.length < 100) break
      page++
    }
    return commits
  }

  // Batch-fetch stargazerCount for repos via GraphQL aliased query.
  async function fetchStarCounts(
    repos: string[],
  ): Promise<Map<string, number>> {
    if (repos.length === 0) return new Map()
    const fragments = repos
      .map((nwo, i) => {
        const [owner, name] = nwo.split('/')
        return `r${i}: repository(owner: "${owner}", name: "${name}") { stargazerCount }`
      })
      .join('\n')
    const data = await gql<Record<string, { stargazerCount: number } | null>>(
      `query { ${fragments} }`,
    )
    const result = new Map<string, number>()
    repos.forEach((nwo, i) => {
      result.set(nwo, data[`r${i}`]?.stargazerCount ?? 0)
    })
    return result
  }

  // Supplement contributions with REST commit search when the GraphQL 100-repo cap
  // causes public repos to be dropped (private repos fill the slots first).
  async function supplementFromSearch(
    login: string,
    results: Contribution[],
    matchesSource: (owner: string) => boolean,
    includeCommits: boolean,
    includeForks: boolean,
    year?: number,
  ): Promise<void> {
    const known = new Map<string, Contribution>()
    for (const r of results) known.set(r.repoNameWithOwner, r)

    // First pass: collect all commits grouped by repo, tracking SHA → repos for dedup
    const repoCommits = new Map<
      string,
      {
        name: string
        url: string
        isFork: boolean
        commits: Array<{ sha: string; commit: ContributionCommit }>
      }
    >()
    const shaToRepos = new Map<string, string[]>() // sha → list of repoNameWithOwner

    const q = `author:${login} ${buildDateRange(year)} is:public`
    const rawCommits = await searchCommits(q)

    for (const c of rawCommits) {
      if (!includeForks && c.isFork) continue
      const owner = c.repoNameWithOwner.split('/')[0]
      if (!matchesSource(owner)) continue

      const commit: ContributionCommit = {
        sha: c.sha,
        url: c.url,
        message: c.message,
        date: c.date,
      }

      // Track which repos each SHA appears in
      const repos = shaToRepos.get(c.sha)
      if (repos) {
        repos.push(c.repoNameWithOwner)
      } else {
        shaToRepos.set(c.sha, [c.repoNameWithOwner])
      }

      // Collect commits per repo
      const existing = repoCommits.get(c.repoNameWithOwner)
      if (existing) {
        existing.commits.push({ sha: c.sha, commit })
      } else {
        repoCommits.set(c.repoNameWithOwner, {
          name: c.repoName,
          url: c.repoUrl,
          isFork: c.isFork,
          commits: [{ sha: c.sha, commit }],
        })
      }
    }

    // Fetch star counts for all repos found in search (needed for dedup ranking)
    const newRepos = [...repoCommits.keys()].filter((nwo) => !known.has(nwo))
    const stars = await fetchStarCounts(newRepos)

    // Also collect star counts for known repos (from results)
    for (const [nwo, r] of known) {
      stars.set(nwo, r.stargazerCount)
    }

    // Deduplicate pass 1: identical SHAs across repos → keep highest-starred
    const droppedShas = new Set<string>()
    for (const [sha, repos] of shaToRepos) {
      if (repos.length <= 1) continue
      let bestRepo = repos[0]
      let bestStars = stars.get(bestRepo) ?? 0
      for (let i = 1; i < repos.length; i++) {
        const s = stars.get(repos[i]) ?? 0
        if (s > bestStars) {
          bestRepo = repos[i]
          bestStars = s
        }
      }
      for (const repo of repos) {
        if (repo !== bestRepo) {
          droppedShas.add(`${repo}:${sha}`)
        }
      }
    }

    // Deduplicate pass 2: subtree splits — same owner + same commit message → keep highest-starred
    // Monorepos like symfony/symfony split into sub-repos (symfony/http-kernel, etc.)
    // with different SHAs but identical commit messages.
    // Key: "owner\0message" → Map<repoNameWithOwner, sha[]>
    const ownerMsgMap = new Map<string, Map<string, string[]>>()
    for (const [nwo, repo] of repoCommits) {
      const owner = nwo.split('/')[0]
      for (const c of repo.commits) {
        if (droppedShas.has(`${nwo}:${c.sha}`)) continue
        const key = `${owner}\0${c.commit.message}`
        let repoMap = ownerMsgMap.get(key)
        if (!repoMap) {
          repoMap = new Map()
          ownerMsgMap.set(key, repoMap)
        }
        const shas = repoMap.get(nwo)
        if (shas) {
          shas.push(c.sha)
        } else {
          repoMap.set(nwo, [c.sha])
        }
      }
    }
    for (const [, repoMap] of ownerMsgMap) {
      if (repoMap.size <= 1) continue
      // Find repo with most stars
      let bestRepo = ''
      let bestStars = -1
      for (const nwo of repoMap.keys()) {
        const s = stars.get(nwo) ?? 0
        if (s > bestStars) {
          bestRepo = nwo
          bestStars = s
        }
      }
      // Drop commits from non-best repos
      for (const [nwo, shas] of repoMap) {
        if (nwo === bestRepo) continue
        for (const sha of shas) {
          droppedShas.add(`${nwo}:${sha}`)
        }
      }
    }

    // Attach commits to known results and build missing contributions
    for (const [nwo, repo] of repoCommits) {
      const validCommits = repo.commits.filter(
        (c) => !droppedShas.has(`${nwo}:${c.sha}`),
      )
      if (validCommits.length === 0) continue

      if (known.has(nwo)) {
        if (includeCommits) {
          const existing = known.get(nwo)!
          if (!existing.commits) existing.commits = []
          existing.commits.push(...validCommits.map((c) => c.commit))
        }
        continue
      }

      const contribution: Contribution = {
        repoName: repo.name,
        repoNameWithOwner: nwo,
        repoUrl: repo.url,
        commitCount: validCommits.length,
        stargazerCount: stars.get(nwo) ?? 0,
        occurredAt: validCommits.reduce(
          (max, c) => (c.commit.date > max ? c.commit.date : max),
          validCommits[0].commit.date,
        ),
      }
      if (includeCommits)
        contribution.commits = validCommits.map((c) => c.commit)
      results.push(contribution)
    }
  }

  // Fetch and attach commits to existing contributions via REST search.
  async function attachCommits(
    login: string,
    results: Contribution[],
    year?: number,
  ): Promise<void> {
    const byRepo = new Map<string, Contribution>()
    for (const r of results) byRepo.set(r.repoNameWithOwner, r)

    const q = `author:${login} ${buildDateRange(year)} is:public`
    const commits = await searchCommits(q)

    for (const c of commits) {
      const contribution = byRepo.get(c.repoNameWithOwner)
      if (!contribution) continue
      if (!contribution.commits) contribution.commits = []
      contribution.commits.push({
        sha: c.sha,
        url: c.url,
        message: c.message,
        date: c.date,
      })
    }
  }

  return {
    async profile(): Promise<Profile> {
      try {
        const data = await gql<{ viewer: RawProfileUser }>(PROFILE_QUERY)
        // Seed viewer cache from profile response — avoids redundant viewer query for future methods
        if (!viewerPromise) {
          viewerPromise = Promise.resolve(data.viewer.login)
        }
        return mapProfile(data.viewer)
      } catch (e: unknown) {
        wrapError(e)
      }
    },

    async repo(nameWithOwner: string): Promise<Repo> {
      const parts = nameWithOwner.split('/')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new TypeError(
          `Invalid repository identifier: "${nameWithOwner}" — expected "owner/name"`,
        )
      }
      const [owner, name] = parts
      try {
        const data = await gql<{ repository: RawRepoNode | null }>(REPO_QUERY, {
          owner,
          name,
        })
        if (!data.repository) {
          throw new NotFoundError(`Repository not found: ${nameWithOwner}`)
        }
        return mapRepo(data.repository)
      } catch (e: unknown) {
        wrapError(e)
      }
    },

    async repos(
      opts: {
        count?: number
        orderBy?: {
          field:
            | 'CREATED_AT'
            | 'UPDATED_AT'
            | 'PUSHED_AT'
            | 'NAME'
            | 'STARGAZERS'
          direction: 'ASC' | 'DESC'
        }
      } = {},
    ): Promise<Repo[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const orderBy = opts.orderBy ?? { field: 'PUSHED_AT', direction: 'DESC' }
      const results: Repo[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawReposPage>(
          REPOS_QUERY,
          { login, isFork: false, orderBy },
        )) {
          const nodes = page.user.repositories.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            // CLI-05: exclude meta-repo (username/username)
            if (node.nameWithOwner === `${login}/${login}`) continue
            const mapped = mapRepo(node)
            results.push(mapped)
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async forks(
      opts: {
        count?: number
        orderBy?: {
          field:
            | 'CREATED_AT'
            | 'UPDATED_AT'
            | 'PUSHED_AT'
            | 'NAME'
            | 'STARGAZERS'
          direction: 'ASC' | 'DESC'
        }
      } = {},
    ): Promise<Repo[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const orderBy = opts.orderBy ?? { field: 'PUSHED_AT', direction: 'DESC' }
      const results: Repo[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawReposPage>(
          REPOS_QUERY,
          { login, isFork: true, orderBy },
        )) {
          const nodes = page.user.repositories.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            // CLI-05: exclude meta-repo (username/username)
            if (node.nameWithOwner === `${login}/${login}`) continue
            const mapped = mapRepo(node)
            results.push(mapped)
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async pullRequests(
      opts: {
        count?: number
        state?: 'OPEN' | 'CLOSED' | 'MERGED'
        orderBy?: {
          field: 'CREATED_AT' | 'UPDATED_AT' | 'COMMENTS'
          direction: 'ASC' | 'DESC'
        }
        includePrivate?: boolean
      } = {},
    ): Promise<PullRequest[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const state = opts.state ?? 'MERGED'
      const orderBy = opts.orderBy ?? { field: 'CREATED_AT', direction: 'DESC' }
      const includePrivate = opts.includePrivate ?? false
      const results: PullRequest[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawPullRequestsPage>(
          PULL_REQUESTS_QUERY,
          { login, state, orderBy },
        )) {
          const nodes = page.user.pullRequests.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            if (!includePrivate && node.repository.isPrivate) continue
            results.push(mapPullRequest(node))
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async issues(
      opts: {
        count?: number
        state?: 'OPEN' | 'CLOSED'
        includePrivate?: boolean
        orderBy?: {
          field: 'CREATED_AT' | 'UPDATED_AT' | 'COMMENTS'
          direction: 'ASC' | 'DESC'
        }
      } = {},
    ): Promise<Issue[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const state = opts.state ?? 'OPEN'
      const includePrivate = opts.includePrivate ?? false
      const orderBy = opts.orderBy ?? { field: 'CREATED_AT', direction: 'DESC' }
      const results: Issue[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawIssuesPage>(
          ISSUES_QUERY,
          { login, state, orderBy },
        )) {
          const nodes = page.user.issues.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            if (!includePrivate && node.repository.isPrivate) continue
            results.push(mapIssue(node))
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async stars(
      opts: {
        count?: number
        includePrivate?: boolean
        orderBy?: { field: 'STARRED_AT'; direction: 'ASC' | 'DESC' }
      } = {},
    ): Promise<Star[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const includePrivate = opts.includePrivate ?? false
      const orderBy = opts.orderBy ?? { field: 'STARRED_AT', direction: 'DESC' }
      const results: Star[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawStarsPage>(
          STARS_QUERY,
          { login, orderBy },
        )) {
          const edges = page.user.starredRepositories.edges ?? []
          for (const edge of edges) {
            if (!edge) continue
            if (!includePrivate && edge.node.isPrivate) continue
            results.push(mapStar(edge))
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async gists(
      opts: {
        count?: number
        orderBy?: {
          field: 'CREATED_AT' | 'UPDATED_AT' | 'PUSHED_AT'
          direction: 'ASC' | 'DESC'
        }
      } = {},
    ): Promise<Gist[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const orderBy = opts.orderBy ?? { field: 'CREATED_AT', direction: 'DESC' }
      const results: Gist[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawGistsPage>(
          GISTS_QUERY,
          { login, orderBy },
        )) {
          const nodes = page.user.gists.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            results.push(mapGist(node))
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async followers(opts: { count?: number } = {}): Promise<User[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const results: User[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawFollowersPage>(
          FOLLOWERS_QUERY,
          { login },
        )) {
          const nodes = page.user.followers.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            results.push(mapUser(node))
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async following(opts: { count?: number } = {}): Promise<User[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const results: User[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawFollowingPage>(
          FOLLOWING_QUERY,
          { login },
        )) {
          const nodes = page.user.following.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            results.push(mapUser(node))
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async organizations(
      opts: { count?: number } = {},
    ): Promise<Organization[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const results: Organization[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawOrgsPage>(
          ORGS_QUERY,
          { login },
        )) {
          const nodes = page.user.organizations.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            results.push(mapOrganization(node))
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async pinnedRepos(): Promise<Repo[]> {
      const login = await getViewer()
      try {
        const data = await gql<RawPinnedReposResponse>(PINNED_REPOS_QUERY, {
          login,
        })
        return mapPinnedRepos(data.user.pinnedItems.nodes ?? [])
      } catch (e: unknown) {
        wrapError(e)
      }
    },

    async contributions(
      opts: {
        count?: number
        year?: number
        from?: number
        to?: number
        includePrivate?: boolean
        includeForks?: boolean
        source?: ContributionSource[]
        includeCommits?: boolean
      } = {},
    ): Promise<Contribution[]> {
      const login = await getViewer()
      const count = opts.count
      const includePrivate = opts.includePrivate ?? false
      const includeForks = opts.includeForks ?? false
      const source = opts.source ?? ['owned', 'org', 'external']
      const includeCommits = opts.includeCommits ?? false

      // Build list of years to fetch
      let years: number[]
      if (opts.from !== undefined || opts.to !== undefined) {
        const fromYear = opts.from ?? opts.to!
        const toYear = opts.to ?? opts.from!
        years = []
        for (let y = fromYear; y <= toYear; y++) years.push(y)
      } else if (opts.year !== undefined) {
        years = [opts.year]
      } else {
        years = [] // empty = use default (last 365 days)
      }

      // Only fetch org logins if we need to distinguish org vs external
      const needsOrgCheck = !(
        source.includes('org') && source.includes('external')
      )
      const orgLogins = needsOrgCheck ? await getOrgLogins() : new Set<string>()

      const matchesSource = (owner: string) => {
        if (owner === login) return source.includes('owned')
        if (orgLogins.has(owner)) return source.includes('org')
        return source.includes('external')
      }

      const filterAndMap = (
        collection: RawContributionsResponse['user']['contributionsCollection'],
      ) =>
        collection.commitContributionsByRepository
          .filter((r) => {
            if (!includePrivate && r.repository.isPrivate) return false
            if (!includeForks && r.repository.isFork) return false
            return matchesSource(r.repository.owner.login)
          })
          .map((r) => mapContribution(r, collection.startedAt))

      // Whether we need the REST search: supplement cap OR fetch commits
      const needsSearch = !includePrivate || includeCommits

      try {
        if (years.length === 0) {
          const data = await gql<RawContributionsResponse>(
            CONTRIBUTIONS_QUERY,
            { login },
          )
          const collection = data.user.contributionsCollection
          const results = filterAndMap(collection)
          const capped =
            collection.commitContributionsByRepository.length >= 100
          if (needsSearch || capped || includeCommits) {
            await supplementFromSearch(
              login,
              results,
              matchesSource,
              includeCommits,
              includeForks,
            )
          }
          results.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          return count !== undefined ? results.slice(0, count) : results
        }

        // Fetch each year and merge, deduplicating by repoNameWithOwner (summing commits)
        const merged = new Map<string, Contribution>()
        const searchYears: number[] = []
        for (const year of years) {
          const data = await gql<RawContributionsResponse>(
            CONTRIBUTIONS_QUERY,
            {
              login,
              from: `${year}-01-01T00:00:00Z`,
              to: `${year}-12-31T23:59:59Z`,
            },
          )
          const collection = data.user.contributionsCollection
          const capped =
            collection.commitContributionsByRepository.length >= 100
          // Always supplement when excluding private repos: GraphQL counts private
          // repos toward the 100-repo cap, so public repos can be silently dropped
          // even when the total is under 100 (we can't see the private ones).
          if (!includePrivate || capped || includeCommits) {
            searchYears.push(year)
          }
          for (const c of filterAndMap(collection)) {
            const existing = merged.get(c.repoNameWithOwner)
            if (existing) {
              existing.commitCount += c.commitCount
            } else {
              merged.set(c.repoNameWithOwner, { ...c })
            }
          }
        }

        // Supplement with REST search for capped years or to fetch commits
        if (searchYears.length > 0) {
          const results = [...merged.values()]
          for (const year of searchYears) {
            await supplementFromSearch(
              login,
              results,
              matchesSource,
              includeCommits,
              includeForks,
              year,
            )
          }
          // Re-merge into map after supplementing
          merged.clear()
          for (const c of results) {
            const existing = merged.get(c.repoNameWithOwner)
            if (existing) {
              existing.commitCount += c.commitCount
              if (c.commits) {
                if (!existing.commits) existing.commits = []
                existing.commits.push(...c.commits)
              }
            } else {
              merged.set(c.repoNameWithOwner, c)
            }
          }
        }

        const results = [...merged.values()]
        results.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        return count !== undefined ? results.slice(0, count) : results
      } catch (e: unknown) {
        wrapError(e)
      }
    },

    async contributionStats(
      opts: { year?: number } = {},
    ): Promise<ContributionStats> {
      const login = await getViewer()
      const variables: { login: string; from?: string; to?: string } = { login }
      if (opts.year !== undefined) {
        variables.from = `${opts.year}-01-01T00:00:00Z`
        variables.to = `${opts.year}-12-31T23:59:59Z`
      }
      try {
        const data = await gql<RawContributionStatsResponse>(
          CONTRIBUTION_STATS_QUERY,
          variables,
        )
        return mapContributionStats(data.user.contributionsCollection)
      } catch (e: unknown) {
        wrapError(e)
      }
    },

    async languages(): Promise<Language[]> {
      const login = await getViewer()
      const langMap = new Map<string, { bytes: number; color: string | null }>()
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawReposWithLanguagesPage>(
          REPOS_WITH_LANGUAGES_QUERY,
          { login },
        )) {
          const nodes = page.user.repositories.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            // CLI-05: exclude meta-repo (username/username)
            if (node.nameWithOwner === `${login}/${login}`) continue
            for (const edge of node.languages?.edges ?? []) {
              if (!edge) continue
              const name = edge.node.name
              const existing = langMap.get(name)
              if (existing) {
                existing.bytes += edge.size
              } else {
                langMap.set(name, { bytes: edge.size, color: edge.node.color })
              }
            }
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      const totalBytes = [...langMap.values()].reduce(
        (sum, l) => sum + l.bytes,
        0,
      )
      if (totalBytes === 0) return []
      return [...langMap.entries()]
        .sort((a, b) => b[1].bytes - a[1].bytes)
        .map(([name, { bytes, color }]) => ({
          name,
          color,
          bytes,
          percentage: Math.round((bytes / totalBytes) * 10000) / 100,
        }))
    },

    async sponsors(opts: { count?: number } = {}): Promise<Sponsor[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const results: Sponsor[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawSponsorsPage>(
          SPONSORS_QUERY,
          { login },
        )) {
          const nodes = page.user.sponsorshipsAsMaintainer.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            const mapped = mapSponsorship(node)
            if (!mapped) continue
            results.push(mapped)
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async sponsoring(opts: { count?: number } = {}): Promise<Sponsor[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const results: Sponsor[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawSponsoringPage>(
          SPONSORING_QUERY,
          { login },
        )) {
          const nodes = page.user.sponsorshipsAsSponsor.nodes ?? []
          for (const node of nodes) {
            if (!node) continue
            const mapped = mapSponsorship(node)
            if (!mapped) continue
            results.push(mapped)
            if (results.length >= count) return results
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      return results
    },

    async releases(
      opts: { count?: number; includePrivate?: boolean } = {},
    ): Promise<Release[]> {
      const login = await getViewer()
      const count = opts.count ?? 100
      const includePrivate = opts.includePrivate ?? false
      const allReleases: Release[] = []
      try {
        for await (const page of octokit.graphql.paginate.iterator<RawReleasesPage>(
          RELEASES_QUERY,
          { login },
        )) {
          const nodes = page.user.repositoriesContributedTo.nodes ?? []
          for (const repo of nodes) {
            if (!repo) continue
            if (!includePrivate && repo.isPrivate) continue
            const releaseNode = repo.releases?.nodes?.[0]
            if (!releaseNode) continue
            allReleases.push(mapRelease(releaseNode, repo))
          }
        }
      } catch (e: unknown) {
        wrapError(e)
      }
      // Client-side sort: publishedAt descending (ISO 8601 strings sort lexicographically)
      // null publishedAt values are sorted to the end
      allReleases.sort((a, b) => {
        if (!a.publishedAt && !b.publishedAt) return 0
        if (!a.publishedAt) return 1
        if (!b.publishedAt) return -1
        return b.publishedAt.localeCompare(a.publishedAt)
      })
      return allReleases.slice(0, count)
    },

    // getViewer is exposed for internal use in future methods (Phase 4+)
    _getViewer: getViewer,
  }
}
