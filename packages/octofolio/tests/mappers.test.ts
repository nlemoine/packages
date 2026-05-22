import { describe, expect, it } from 'vitest'
import type { RawProfileUser } from '../src/mappers.js'
import { mapProfile } from '../src/mappers.js'

function makeRawProfile(overrides?: Partial<RawProfileUser>): RawProfileUser {
  const defaults: RawProfileUser = {
    login: 'test-user',
    name: 'Test User',
    bio: 'A bio',
    avatarUrl: 'https://avatar.example.com/u/1',
    url: 'https://github.com/test-user',
    email: 'test@example.com',
    location: 'Earth',
    company: '@test-co',
    websiteUrl: 'https://example.com',
    twitterUsername: 'testuser',
    createdAt: '2020-01-01T00:00:00Z',
    followers: { totalCount: 42 },
    following: { totalCount: 10 },
    socialAccounts: {
      nodes: [
        {
          provider: 'TWITTER',
          displayName: '@testuser',
          url: 'https://twitter.com/testuser',
        },
      ],
    },
  }
  return { ...defaults, ...overrides }
}

describe('mapProfile', () => {
  it('returns correct flat Profile from a complete raw input', () => {
    const raw = makeRawProfile()
    const result = mapProfile(raw)

    expect(result.login).toBe('test-user')
    expect(result.name).toBe('Test User')
    expect(result.bio).toBe('A bio')
    expect(result.avatarUrl).toBe('https://avatar.example.com/u/1')
    expect(result.url).toBe('https://github.com/test-user')
    expect(result.email).toBe('test@example.com')
    expect(result.location).toBe('Earth')
    expect(result.company).toBe('@test-co')
    expect(result.websiteUrl).toBe('https://example.com')
    expect(result.twitterUsername).toBe('testuser')
    expect(result.createdAt).toBe('2020-01-01T00:00:00Z')
    expect(result.socialAccounts).toEqual([
      {
        provider: 'TWITTER',
        displayName: '@testuser',
        url: 'https://twitter.com/testuser',
      },
    ])
  })

  it('handles null socialAccounts.nodes (returns empty array)', () => {
    const raw = makeRawProfile({ socialAccounts: { nodes: null } })
    const result = mapProfile(raw)
    expect(result.socialAccounts).toEqual([])
  })

  it('handles empty socialAccounts.nodes array (returns empty array)', () => {
    const raw = makeRawProfile({ socialAccounts: { nodes: [] } })
    const result = mapProfile(raw)
    expect(result.socialAccounts).toEqual([])
  })

  it('filters out null entries in socialAccounts.nodes array', () => {
    const raw = makeRawProfile({
      socialAccounts: {
        nodes: [
          null,
          {
            provider: 'LINKEDIN',
            displayName: 'Test User',
            url: 'https://linkedin.com/in/testuser',
          },
          null,
        ],
      },
    })
    const result = mapProfile(raw)
    expect(result.socialAccounts).toEqual([
      {
        provider: 'LINKEDIN',
        displayName: 'Test User',
        url: 'https://linkedin.com/in/testuser',
      },
    ])
  })

  it('correctly flattens followers.totalCount to followersCount', () => {
    const raw = makeRawProfile({ followers: { totalCount: 42 } })
    const result = mapProfile(raw)
    expect(result.followersCount).toBe(42)
  })

  it('correctly flattens following.totalCount to followingCount', () => {
    const raw = makeRawProfile({ following: { totalCount: 10 } })
    const result = mapProfile(raw)
    expect(result.followingCount).toBe(10)
  })

  it('preserves null values for nullable fields', () => {
    const raw = makeRawProfile({
      name: null,
      bio: null,
      location: null,
      company: null,
      websiteUrl: null,
      twitterUsername: null,
    })
    const result = mapProfile(raw)
    expect(result.name).toBeNull()
    expect(result.bio).toBeNull()
    expect(result.location).toBeNull()
    expect(result.company).toBeNull()
    expect(result.websiteUrl).toBeNull()
    expect(result.twitterUsername).toBeNull()
  })
})

import type {
  RawCommitContributionsByRepo,
  RawContributionStatsCollection,
  RawGistNode,
  RawIssueNode,
  RawOrganizationNode,
  RawPinnedItemNode,
  RawPullRequestNode,
  RawRepoNode,
  RawStarEdge,
  RawUserNode,
} from '../src/mappers.js'
import {
  mapContribution,
  mapContributionStats,
  mapGist,
  mapIssue,
  mapOrganization,
  mapPinnedRepos,
  mapPullRequest,
  mapRepo,
  mapStar,
  mapUser,
} from '../src/mappers.js'

function makeRawRepo(overrides?: Partial<RawRepoNode>): RawRepoNode {
  const defaults: RawRepoNode = {
    name: 'hello-world',
    nameWithOwner: 'octocat/hello-world',
    url: 'https://github.com/octocat/hello-world',
    description: 'My first repository on GitHub!',
    isPrivate: false,
    isFork: false,
    stargazerCount: 1500,
    forkCount: 200,
    primaryLanguage: { name: 'JavaScript', color: '#f1e05a' },
    repositoryTopics: { nodes: [{ topic: { name: 'javascript' } }] },
    createdAt: '2011-01-26T19:01:12Z',
    pushedAt: '2022-03-10T00:00:00Z',
    latestRelease: {
      tagName: 'v1.0.0',
      name: 'First Release',
      publishedAt: '2022-01-01T00:00:00Z',
      url: 'https://github.com/octocat/hello-world/releases/tag/v1.0.0',
    },
  }
  return { ...defaults, ...overrides }
}

describe('mapRepo', () => {
  it('returns correct flat Repo from a complete raw input', () => {
    const raw = makeRawRepo()
    const result = mapRepo(raw)

    expect(result.name).toBe('hello-world')
    expect(result.nameWithOwner).toBe('octocat/hello-world')
    expect(result.url).toBe('https://github.com/octocat/hello-world')
    expect(result.description).toBe('My first repository on GitHub!')
    expect(result.isPrivate).toBe(false)
    expect(result.isFork).toBe(false)
    expect(result.stargazerCount).toBe(1500)
    expect(result.forkCount).toBe(200)
    expect(result.primaryLanguage).toBe('JavaScript')
    expect(result.primaryLanguageColor).toBe('#f1e05a')
    expect(result.topics).toEqual(['javascript'])
    expect(result.createdAt).toBe('2011-01-26T19:01:12Z')
    expect(result.pushedAt).toBe('2022-03-10T00:00:00Z')
    expect(result.lastRelease).toEqual({
      tagName: 'v1.0.0',
      name: 'First Release',
      publishedAt: '2022-01-01T00:00:00Z',
      url: 'https://github.com/octocat/hello-world/releases/tag/v1.0.0',
      repoName: 'hello-world',
      repoNameWithOwner: 'octocat/hello-world',
      repoUrl: 'https://github.com/octocat/hello-world',
    })
  })

  it('returns primaryLanguage: null and primaryLanguageColor: null when primaryLanguage is null', () => {
    const raw = makeRawRepo({ primaryLanguage: null })
    const result = mapRepo(raw)
    expect(result.primaryLanguage).toBeNull()
    expect(result.primaryLanguageColor).toBeNull()
  })

  it('returns lastRelease: null when latestRelease is null', () => {
    const raw = makeRawRepo({ latestRelease: null })
    const result = mapRepo(raw)
    expect(result.lastRelease).toBeNull()
  })

  it('returns lastRelease with repo fields populated from repo when latestRelease is present', () => {
    const raw = makeRawRepo()
    const result = mapRepo(raw)
    expect(result.lastRelease?.repoName).toBe('hello-world')
    expect(result.lastRelease?.repoNameWithOwner).toBe('octocat/hello-world')
    expect(result.lastRelease?.repoUrl).toBe(
      'https://github.com/octocat/hello-world',
    )
  })

  it('filters out null entries in repositoryTopics.nodes', () => {
    const raw = makeRawRepo({
      repositoryTopics: {
        nodes: [
          null,
          { topic: { name: 'typescript' } },
          null,
          { topic: { name: 'node' } },
        ],
      },
    })
    const result = mapRepo(raw)
    expect(result.topics).toEqual(['typescript', 'node'])
  })

  it('returns topics: [] when repositoryTopics.nodes is empty', () => {
    const raw = makeRawRepo({ repositoryTopics: { nodes: [] } })
    const result = mapRepo(raw)
    expect(result.topics).toEqual([])
  })

  it('returns topics: [] when repositoryTopics.nodes is null', () => {
    const raw = makeRawRepo({ repositoryTopics: { nodes: null } })
    const result = mapRepo(raw)
    expect(result.topics).toEqual([])
  })

  it('preserves null pushedAt', () => {
    const raw = makeRawRepo({ pushedAt: null })
    const result = mapRepo(raw)
    expect(result.pushedAt).toBeNull()
  })
})

// ─── mapPullRequest ────────────────────────────────────────────────────────────

function makeRawPullRequest(
  overrides?: Partial<RawPullRequestNode>,
): RawPullRequestNode {
  const defaults: RawPullRequestNode = {
    title: 'Fix the bug',
    url: 'https://github.com/octocat/hello-world/pull/42',
    state: 'MERGED',
    createdAt: '2023-01-10T12:00:00Z',
    additions: 50,
    deletions: 10,
    repository: {
      nameWithOwner: 'octocat/hello-world',
      url: 'https://github.com/octocat/hello-world',
      isPrivate: false,
    },
  }
  return { ...defaults, ...overrides }
}

describe('mapPullRequest', () => {
  it('returns correct flat PullRequest from a complete raw input', () => {
    const raw = makeRawPullRequest()
    const result = mapPullRequest(raw)

    expect(result.title).toBe('Fix the bug')
    expect(result.url).toBe('https://github.com/octocat/hello-world/pull/42')
    expect(result.state).toBe('MERGED')
    expect(result.createdAt).toBe('2023-01-10T12:00:00Z')
    expect(result.additions).toBe(50)
    expect(result.deletions).toBe(10)
    expect(result.repoNameWithOwner).toBe('octocat/hello-world')
    expect(result.repoUrl).toBe('https://github.com/octocat/hello-world')
  })

  it('correctly flattens repository.nameWithOwner to repoNameWithOwner', () => {
    const raw = makeRawPullRequest({
      repository: {
        nameWithOwner: 'other/repo',
        url: 'https://github.com/other/repo',
        isPrivate: false,
      },
    })
    const result = mapPullRequest(raw)
    expect(result.repoNameWithOwner).toBe('other/repo')
  })

  it('correctly flattens repository.url to repoUrl', () => {
    const raw = makeRawPullRequest({
      repository: {
        nameWithOwner: 'other/repo',
        url: 'https://github.com/other/repo',
        isPrivate: false,
      },
    })
    const result = mapPullRequest(raw)
    expect(result.repoUrl).toBe('https://github.com/other/repo')
  })

  it('returns state OPEN for OPEN pull request', () => {
    const raw = makeRawPullRequest({ state: 'OPEN' })
    const result = mapPullRequest(raw)
    expect(result.state).toBe('OPEN')
  })

  it('returns state CLOSED for CLOSED pull request', () => {
    const raw = makeRawPullRequest({ state: 'CLOSED' })
    const result = mapPullRequest(raw)
    expect(result.state).toBe('CLOSED')
  })
})

// ─── mapIssue ─────────────────────────────────────────────────────────────────

function makeRawIssue(overrides?: Partial<RawIssueNode>): RawIssueNode {
  const defaults: RawIssueNode = {
    title: 'Found a bug',
    url: 'https://github.com/octocat/hello-world/issues/7',
    state: 'OPEN',
    createdAt: '2023-02-15T09:00:00Z',
    number: 7,
    comments: { totalCount: 3 },
    repository: {
      nameWithOwner: 'octocat/hello-world',
      url: 'https://github.com/octocat/hello-world',
      isPrivate: false,
    },
  }
  return { ...defaults, ...overrides }
}

describe('mapIssue', () => {
  it('returns correct flat Issue from a complete raw input', () => {
    const raw = makeRawIssue()
    const result = mapIssue(raw)

    expect(result.title).toBe('Found a bug')
    expect(result.url).toBe('https://github.com/octocat/hello-world/issues/7')
    expect(result.state).toBe('OPEN')
    expect(result.createdAt).toBe('2023-02-15T09:00:00Z')
    expect(result.number).toBe(7)
    expect(result.commentsCount).toBe(3)
    expect(result.repoNameWithOwner).toBe('octocat/hello-world')
    expect(result.repoUrl).toBe('https://github.com/octocat/hello-world')
  })

  it('correctly flattens comments.totalCount to commentsCount', () => {
    const raw = makeRawIssue({ comments: { totalCount: 99 } })
    const result = mapIssue(raw)
    expect(result.commentsCount).toBe(99)
  })

  it('correctly flattens repository.nameWithOwner to repoNameWithOwner', () => {
    const raw = makeRawIssue({
      repository: {
        nameWithOwner: 'foo/bar',
        url: 'https://github.com/foo/bar',
        isPrivate: false,
      },
    })
    const result = mapIssue(raw)
    expect(result.repoNameWithOwner).toBe('foo/bar')
  })

  it('returns state CLOSED for CLOSED issue', () => {
    const raw = makeRawIssue({ state: 'CLOSED' })
    const result = mapIssue(raw)
    expect(result.state).toBe('CLOSED')
  })
})

// ─── mapStar ──────────────────────────────────────────────────────────────────

function makeRawStar(overrides?: Partial<RawStarEdge>): RawStarEdge {
  const defaults: RawStarEdge = {
    starredAt: '2023-03-01T00:00:00Z',
    node: {
      name: 'awesome-lib',
      nameWithOwner: 'someone/awesome-lib',
      url: 'https://github.com/someone/awesome-lib',
      description: 'An awesome library',
      isPrivate: false,
      stargazerCount: 5000,
      primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
    },
  }
  // Deep merge node overrides
  if (overrides?.node) {
    return {
      ...defaults,
      ...overrides,
      node: { ...defaults.node, ...overrides.node },
    }
  }
  return { ...defaults, ...overrides }
}

describe('mapStar', () => {
  it('returns correct flat Star from a complete raw edge', () => {
    const raw = makeRawStar()
    const result = mapStar(raw)

    expect(result.starredAt).toBe('2023-03-01T00:00:00Z')
    expect(result.repoName).toBe('awesome-lib')
    expect(result.repoNameWithOwner).toBe('someone/awesome-lib')
    expect(result.repoUrl).toBe('https://github.com/someone/awesome-lib')
    expect(result.description).toBe('An awesome library')
    expect(result.stargazerCount).toBe(5000)
    expect(result.primaryLanguage).toBe('TypeScript')
  })

  it('returns starredAt from edge level (not from node)', () => {
    const raw = makeRawStar({ starredAt: '2024-06-01T00:00:00Z' })
    const result = mapStar(raw)
    expect(result.starredAt).toBe('2024-06-01T00:00:00Z')
  })

  it('returns primaryLanguage: null when primaryLanguage is null', () => {
    const raw = makeRawStar({
      node: {
        name: 'awesome-lib',
        nameWithOwner: 'someone/awesome-lib',
        url: 'https://github.com/someone/awesome-lib',
        description: null,
        isPrivate: false,
        stargazerCount: 100,
        primaryLanguage: null,
      },
    })
    const result = mapStar(raw)
    expect(result.primaryLanguage).toBeNull()
  })

  it('returns description: null when description is null', () => {
    const raw = makeRawStar({
      node: {
        name: 'awesome-lib',
        nameWithOwner: 'someone/awesome-lib',
        url: 'https://github.com/someone/awesome-lib',
        description: null,
        isPrivate: false,
        stargazerCount: 100,
        primaryLanguage: null,
      },
    })
    const result = mapStar(raw)
    expect(result.description).toBeNull()
  })
})

// ─── mapGist ──────────────────────────────────────────────────────────────────

function makeRawGist(overrides?: Partial<RawGistNode>): RawGistNode {
  const defaults: RawGistNode = {
    name: 'abc123',
    description: 'My awesome gist',
    url: 'https://gist.github.com/octocat/abc123',
    createdAt: '2022-05-10T00:00:00Z',
    isPublic: true,
    files: [
      {
        name: 'hello.ts',
        extension: '.ts',
        language: { name: 'TypeScript' },
        size: 256,
      },
    ],
  }
  return { ...defaults, ...overrides }
}

describe('mapGist', () => {
  it('returns correct flat Gist from a complete raw input', () => {
    const raw = makeRawGist()
    const result = mapGist(raw)

    expect(result.name).toBe('abc123')
    expect(result.description).toBe('My awesome gist')
    expect(result.url).toBe('https://gist.github.com/octocat/abc123')
    expect(result.createdAt).toBe('2022-05-10T00:00:00Z')
    expect(result.isPublic).toBe(true)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('hello.ts')
    expect(result.files[0].extension).toBe('.ts')
    expect(result.files[0].language).toBe('TypeScript')
    expect(result.files[0].size).toBe(256)
  })

  it('flattens file.language.name to language string', () => {
    const raw = makeRawGist({
      files: [
        {
          name: 'script.py',
          extension: '.py',
          language: { name: 'Python' },
          size: 512,
        },
      ],
    })
    const result = mapGist(raw)
    expect(result.files[0].language).toBe('Python')
  })

  it('returns language: null when file.language is null', () => {
    const raw = makeRawGist({
      files: [{ name: 'Makefile', extension: null, language: null, size: 100 }],
    })
    const result = mapGist(raw)
    expect(result.files[0].language).toBeNull()
  })

  it('returns empty files array when files is null', () => {
    const raw = makeRawGist({ files: null })
    const result = mapGist(raw)
    expect(result.files).toEqual([])
  })

  it('filters out null entries in files array', () => {
    const raw = makeRawGist({
      files: [
        null,
        {
          name: 'main.js',
          extension: '.js',
          language: { name: 'JavaScript' },
          size: 128,
        },
        null,
      ],
    })
    const result = mapGist(raw)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('main.js')
  })

  it('returns description: null when description is null', () => {
    const raw = makeRawGist({ description: null })
    const result = mapGist(raw)
    expect(result.description).toBeNull()
  })
})

// ─── mapUser ──────────────────────────────────────────────────────────────────

function makeRawUser(overrides?: Partial<RawUserNode>): RawUserNode {
  const defaults: RawUserNode = {
    login: 'follower1',
    name: 'Follower One',
    avatarUrl: 'https://avatar.example.com/u/2',
    url: 'https://github.com/follower1',
  }
  return { ...defaults, ...overrides }
}

describe('mapUser', () => {
  it('returns all User fields correctly', () => {
    const raw = makeRawUser()
    const result = mapUser(raw)

    expect(result.login).toBe('follower1')
    expect(result.name).toBe('Follower One')
    expect(result.avatarUrl).toBe('https://avatar.example.com/u/2')
    expect(result.url).toBe('https://github.com/follower1')
  })

  it('preserves null name', () => {
    const raw = makeRawUser({ name: null })
    const result = mapUser(raw)
    expect(result.name).toBeNull()
  })
})

// ─── mapOrganization ──────────────────────────────────────────────────────────

function makeRawOrganization(
  overrides?: Partial<RawOrganizationNode>,
): RawOrganizationNode {
  const defaults: RawOrganizationNode = {
    login: 'github',
    name: 'GitHub',
    description: 'How people build software',
    avatarUrl: 'https://avatar.example.com/u/9919',
    url: 'https://github.com/github',
  }
  return { ...defaults, ...overrides }
}

describe('mapOrganization', () => {
  it('returns all Organization fields correctly', () => {
    const raw = makeRawOrganization()
    const result = mapOrganization(raw)

    expect(result.login).toBe('github')
    expect(result.name).toBe('GitHub')
    expect(result.description).toBe('How people build software')
    expect(result.avatarUrl).toBe('https://avatar.example.com/u/9919')
    expect(result.url).toBe('https://github.com/github')
  })

  it('preserves null name', () => {
    const raw = makeRawOrganization({ name: null })
    const result = mapOrganization(raw)
    expect(result.name).toBeNull()
  })

  it('preserves null description', () => {
    const raw = makeRawOrganization({ description: null })
    const result = mapOrganization(raw)
    expect(result.description).toBeNull()
  })
})

// ─── mapPinnedRepos ───────────────────────────────────────────────────────────

const repoNode: RawRepoNode = {
  name: 'pinned-repo',
  nameWithOwner: 'octocat/pinned-repo',
  url: 'https://github.com/octocat/pinned-repo',
  description: 'A pinned repo',
  isPrivate: false,
  isFork: false,
  stargazerCount: 100,
  forkCount: 5,
  primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
  repositoryTopics: { nodes: [] },
  createdAt: '2022-01-01T00:00:00Z',
  pushedAt: '2023-06-01T00:00:00Z',
  latestRelease: null,
}

const gistNode: RawPinnedItemNode = { __typename: 'Gist' }

describe('mapPinnedRepos', () => {
  it('returns Repo objects only for Repository nodes, silently skipping Gist and null', () => {
    const repo1: RawPinnedItemNode = { __typename: 'Repository', ...repoNode }
    const repo2: RawPinnedItemNode = {
      __typename: 'Repository',
      ...repoNode,
      name: 'second-repo',
      nameWithOwner: 'octocat/second-repo',
      url: 'https://github.com/octocat/second-repo',
    }
    const result = mapPinnedRepos([repo1, gistNode, repo2, null])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('pinned-repo')
    expect(result[1].name).toBe('second-repo')
  })

  it('returns empty array when all nodes are Gist nodes', () => {
    const result = mapPinnedRepos([gistNode, gistNode, gistNode])
    expect(result).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const result = mapPinnedRepos([])
    expect(result).toEqual([])
  })
})

// ─── mapContribution ──────────────────────────────────────────────────────────

describe('mapContribution', () => {
  it('maps RawCommitContributionsByRepo to Contribution with correct commitCount and occurredAt', () => {
    const raw: RawCommitContributionsByRepo = {
      repository: {
        name: 'my-repo',
        nameWithOwner: 'octocat/my-repo',
        url: 'https://github.com/octocat/my-repo',
        isPrivate: false,
        isFork: false,
        stargazerCount: 99,
        owner: { login: 'octocat' },
      },
      contributions: {
        totalCount: 42,
        nodes: [{ occurredAt: '2023-06-15T10:00:00Z' }],
      },
    }
    const startedAt = '2023-01-01T00:00:00Z'
    const result = mapContribution(raw, startedAt)

    expect(result.repoName).toBe('my-repo')
    expect(result.repoNameWithOwner).toBe('octocat/my-repo')
    expect(result.repoUrl).toBe('https://github.com/octocat/my-repo')
    expect(result.commitCount).toBe(42)
    expect(result.occurredAt).toBe('2023-06-15T10:00:00Z')
  })
})

// ─── mapContributionStats ─────────────────────────────────────────────────────

describe('mapContributionStats', () => {
  it('maps all scalar fields and derives year from startedAt', () => {
    const raw: RawContributionStatsCollection = {
      startedAt: '2023-01-01T00:00:00Z',
      endedAt: '2023-12-31T23:59:59Z',
      totalCommitContributions: 500,
      totalIssueContributions: 20,
      totalPullRequestContributions: 35,
      totalPullRequestReviewContributions: 10,
      totalRepositoriesWithContributedCommits: 12,
      restrictedContributionsCount: 5,
    }
    const result = mapContributionStats(raw)

    expect(result.year).toBe(2023)
    expect(result.totalCommitContributions).toBe(500)
    expect(result.totalIssueContributions).toBe(20)
    expect(result.totalPullRequestContributions).toBe(35)
    expect(result.totalPullRequestReviewContributions).toBe(10)
    expect(result.totalRepositoriesWithContributedCommits).toBe(12)
    expect(result.restrictedContributionsCount).toBe(5)
    expect(result.startedAt).toBe('2023-01-01T00:00:00Z')
    expect(result.endedAt).toBe('2023-12-31T23:59:59Z')
  })
})

// ─── mapSponsorship ───────────────────────────────────────────────────────────

import type { RawSponsorshipNode } from '../src/mappers.js'
import { mapSponsorship } from '../src/mappers.js'

describe('mapSponsorship', () => {
  it('returns Sponsor with type="User" when sponsorEntity is a User', () => {
    const raw: RawSponsorshipNode = {
      createdAt: '2023-05-01T00:00:00Z',
      sponsorEntity: {
        __typename: 'User',
        login: 'user-sponsor',
        name: 'User Sponsor',
        avatarUrl: 'https://example.com/user.png',
        url: 'https://github.com/user-sponsor',
      },
      tier: {
        name: '$5/mo',
        monthlyPriceInDollars: 5,
        isOneTime: false,
      },
    }
    const result = mapSponsorship(raw)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('User')
    expect(result!.login).toBe('user-sponsor')
    expect(result!.name).toBe('User Sponsor')
    expect(result!.avatarUrl).toBe('https://example.com/user.png')
    expect(result!.url).toBe('https://github.com/user-sponsor')
    expect(result!.createdAt).toBe('2023-05-01T00:00:00Z')
    expect(result!.tier).toEqual({
      name: '$5/mo',
      monthlyPriceInDollars: 5,
      isOneTime: false,
    })
  })

  it('returns Sponsor with type="Organization" when sponsorEntity is an Organization', () => {
    const raw: RawSponsorshipNode = {
      createdAt: '2023-06-01T00:00:00Z',
      sponsorEntity: {
        __typename: 'Organization',
        login: 'org-sponsor',
        name: 'Org Sponsor',
        avatarUrl: 'https://example.com/org.png',
        url: 'https://github.com/org-sponsor',
      },
      tier: null,
    }
    const result = mapSponsorship(raw)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('Organization')
    expect(result!.login).toBe('org-sponsor')
    expect(result!.tier).toBeNull()
  })

  it('returns null when sponsorEntity is null (private sponsor)', () => {
    const raw: RawSponsorshipNode = {
      createdAt: '2023-07-01T00:00:00Z',
      sponsorEntity: null,
      tier: null,
    }
    const result = mapSponsorship(raw)
    expect(result).toBeNull()
  })

  it('returns null when sponsorEntity has unknown __typename', () => {
    const raw: RawSponsorshipNode = {
      createdAt: '2023-08-01T00:00:00Z',
      sponsorEntity: { __typename: 'Bot' },
      tier: null,
    }
    const result = mapSponsorship(raw)
    expect(result).toBeNull()
  })

  it('returns Sponsor with tier: null when tier is null', () => {
    const raw: RawSponsorshipNode = {
      createdAt: '2023-09-01T00:00:00Z',
      sponsorEntity: {
        __typename: 'User',
        login: 'user-no-tier',
        name: null,
        avatarUrl: 'https://example.com/user.png',
        url: 'https://github.com/user-no-tier',
      },
      tier: null,
    }
    const result = mapSponsorship(raw)

    expect(result).not.toBeNull()
    expect(result!.tier).toBeNull()
    expect(result!.name).toBeNull()
  })
})

// ─── mapRelease ───────────────────────────────────────────────────────────────

import type { RawReleaseNode } from '../src/mappers.js'
import { mapRelease } from '../src/mappers.js'

const repoContext = {
  name: 'hello-world',
  nameWithOwner: 'octocat/hello-world',
  url: 'https://github.com/octocat/hello-world',
}

describe('mapRelease', () => {
  it('maps release node + repo context to flat Release with all fields', () => {
    const raw: RawReleaseNode = {
      name: 'First Release',
      tagName: 'v1.0.0',
      publishedAt: '2024-03-15T10:00:00Z',
      url: 'https://github.com/octocat/hello-world/releases/tag/v1.0.0',
    }
    const result = mapRelease(raw, repoContext)

    expect(result.name).toBe('First Release')
    expect(result.tagName).toBe('v1.0.0')
    expect(result.publishedAt).toBe('2024-03-15T10:00:00Z')
    expect(result.url).toBe(
      'https://github.com/octocat/hello-world/releases/tag/v1.0.0',
    )
    expect(result.repoName).toBe('hello-world')
    expect(result.repoNameWithOwner).toBe('octocat/hello-world')
    expect(result.repoUrl).toBe('https://github.com/octocat/hello-world')
  })

  it('returns Release with publishedAt: null when publishedAt is null', () => {
    const raw: RawReleaseNode = {
      name: 'Pre-release',
      tagName: 'v0.1.0-alpha',
      publishedAt: null,
      url: 'https://github.com/octocat/hello-world/releases/tag/v0.1.0-alpha',
    }
    const result = mapRelease(raw, repoContext)

    expect(result.publishedAt).toBeNull()
    expect(result.tagName).toBe('v0.1.0-alpha')
  })

  it('returns Release with name: null when name is null', () => {
    const raw: RawReleaseNode = {
      name: null,
      tagName: 'v2.0.0',
      publishedAt: '2024-06-01T00:00:00Z',
      url: 'https://github.com/octocat/hello-world/releases/tag/v2.0.0',
    }
    const result = mapRelease(raw, repoContext)

    expect(result.name).toBeNull()
    expect(result.tagName).toBe('v2.0.0')
  })

  it('always has tagName (non-null per schema)', () => {
    const raw: RawReleaseNode = {
      name: null,
      tagName: 'v3.0.0',
      publishedAt: null,
      url: 'https://github.com/octocat/hello-world/releases/tag/v3.0.0',
    }
    const result = mapRelease(raw, repoContext)

    expect(typeof result.tagName).toBe('string')
    expect(result.tagName).toBe('v3.0.0')
  })

  it('uses repo context for repoName, repoNameWithOwner, repoUrl — not from the release node', () => {
    const raw: RawReleaseNode = {
      name: 'A Release',
      tagName: 'v1.0.0',
      publishedAt: '2024-01-01T00:00:00Z',
      url: 'https://github.com/octocat/hello-world/releases/tag/v1.0.0',
    }
    const customRepo = {
      name: 'my-repo',
      nameWithOwner: 'someone/my-repo',
      url: 'https://github.com/someone/my-repo',
    }
    const result = mapRelease(raw, customRepo)

    expect(result.repoName).toBe('my-repo')
    expect(result.repoNameWithOwner).toBe('someone/my-repo')
    expect(result.repoUrl).toBe('https://github.com/someone/my-repo')
  })
})
