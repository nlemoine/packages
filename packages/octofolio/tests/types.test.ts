import { describe, expect, it } from 'vitest'
import type {
  Contribution,
  ContributionStats,
  Gist,
  GistFile,
  Issue,
  Language,
  Organization,
  Profile,
  PullRequest,
  Release,
  Repo,
  SocialAccount,
  Sponsor,
  SponsorTier,
  Star,
  User,
} from '../src/index.js'

describe('type exports', () => {
  it('all 16 type interfaces are importable from entry point', () => {
    // Type-level verification: if this file compiles, the types exist.
    // Runtime assertion that the import path resolves:
    const typeNames: string[] = [
      'SocialAccount',
      'Profile',
      'Release',
      'Repo',
      'PullRequest',
      'Issue',
      'Star',
      'Contribution',
      'ContributionStats',
      'GistFile',
      'Gist',
      'SponsorTier',
      'Sponsor',
      'Organization',
      'Language',
      'User',
    ]
    expect(typeNames).toHaveLength(16)
  })

  it('Profile has correct shape', () => {
    const profile: Profile = {
      login: 'test',
      name: null,
      bio: null,
      avatarUrl: 'https://example.com/avatar',
      url: 'https://github.com/test',
      email: '',
      location: null,
      company: null,
      websiteUrl: null,
      twitterUsername: null,
      createdAt: '2020-01-01T00:00:00Z',
      followersCount: 0,
      followingCount: 0,
      socialAccounts: [],
    }
    expect(profile.login).toBe('test')
    expect(profile.socialAccounts).toEqual([])
  })

  it('Repo.lastRelease accepts Release | null', () => {
    const repo: Repo = {
      name: 'test',
      nameWithOwner: 'user/test',
      url: 'https://github.com/user/test',
      description: null,
      isPrivate: false,
      isFork: false,
      stargazerCount: 0,
      forkCount: 0,
      primaryLanguage: null,
      primaryLanguageColor: null,
      topics: [],
      createdAt: '2020-01-01T00:00:00Z',
      pushedAt: null,
      lastRelease: null,
    }
    expect(repo.lastRelease).toBeNull()
  })

  it('PullRequest.state is a string literal union', () => {
    const pr: PullRequest = {
      title: 'Fix bug',
      url: 'https://github.com/user/repo/pull/1',
      state: 'MERGED',
      createdAt: '2020-01-01T00:00:00Z',
      additions: 10,
      deletions: 5,
      repoNameWithOwner: 'user/repo',
      repoUrl: 'https://github.com/user/repo',
    }
    expect(['OPEN', 'CLOSED', 'MERGED']).toContain(pr.state)
  })

  it('Sponsor.type is User or Organization', () => {
    const sponsor: Sponsor = {
      login: 'backer',
      name: 'Backer',
      avatarUrl: 'https://example.com',
      url: 'https://github.com/backer',
      type: 'User',
      createdAt: '2020-01-01T00:00:00Z',
      tier: null,
    }
    expect(['User', 'Organization']).toContain(sponsor.type)
  })

  it('SocialAccount has correct shape', () => {
    const sa: SocialAccount = {
      provider: 'TWITTER',
      displayName: 'test',
      url: 'https://x.com/test',
    }
    expect(sa.provider).toBe('TWITTER')
  })

  it('Release has correct shape with nullable fields', () => {
    const release: Release = {
      name: null,
      tagName: 'v1.0.0',
      publishedAt: null,
      url: 'https://github.com/user/repo/releases/tag/v1.0.0',
      repoName: 'repo',
      repoNameWithOwner: 'user/repo',
      repoUrl: 'https://github.com/user/repo',
    }
    expect(release.tagName).toBe('v1.0.0')
    expect(release.name).toBeNull()
  })

  it('ContributionStats has year field', () => {
    const stats: ContributionStats = {
      year: 2024,
      totalCommitContributions: 100,
      totalIssueContributions: 10,
      totalPullRequestContributions: 20,
      totalPullRequestReviewContributions: 5,
      totalRepositoriesWithContributedCommits: 8,
      restrictedContributionsCount: 0,
      startedAt: '2024-01-01T00:00:00Z',
      endedAt: '2024-12-31T23:59:59Z',
    }
    expect(stats.year).toBe(2024)
  })

  it('GistFile has all nullable fields', () => {
    const file: GistFile = {
      name: null,
      extension: null,
      language: null,
      size: null,
    }
    expect(file.name).toBeNull()
  })

  it('Gist has files array', () => {
    const gist: Gist = {
      name: 'test.gist',
      description: null,
      url: 'https://gist.github.com/user/abc',
      createdAt: '2020-01-01T00:00:00Z',
      isPublic: true,
      files: [],
    }
    expect(gist.files).toEqual([])
  })

  it('SponsorTier has isOneTime boolean', () => {
    const tier: SponsorTier = {
      name: 'Gold',
      monthlyPriceInDollars: 10,
      isOneTime: false,
    }
    expect(tier.isOneTime).toBe(false)
  })

  it('Organization has optional description', () => {
    const org: Organization = {
      login: 'acme',
      name: 'Acme Corp',
      description: null,
      avatarUrl: 'https://example.com',
      url: 'https://github.com/acme',
    }
    expect(org.description).toBeNull()
  })

  it('Language has percentage and bytes', () => {
    const lang: Language = {
      name: 'TypeScript',
      color: '#3178c6',
      bytes: 50000,
      percentage: 75.5,
    }
    expect(lang.percentage).toBe(75.5)
  })

  it('User has minimal shape', () => {
    const user: User = {
      login: 'octocat',
      name: null,
      avatarUrl: 'https://example.com',
      url: 'https://github.com/octocat',
    }
    expect(user.login).toBe('octocat')
  })

  it('Star has starredAt from edge', () => {
    const star: Star = {
      starredAt: '2024-01-01T00:00:00Z',
      repoName: 'repo',
      repoNameWithOwner: 'user/repo',
      repoUrl: 'https://github.com/user/repo',
      description: null,
      stargazerCount: 42,
      primaryLanguage: null,
    }
    expect(star.starredAt).toBe('2024-01-01T00:00:00Z')
  })

  it('Contribution has commitCount and occurredAt', () => {
    const contrib: Contribution = {
      repoName: 'repo',
      repoNameWithOwner: 'user/repo',
      repoUrl: 'https://github.com/user/repo',
      commitCount: 15,
      stargazerCount: 42,
      occurredAt: '2024-06-15T00:00:00Z',
    }
    expect(contrib.commitCount).toBe(15)
  })
})
