import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createOctofolio, NotFoundError, RateLimitError } from '../src/index.js'
import type {
  RawGistNode,
  RawIssueNode,
  RawOrganizationNode,
  RawPullRequestNode,
  RawRepoNode,
  RawStarEdge,
  RawUserNode,
} from '../src/mappers.js'

// MSW server with NO default handlers — each test registers its own via server.use()
// onUnhandledRequest: 'error' means any unexpected fetch (e.g. from construction) will fail the test
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Full profile fixture used in multiple tests
const fullProfileViewer = {
  login: 'octocat',
  name: 'The Octocat',
  bio: 'GitHub mascot',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  url: 'https://github.com/octocat',
  email: 'octocat@github.com',
  location: 'San Francisco',
  company: '@github',
  websiteUrl: 'https://github.blog',
  twitterUsername: 'github',
  createdAt: '2011-01-25T18:44:36Z',
  followers: { totalCount: 10000 },
  following: { totalCount: 9 },
  socialAccounts: {
    nodes: [
      {
        provider: 'TWITTER',
        displayName: '@github',
        url: 'https://twitter.com/github',
      },
    ],
  },
}

describe('createOctofolio', () => {
  // Test 1 — CLI-01: Factory returns object with profile method
  // No handler registered — if construction triggered a fetch, MSW would throw (CLI-03 implicit proof)
  it('returns an object with a profile method without making any network requests', () => {
    const me = createOctofolio({ token: 'test-token' })
    expect(typeof me.profile).toBe('function')
  })

  // Test 2 — CLI-03: No fetch at construction (explicit documentation)
  // This test is covered by Test 1: MSW is in strict mode (onUnhandledRequest: 'error'),
  // no handler is registered for this test, and no error is thrown — proving no fetch occurs.
  it('does not fire any HTTP request during construction', () => {
    // Simply constructing should not throw even with no MSW handler registered
    expect(() => createOctofolio({ token: 'no-request-token' })).not.toThrow()
  })

  // Test 3 — PROF-01: profile() returns flat Profile with all scalar fields
  it('profile() returns flat Profile with all scalar fields correct', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({ data: { viewer: fullProfileViewer } }),
      ),
    )
    const me = createOctofolio({ token: 'test-token' })
    const profile = await me.profile()

    expect(profile.login).toBe('octocat')
    expect(profile.name).toBe('The Octocat')
    expect(profile.bio).toBe('GitHub mascot')
    expect(profile.avatarUrl).toBe(
      'https://avatars.githubusercontent.com/u/583231',
    )
    expect(profile.url).toBe('https://github.com/octocat')
    expect(profile.email).toBe('octocat@github.com')
    expect(profile.location).toBe('San Francisco')
    expect(profile.company).toBe('@github')
    expect(profile.websiteUrl).toBe('https://github.blog')
    expect(profile.twitterUsername).toBe('github')
    expect(profile.createdAt).toBe('2011-01-25T18:44:36Z')
    expect(profile.followersCount).toBe(10000)
    expect(profile.followingCount).toBe(9)
  })

  // Test 4 — PROF-01: profile() returns socialAccounts as flat array
  it('profile() returns socialAccounts as flat array', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({ data: { viewer: fullProfileViewer } }),
      ),
    )
    const me = createOctofolio({ token: 'test-token' })
    const profile = await me.profile()

    expect(profile.socialAccounts).toEqual([
      {
        provider: 'TWITTER',
        displayName: '@github',
        url: 'https://twitter.com/github',
      },
    ])
  })

  // Test 4b — PROF-01: profile() handles empty socialAccounts
  it('profile() returns empty socialAccounts array when nodes is empty', async () => {
    const viewerWithNoSocials = {
      ...fullProfileViewer,
      socialAccounts: { nodes: [] },
    }
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({ data: { viewer: viewerWithNoSocials } }),
      ),
    )
    const me = createOctofolio({ token: 'test-token' })
    const profile = await me.profile()

    expect(profile.socialAccounts).toEqual([])
  })

  // Test 5 — CLI-02: Viewer cache seeded by profile() — no separate viewer query fires
  it('profile() seeds viewer cache — only one HTTP request per profile() call', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        return HttpResponse.json({ data: { viewer: fullProfileViewer } })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    await me.profile()
    expect(callCount).toBe(1) // Only the PROFILE_QUERY — no separate VIEWER_QUERY

    await me.profile()
    expect(callCount).toBe(2) // Second profile() call = one more request, viewer cache hit skips separate query
  })

  // Test 6 — Error wrapping: wrapError converts rate-limited GraphqlResponseError to RateLimitError
  it('profile() throws RateLimitError when API returns RATE_LIMITED', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({
          data: null,
          errors: [
            { type: 'RATE_LIMITED', message: 'API rate limit exceeded' },
          ],
        }),
      ),
    )
    const me = createOctofolio({ token: 'test-token' })
    await expect(me.profile()).rejects.toThrow(RateLimitError)
  })

  // Test 7 — Error recovery: after failed profile() call, subsequent call succeeds
  it('profile() recovers after a transient error — subsequent call succeeds', async () => {
    let attempt = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        attempt++
        if (attempt === 1) {
          return HttpResponse.json({
            data: null,
            errors: [{ type: 'RATE_LIMITED', message: 'rate limited' }],
          })
        }
        return HttpResponse.json({ data: { viewer: fullProfileViewer } })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })

    // First call fails
    await expect(me.profile()).rejects.toThrow(RateLimitError)

    // Second call succeeds — no state poisoned from the first failure
    const profile = await me.profile()
    expect(profile.login).toBe('octocat')
  })
})

// ─── repos() and forks() tests ────────────────────────────────────────────────

const repoNodeFixture: RawRepoNode = {
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

// Meta-repo fixture — should be excluded from results (CLI-05)
const metaRepoFixture: RawRepoNode = {
  ...repoNodeFixture,
  name: 'octocat',
  nameWithOwner: 'octocat/octocat',
  url: 'https://github.com/octocat/octocat',
}

const forkRepoFixture: RawRepoNode = {
  ...repoNodeFixture,
  name: 'forked-repo',
  nameWithOwner: 'octocat/forked-repo',
  url: 'https://github.com/octocat/forked-repo',
  isFork: true,
}

describe('repos() and forks()', () => {
  // Test: repos() returns Repo[] from paginated response (meta-repo excluded)
  it('repos() returns Repo[] excluding meta-repo', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          // Viewer query
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        // Repos page
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [repoNodeFixture, metaRepoFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const repos = await me.repos()

    // meta-repo excluded → only 1 result
    expect(repos.length).toBe(1)
    expect(repos[0].name).toBe('hello-world')
    expect(repos[0].primaryLanguage).toBe('JavaScript')
    expect(repos[0].topics).toEqual(['javascript'])
    expect(repos[0].lastRelease?.tagName).toBe('v1.0.0')
    expect(repos[0].lastRelease?.repoName).toBe('hello-world')
  })

  // Test: repos({ count: 1 }) returns exactly 1 item
  it('repos({ count: 1 }) returns exactly 1 item even with more available', async () => {
    const secondRepo: RawRepoNode = {
      ...repoNodeFixture,
      name: 'second-repo',
      nameWithOwner: 'octocat/second-repo',
    }
    const thirdRepo: RawRepoNode = {
      ...repoNodeFixture,
      name: 'third-repo',
      nameWithOwner: 'octocat/third-repo',
    }
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [repoNodeFixture, secondRepo, thirdRepo],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const repos = await me.repos({ count: 1 })

    expect(repos.length).toBe(1)
    expect(repos[0].name).toBe('hello-world')
  })

  // Test: forks() passes isFork: true variable and returns repos with isFork: true
  it('forks() passes isFork: true and returns fork repos', async () => {
    let capturedBody: string | null = null
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        capturedBody = await request.text()
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [forkRepoFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const forks = await me.forks()

    expect(forks.length).toBe(1)
    expect(forks[0].isFork).toBe(true)
    // Verify isFork: true was passed in the request variables
    const body = JSON.parse(capturedBody!)
    expect(body.variables.isFork).toBe(true)
  })

  // Test: repos() excludes meta-repo (CLI-05)
  it('repos() excludes meta-repo (username/username) from results', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [metaRepoFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const repos = await me.repos()

    // Meta-repo should be excluded
    expect(repos.length).toBe(0)
    const metaRepoInResults = repos.find(
      (r) => r.nameWithOwner === 'octocat/octocat',
    )
    expect(metaRepoInResults).toBeUndefined()
  })

  // Test: repos() queries with privacy: PUBLIC (CLI-06)
  it('repos() query string contains privacy: PUBLIC', async () => {
    let capturedQuery: string | null = null
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        capturedQuery = body.query
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    await me.repos()

    expect(capturedQuery).toContain('privacy: PUBLIC')
  })
})

// ─── repo() tests ─────────────────────────────────────────────────────────────

describe('repo()', () => {
  it('repo() returns a single Repo by owner/name without a viewer query', async () => {
    let callCount = 0
    let capturedBody: string | null = null
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        capturedBody = await request.text()
        return HttpResponse.json({ data: { repository: repoNodeFixture } })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const repo = await me.repo('octocat/hello-world')

    expect(repo.nameWithOwner).toBe('octocat/hello-world')
    expect(repo.primaryLanguage).toBe('JavaScript')
    expect(repo.topics).toEqual(['javascript'])
    expect(repo.lastRelease?.tagName).toBe('v1.0.0')
    // Not viewer-scoped: exactly one request, no separate VIEWER_QUERY
    expect(callCount).toBe(1)
    // owner/name passed as GraphQL variables, not interpolated
    const body = JSON.parse(capturedBody!)
    expect(body.variables.owner).toBe('octocat')
    expect(body.variables.name).toBe('hello-world')
  })

  it('repo() throws NotFoundError when repository is null', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({ data: { repository: null } }),
      ),
    )
    const me = createOctofolio({ token: 'test-token' })
    await expect(me.repo('octocat/does-not-exist')).rejects.toThrow(
      NotFoundError,
    )
  })

  it('repo() throws TypeError for a malformed identifier', async () => {
    const me = createOctofolio({ token: 'test-token' })
    await expect(me.repo('not-a-valid-id')).rejects.toThrow(TypeError)
  })
})

// ─── pullRequests(), issues(), stars(), gists() tests ─────────────────────────

const prFixture: RawPullRequestNode = {
  title: 'Fix the bug',
  url: 'https://github.com/octocat/hello-world/pull/42',
  state: 'OPEN',
  createdAt: '2023-01-10T12:00:00Z',
  additions: 50,
  deletions: 10,
  repository: {
    nameWithOwner: 'octocat/hello-world',
    url: 'https://github.com/octocat/hello-world',
    isPrivate: false,
  },
}

const issueFixture: RawIssueNode = {
  title: 'Found a bug',
  url: 'https://github.com/octocat/hello-world/issues/7',
  state: 'CLOSED',
  createdAt: '2023-02-15T09:00:00Z',
  number: 7,
  comments: { totalCount: 5 },
  repository: {
    nameWithOwner: 'octocat/hello-world',
    url: 'https://github.com/octocat/hello-world',
    isPrivate: false,
  },
}

const starEdgeFixture: RawStarEdge = {
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

const gistFixture: RawGistNode = {
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

describe('pullRequests()', () => {
  it('pullRequests({ state: "OPEN" }) returns PullRequest[] with OPEN state', async () => {
    let callCount = 0
    let capturedBody: string | null = null
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        capturedBody = await request.text()
        return HttpResponse.json({
          data: {
            user: {
              pullRequests: {
                nodes: [prFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const prs = await me.pullRequests({ state: 'OPEN' })

    expect(prs.length).toBe(1)
    expect(prs[0].state).toBe('OPEN')
    expect(prs[0].repoNameWithOwner).toBe('octocat/hello-world')
    // Verify state variable was passed in the request
    const body = JSON.parse(capturedBody!)
    expect(body.variables.state).toBe('OPEN')
  })

  it('pullRequests() defaults state to MERGED', async () => {
    let callCount = 0
    let capturedBody: string | null = null
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        capturedBody = await request.text()
        return HttpResponse.json({
          data: {
            user: {
              pullRequests: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    await me.pullRequests()
    const body = JSON.parse(capturedBody!)
    expect(body.variables.state).toBe('MERGED')
  })
})

describe('issues()', () => {
  it('issues({ state: "CLOSED" }) returns Issue[] with CLOSED state and commentsCount', async () => {
    let callCount = 0
    let capturedBody: string | null = null
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        capturedBody = await request.text()
        return HttpResponse.json({
          data: {
            user: {
              issues: {
                nodes: [issueFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const issues = await me.issues({ state: 'CLOSED' })

    expect(issues.length).toBe(1)
    expect(issues[0].state).toBe('CLOSED')
    expect(issues[0].commentsCount).toBe(5)
    expect(issues[0].repoNameWithOwner).toBe('octocat/hello-world')
    // Verify state variable passed
    const body = JSON.parse(capturedBody!)
    expect(body.variables.state).toBe('CLOSED')
  })
})

describe('stars()', () => {
  it('stars() returns Star[] with non-null starredAt from edges', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              starredRepositories: {
                edges: [starEdgeFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const stars = await me.stars()

    expect(stars.length).toBe(1)
    expect(typeof stars[0].starredAt).toBe('string')
    expect(stars[0].starredAt).toBe('2023-03-01T00:00:00Z')
    expect(stars[0].repoName).toBe('awesome-lib')
    expect(stars[0].primaryLanguage).toBe('TypeScript')
  })
})

describe('gists()', () => {
  it('gists() returns Gist[] with files as plain array', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              gists: {
                nodes: [gistFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const gists = await me.gists()

    expect(gists.length).toBe(1)
    expect(Array.isArray(gists[0].files)).toBe(true)
    expect(gists[0].files[0].name).toBe('hello.ts')
    expect(gists[0].isPublic).toBe(true)
  })
})

// ─── followers(), following(), organizations() tests ──────────────────────────

const followerFixture: RawUserNode = {
  login: 'follower1',
  name: 'Follower One',
  avatarUrl: 'https://avatar.example.com/u/2',
  url: 'https://github.com/follower1',
}

const followingFixture: RawUserNode = {
  login: 'following1',
  name: 'Following One',
  avatarUrl: 'https://avatar.example.com/u/3',
  url: 'https://github.com/following1',
}

const orgFixture: RawOrganizationNode = {
  login: 'github',
  name: 'GitHub',
  description: 'How people build software',
  avatarUrl: 'https://avatar.example.com/u/9919',
  url: 'https://github.com/github',
}

describe('followers()', () => {
  it('followers() returns User[] with correct fields', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              followers: {
                nodes: [followerFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.followers()

    expect(result.length).toBe(1)
    expect(result[0].login).toBe('follower1')
    expect(result[0].name).toBe('Follower One')
    expect(result[0].avatarUrl).toBe('https://avatar.example.com/u/2')
    expect(result[0].url).toBe('https://github.com/follower1')
  })
})

describe('following()', () => {
  it('following() returns User[] with correct fields', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              following: {
                nodes: [followingFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.following()

    expect(result.length).toBe(1)
    expect(result[0].login).toBe('following1')
    expect(result[0].name).toBe('Following One')
  })
})

describe('organizations()', () => {
  it('organizations() returns Organization[] with correct fields', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              organizations: {
                nodes: [orgFixture],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.organizations()

    expect(result.length).toBe(1)
    expect(result[0].login).toBe('github')
    expect(result[0].name).toBe('GitHub')
    expect(result[0].description).toBe('How people build software')
    expect(result[0].avatarUrl).toBe('https://avatar.example.com/u/9919')
    expect(result[0].url).toBe('https://github.com/github')
  })
})

// ─── pinnedRepos() tests ──────────────────────────────────────────────────────

describe('pinnedRepos()', () => {
  it('pinnedRepos() returns Repo[] filtering out Gist items', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              pinnedItems: {
                nodes: [
                  { __typename: 'Repository', ...repoNodeFixture },
                  { __typename: 'Gist' },
                  {
                    __typename: 'Repository',
                    ...repoNodeFixture,
                    name: 'pinned-second',
                    nameWithOwner: 'octocat/pinned-second',
                    url: 'https://github.com/octocat/pinned-second',
                  },
                ],
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.pinnedRepos()

    expect(result.length).toBe(2)
    expect(result[0].name).toBe('hello-world')
    expect(result[1].name).toBe('pinned-second')
  })
})

// ─── contributions() tests ────────────────────────────────────────────────────

describe('contributions()', () => {
  it('contributions() returns Contribution[] with correct commitCount per repo', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              contributionsCollection: {
                startedAt: '2024-01-01T00:00:00Z',
                commitContributionsByRepository: [
                  {
                    repository: {
                      name: 'repo-a',
                      nameWithOwner: 'octocat/repo-a',
                      url: 'https://github.com/octocat/repo-a',
                      isPrivate: false,
                      isFork: false,
                      stargazerCount: 50,
                      owner: { login: 'octocat' },
                    },
                    contributions: {
                      totalCount: 30,
                      nodes: [{ occurredAt: '2024-06-01T00:00:00Z' }],
                    },
                  },
                  {
                    repository: {
                      name: 'repo-b',
                      nameWithOwner: 'octocat/repo-b',
                      url: 'https://github.com/octocat/repo-b',
                      isPrivate: false,
                      isFork: false,
                      stargazerCount: 10,
                      owner: { login: 'octocat' },
                    },
                    contributions: {
                      totalCount: 15,
                      nodes: [{ occurredAt: '2024-05-01T00:00:00Z' }],
                    },
                  },
                ],
              },
            },
          },
        })
      }),
      http.get('https://api.github.com/search/commits', () => {
        return HttpResponse.json({ total_count: 0, items: [] })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.contributions()

    expect(result.length).toBe(2)
    expect(result[0].repoName).toBe('repo-a')
    expect(result[0].commitCount).toBe(30)
    expect(result[1].repoName).toBe('repo-b')
    expect(result[1].commitCount).toBe(15)
  })

  it('contributions({ year: 2023 }) sends correct from/to DateTime variables', async () => {
    let callCount = 0
    let capturedBody: string | null = null
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        capturedBody = await request.text()
        return HttpResponse.json({
          data: {
            user: {
              contributionsCollection: {
                startedAt: '2023-01-01T00:00:00Z',
                commitContributionsByRepository: [],
              },
            },
          },
        })
      }),
      http.get('https://api.github.com/search/commits', () => {
        return HttpResponse.json({ total_count: 0, items: [] })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    await me.contributions({ year: 2023 })

    const body = JSON.parse(capturedBody!)
    expect(body.variables.from).toBe('2023-01-01T00:00:00Z')
    expect(body.variables.to).toBe('2023-12-31T23:59:59Z')
  })

  it('contributions() uses real commit date from REST search instead of new Date()', async () => {
    // Regression: supplementFromSearch previously wrote new Date().toISOString() as occurredAt
    // for any contribution not present in the GraphQL commitContributionsByRepository result.
    // This caused REST-only repos to always sort to the top as if their last commit was today.
    const realCommitDate = '2025-11-15T10:00:00Z'
    let graphqlCallCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        graphqlCallCount++
        if (graphqlCallCount === 1) {
          // viewer query
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        if (graphqlCallCount === 2) {
          // contributions query — empty commitContributionsByRepository so all repos come from REST
          return HttpResponse.json({
            data: {
              user: {
                contributionsCollection: {
                  startedAt: '2025-01-01T00:00:00Z',
                  commitContributionsByRepository: [],
                },
              },
            },
          })
        }
        // graphqlCallCount === 3: fetchStarCounts for the REST-discovered repo
        return HttpResponse.json({ data: { r0: { stargazerCount: 5 } } })
      }),
      http.get('https://api.github.com/search/commits', () => {
        return HttpResponse.json({
          total_count: 1,
          items: [
            {
              sha: 'abc123',
              html_url:
                'https://github.com/octocat/rest-only-repo/commit/abc123',
              commit: {
                message: 'chore: bump deps',
                author: { date: realCommitDate },
                committer: { date: realCommitDate },
              },
              repository: {
                name: 'rest-only-repo',
                full_name: 'octocat/rest-only-repo',
                html_url: 'https://github.com/octocat/rest-only-repo',
                fork: false,
              },
            },
          ],
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.contributions()

    expect(result.length).toBe(1)
    expect(result[0].repoNameWithOwner).toBe('octocat/rest-only-repo')
    expect(result[0].occurredAt).toBe(realCommitDate)
    // Must NOT be today's date
    expect(result[0].occurredAt).not.toMatch(/^2026-05-21/)
  })
})

// ─── contributionStats() tests ────────────────────────────────────────────────

describe('contributionStats()', () => {
  it('contributionStats() returns ContributionStats with correct aggregate fields', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              contributionsCollection: {
                startedAt: '2024-01-01T00:00:00Z',
                endedAt: '2024-12-31T23:59:59Z',
                totalCommitContributions: 400,
                totalIssueContributions: 15,
                totalPullRequestContributions: 25,
                totalPullRequestReviewContributions: 8,
                totalRepositoriesWithContributedCommits: 10,
                restrictedContributionsCount: 3,
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.contributionStats()

    expect(result.year).toBe(2024)
    expect(result.totalCommitContributions).toBe(400)
    expect(result.totalIssueContributions).toBe(15)
    expect(result.totalPullRequestContributions).toBe(25)
    expect(result.totalPullRequestReviewContributions).toBe(8)
    expect(result.totalRepositoriesWithContributedCommits).toBe(10)
    expect(result.restrictedContributionsCount).toBe(3)
    expect(result.startedAt).toBe('2024-01-01T00:00:00Z')
    expect(result.endedAt).toBe('2024-12-31T23:59:59Z')
  })

  it('contributionStats({ year: 2023 }) sends correct from/to DateTime variables', async () => {
    let callCount = 0
    let capturedBody: string | null = null
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        capturedBody = await request.text()
        return HttpResponse.json({
          data: {
            user: {
              contributionsCollection: {
                startedAt: '2023-01-01T00:00:00Z',
                endedAt: '2023-12-31T23:59:59Z',
                totalCommitContributions: 200,
                totalIssueContributions: 5,
                totalPullRequestContributions: 10,
                totalPullRequestReviewContributions: 2,
                totalRepositoriesWithContributedCommits: 5,
                restrictedContributionsCount: 0,
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    await me.contributionStats({ year: 2023 })

    const body = JSON.parse(capturedBody!)
    expect(body.variables.from).toBe('2023-01-01T00:00:00Z')
    expect(body.variables.to).toBe('2023-12-31T23:59:59Z')
  })
})

// ─── languages() tests ────────────────────────────────────────────────────────

describe('languages()', () => {
  it('languages() aggregates bytes across repos and returns sorted Language[]', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'testuser' } } })
        }
        // Two repos: repo-a has TypeScript(50000) + JavaScript(30000), repo-b has TypeScript(20000) + CSS(10000)
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [
                  {
                    nameWithOwner: 'testuser/repo-a',
                    languages: {
                      edges: [
                        {
                          size: 50000,
                          node: { name: 'TypeScript', color: '#3178c6' },
                        },
                        {
                          size: 30000,
                          node: { name: 'JavaScript', color: '#f1e05a' },
                        },
                      ],
                    },
                  },
                  {
                    nameWithOwner: 'testuser/repo-b',
                    languages: {
                      edges: [
                        {
                          size: 20000,
                          node: { name: 'TypeScript', color: '#3178c6' },
                        },
                        {
                          size: 10000,
                          node: { name: 'CSS', color: '#563d7c' },
                        },
                      ],
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const langs = await me.languages()

    // Total bytes: TypeScript 70000, JavaScript 30000, CSS 10000 = 110000
    expect(langs.length).toBe(3)
    // Sorted by bytes descending
    expect(langs[0].name).toBe('TypeScript')
    expect(langs[0].bytes).toBe(70000)
    expect(langs[0].percentage).toBeCloseTo(63.64, 1)
    expect(langs[1].name).toBe('JavaScript')
    expect(langs[1].bytes).toBe(30000)
    expect(langs[1].percentage).toBeCloseTo(27.27, 1)
    expect(langs[2].name).toBe('CSS')
    expect(langs[2].bytes).toBe(10000)
    expect(langs[2].percentage).toBeCloseTo(9.09, 1)
  })

  it('languages() skips meta-repo (login/login) from aggregation', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'testuser' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [
                  {
                    nameWithOwner: 'testuser/testuser',
                    languages: {
                      edges: [
                        {
                          size: 999999,
                          node: { name: 'Go', color: '#00ADD8' },
                        },
                      ],
                    },
                  },
                  {
                    nameWithOwner: 'testuser/my-project',
                    languages: {
                      edges: [
                        {
                          size: 5000,
                          node: { name: 'TypeScript', color: '#3178c6' },
                        },
                      ],
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const langs = await me.languages()

    // meta-repo Go bytes should not appear
    expect(langs.find((l) => l.name === 'Go')).toBeUndefined()
    expect(langs.length).toBe(1)
    expect(langs[0].name).toBe('TypeScript')
    expect(langs[0].bytes).toBe(5000)
    expect(langs[0].percentage).toBe(100)
  })

  it('languages() handles repos with empty languages edges', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'testuser' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [
                  {
                    nameWithOwner: 'testuser/empty-repo',
                    languages: { edges: [] },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const langs = await me.languages()

    expect(langs).toEqual([])
  })

  it('languages() handles no repos (empty nodes) without error', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'testuser' } } })
        }
        return HttpResponse.json({
          data: {
            user: {
              repositories: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const langs = await me.languages()

    expect(langs).toEqual([])
  })
})

// ─── sponsors() tests ─────────────────────────────────────────────────────────

describe('sponsors()', () => {
  it('sponsors() returns Sponsor[] with correct type discrimination (User and Organization)', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('sponsorshipsAsMaintainer')) {
          return HttpResponse.json({
            data: {
              user: {
                sponsorshipsAsMaintainer: {
                  nodes: [
                    {
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
                    },
                    {
                      createdAt: '2023-06-01T00:00:00Z',
                      sponsorEntity: {
                        __typename: 'Organization',
                        login: 'org-sponsor',
                        name: 'Org Sponsor',
                        avatarUrl: 'https://example.com/org.png',
                        url: 'https://github.com/org-sponsor',
                      },
                      tier: null,
                    },
                    {
                      createdAt: '2023-07-01T00:00:00Z',
                      sponsorEntity: null,
                      tier: null,
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.sponsors()

    // 3 nodes but 1 is null sponsorEntity (private) — 2 results
    expect(result.length).toBe(2)
    expect(result[0].type).toBe('User')
    expect(result[0].login).toBe('user-sponsor')
    expect(result[0].tier).toEqual({
      name: '$5/mo',
      monthlyPriceInDollars: 5,
      isOneTime: false,
    })
    expect(result[1].type).toBe('Organization')
    expect(result[1].login).toBe('org-sponsor')
    expect(result[1].tier).toBeNull()
  })

  it('sponsors() filters out null sponsorEntity (private sponsors) without crashing', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('sponsorshipsAsMaintainer')) {
          return HttpResponse.json({
            data: {
              user: {
                sponsorshipsAsMaintainer: {
                  nodes: [
                    {
                      createdAt: '2023-01-01T00:00:00Z',
                      sponsorEntity: null,
                      tier: null,
                    },
                    {
                      createdAt: '2023-02-01T00:00:00Z',
                      sponsorEntity: null,
                      tier: null,
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.sponsors()

    expect(result.length).toBe(0)
  })

  it('sponsors({ count: 1 }) returns exactly 1 result even when more are available', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('sponsorshipsAsMaintainer')) {
          return HttpResponse.json({
            data: {
              user: {
                sponsorshipsAsMaintainer: {
                  nodes: [
                    {
                      createdAt: '2023-05-01T00:00:00Z',
                      sponsorEntity: {
                        __typename: 'User',
                        login: 'user-a',
                        name: 'User A',
                        avatarUrl: 'https://example.com/a.png',
                        url: 'https://github.com/user-a',
                      },
                      tier: null,
                    },
                    {
                      createdAt: '2023-06-01T00:00:00Z',
                      sponsorEntity: {
                        __typename: 'User',
                        login: 'user-b',
                        name: 'User B',
                        avatarUrl: 'https://example.com/b.png',
                        url: 'https://github.com/user-b',
                      },
                      tier: null,
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.sponsors({ count: 1 })

    expect(result.length).toBe(1)
    expect(result[0].login).toBe('user-a')
  })
})

// ─── sponsoring() tests ───────────────────────────────────────────────────────

describe('sponsoring()', () => {
  it('sponsoring() returns Sponsor[] via sponsorshipsAsSponsor', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('sponsorshipsAsSponsor')) {
          return HttpResponse.json({
            data: {
              user: {
                sponsorshipsAsSponsor: {
                  nodes: [
                    {
                      createdAt: '2023-10-01T00:00:00Z',
                      sponsorEntity: {
                        __typename: 'User',
                        login: 'maintainer-x',
                        name: 'Maintainer X',
                        avatarUrl: 'https://example.com/mx.png',
                        url: 'https://github.com/maintainer-x',
                      },
                      tier: {
                        name: '$10/mo',
                        monthlyPriceInDollars: 10,
                        isOneTime: false,
                      },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.sponsoring()

    expect(result.length).toBe(1)
    expect(result[0].type).toBe('User')
    expect(result[0].login).toBe('maintainer-x')
    expect(result[0].tier).toEqual({
      name: '$10/mo',
      monthlyPriceInDollars: 10,
      isOneTime: false,
    })
  })
})

// ─── releases() tests ─────────────────────────────────────────────────────────

describe('releases()', () => {
  it('returns releases sorted by publishedAt descending (newest first), skipping repos with no releases', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('repositoriesContributedTo')) {
          return HttpResponse.json({
            data: {
              user: {
                repositoriesContributedTo: {
                  nodes: [
                    {
                      name: 'repo-a',
                      nameWithOwner: 'octocat/repo-a',
                      url: 'https://github.com/octocat/repo-a',
                      releases: {
                        nodes: [
                          {
                            name: 'v1.0',
                            tagName: 'v1.0',
                            publishedAt: '2024-01-15T00:00:00Z',
                            url: 'https://github.com/octocat/repo-a/releases/tag/v1.0',
                          },
                        ],
                      },
                    },
                    {
                      name: 'repo-b',
                      nameWithOwner: 'octocat/repo-b',
                      url: 'https://github.com/octocat/repo-b',
                      releases: {
                        nodes: [
                          {
                            name: 'v2.0',
                            tagName: 'v2.0',
                            publishedAt: '2024-06-01T00:00:00Z',
                            url: 'https://github.com/octocat/repo-b/releases/tag/v2.0',
                          },
                        ],
                      },
                    },
                    {
                      name: 'repo-c',
                      nameWithOwner: 'octocat/repo-c',
                      url: 'https://github.com/octocat/repo-c',
                      releases: { nodes: [] },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.releases()

    // repo-c skipped (no releases) → 2 results
    expect(result.length).toBe(2)
    // repo-b newer (2024-06-01) → first
    expect(result[0].tagName).toBe('v2.0')
    expect(result[0].repoName).toBe('repo-b')
    // repo-a older (2024-01-15) → second
    expect(result[1].tagName).toBe('v1.0')
    expect(result[1].repoName).toBe('repo-a')
  })

  it('skips repos with no releases without crashing', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('repositoriesContributedTo')) {
          return HttpResponse.json({
            data: {
              user: {
                repositoriesContributedTo: {
                  nodes: [
                    {
                      name: 'empty-repo',
                      nameWithOwner: 'octocat/empty-repo',
                      url: 'https://github.com/octocat/empty-repo',
                      releases: { nodes: [] },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.releases()

    expect(result).toEqual([])
  })

  it('count cap limits results after sort', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('repositoriesContributedTo')) {
          return HttpResponse.json({
            data: {
              user: {
                repositoriesContributedTo: {
                  nodes: [
                    {
                      name: 'repo-x',
                      nameWithOwner: 'octocat/repo-x',
                      url: 'https://github.com/octocat/repo-x',
                      releases: {
                        nodes: [
                          {
                            name: 'v1.0',
                            tagName: 'v1.0',
                            publishedAt: '2024-01-01T00:00:00Z',
                            url: 'https://github.com/octocat/repo-x/releases/tag/v1.0',
                          },
                        ],
                      },
                    },
                    {
                      name: 'repo-y',
                      nameWithOwner: 'octocat/repo-y',
                      url: 'https://github.com/octocat/repo-y',
                      releases: {
                        nodes: [
                          {
                            name: 'v2.0',
                            tagName: 'v2.0',
                            publishedAt: '2024-06-01T00:00:00Z',
                            url: 'https://github.com/octocat/repo-y/releases/tag/v2.0',
                          },
                        ],
                      },
                    },
                    {
                      name: 'repo-z',
                      nameWithOwner: 'octocat/repo-z',
                      url: 'https://github.com/octocat/repo-z',
                      releases: {
                        nodes: [
                          {
                            name: 'v3.0',
                            tagName: 'v3.0',
                            publishedAt: '2024-09-01T00:00:00Z',
                            url: 'https://github.com/octocat/repo-z/releases/tag/v3.0',
                          },
                        ],
                      },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.releases({ count: 1 })

    // Only the newest (repo-z, 2024-09-01) should be returned
    expect(result.length).toBe(1)
    expect(result[0].tagName).toBe('v3.0')
    expect(result[0].repoName).toBe('repo-z')
  })

  it('null publishedAt sorts to end', async () => {
    let callCount = 0
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ data: { viewer: { login: 'octocat' } } })
        }
        const body = (await request.json()) as { query: string }
        if (body.query.includes('repositoriesContributedTo')) {
          return HttpResponse.json({
            data: {
              user: {
                repositoriesContributedTo: {
                  nodes: [
                    {
                      name: 'repo-with-date',
                      nameWithOwner: 'octocat/repo-with-date',
                      url: 'https://github.com/octocat/repo-with-date',
                      releases: {
                        nodes: [
                          {
                            name: 'v1.0',
                            tagName: 'v1.0',
                            publishedAt: '2024-01-01T00:00:00Z',
                            url: 'https://github.com/octocat/repo-with-date/releases/tag/v1.0',
                          },
                        ],
                      },
                    },
                    {
                      name: 'repo-null-date',
                      nameWithOwner: 'octocat/repo-null-date',
                      url: 'https://github.com/octocat/repo-null-date',
                      releases: {
                        nodes: [
                          {
                            name: 'Draft',
                            tagName: 'v0.0.1',
                            publishedAt: null,
                            url: 'https://github.com/octocat/repo-null-date/releases/tag/v0.0.1',
                          },
                        ],
                      },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          })
        }
        return HttpResponse.json({ data: {} })
      }),
    )
    const me = createOctofolio({ token: 'test-token' })
    const result = await me.releases()

    // release with actual publishedAt should come first
    expect(result[0].publishedAt).toBe('2024-01-01T00:00:00Z')
    // null publishedAt should be at the end
    expect(result[1].publishedAt).toBeNull()
  })
})

// ─── all 17 methods smoke test ────────────────────────────────────────────────

describe('all 18 methods smoke test', () => {
  it('createOctofolio return object has all 18 methods as functions', () => {
    const me = createOctofolio({ token: 'test' })

    const expectedMethods = [
      'profile',
      'repo',
      'repos',
      'forks',
      'pullRequests',
      'issues',
      'stars',
      'gists',
      'followers',
      'following',
      'organizations',
      'pinnedRepos',
      'contributions',
      'contributionStats',
      'languages',
      'sponsors',
      'sponsoring',
      'releases',
    ] as const

    for (const method of expectedMethods) {
      expect(typeof me[method], `expected ${method} to be a function`).toBe(
        'function',
      )
    }
  })
})
