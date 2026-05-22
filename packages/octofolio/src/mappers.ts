import type {
  Contribution,
  ContributionStats,
  Gist,
  Issue,
  Organization,
  Profile,
  PullRequest,
  Release,
  Repo,
  SocialAccount,
  Sponsor,
  Star,
  User,
} from './types.js'

export interface RawProfileUser {
  login: string
  name: string | null
  bio: string | null
  avatarUrl: string
  url: string
  email: string
  location: string | null
  company: string | null
  websiteUrl: string | null
  twitterUsername: string | null
  createdAt: string
  followers: { totalCount: number }
  following: { totalCount: number }
  socialAccounts: {
    nodes: Array<{
      provider: string
      displayName: string
      url: string
    } | null> | null
  }
}

export interface RawRepoNode {
  name: string
  nameWithOwner: string
  url: string
  description: string | null
  isPrivate: boolean
  isFork: boolean
  stargazerCount: number
  forkCount: number
  primaryLanguage: { name: string; color: string | null } | null
  repositoryTopics: { nodes: Array<{ topic: { name: string } } | null> | null }
  createdAt: string
  pushedAt: string | null
  latestRelease: {
    tagName: string
    name: string | null
    publishedAt: string | null
    url: string
  } | null
}

export function mapRepo(raw: RawRepoNode): Repo {
  let lastRelease: Release | null = null
  if (raw.latestRelease !== null) {
    lastRelease = {
      tagName: raw.latestRelease.tagName,
      name: raw.latestRelease.name,
      publishedAt: raw.latestRelease.publishedAt,
      url: raw.latestRelease.url,
      repoName: raw.name,
      repoNameWithOwner: raw.nameWithOwner,
      repoUrl: raw.url,
    }
  }

  return {
    name: raw.name,
    nameWithOwner: raw.nameWithOwner,
    url: raw.url,
    description: raw.description,
    isPrivate: raw.isPrivate,
    isFork: raw.isFork,
    stargazerCount: raw.stargazerCount,
    forkCount: raw.forkCount,
    primaryLanguage: raw.primaryLanguage?.name ?? null,
    primaryLanguageColor: raw.primaryLanguage?.color ?? null,
    topics: (raw.repositoryTopics.nodes ?? [])
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .map((n) => n.topic.name),
    createdAt: raw.createdAt,
    pushedAt: raw.pushedAt,
    lastRelease,
  }
}

export interface RawPullRequestNode {
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  createdAt: string
  additions: number
  deletions: number
  repository: { nameWithOwner: string; url: string; isPrivate: boolean }
}

export function mapPullRequest(raw: RawPullRequestNode): PullRequest {
  return {
    title: raw.title,
    url: raw.url,
    state: raw.state,
    createdAt: raw.createdAt,
    additions: raw.additions,
    deletions: raw.deletions,
    repoNameWithOwner: raw.repository.nameWithOwner,
    repoUrl: raw.repository.url,
  }
}

export interface RawIssueNode {
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  createdAt: string
  number: number
  comments: { totalCount: number }
  repository: { nameWithOwner: string; url: string; isPrivate: boolean }
}

export function mapIssue(raw: RawIssueNode): Issue {
  return {
    title: raw.title,
    url: raw.url,
    state: raw.state,
    createdAt: raw.createdAt,
    number: raw.number,
    commentsCount: raw.comments.totalCount,
    repoNameWithOwner: raw.repository.nameWithOwner,
    repoUrl: raw.repository.url,
  }
}

export interface RawStarEdge {
  starredAt: string
  node: {
    name: string
    nameWithOwner: string
    url: string
    description: string | null
    isPrivate: boolean
    stargazerCount: number
    primaryLanguage: { name: string; color: string | null } | null
  }
}

export function mapStar(raw: RawStarEdge): Star {
  return {
    starredAt: raw.starredAt,
    repoName: raw.node.name,
    repoNameWithOwner: raw.node.nameWithOwner,
    repoUrl: raw.node.url,
    description: raw.node.description,
    stargazerCount: raw.node.stargazerCount,
    primaryLanguage: raw.node.primaryLanguage?.name ?? null,
  }
}

interface RawGistFile {
  name: string | null
  extension: string | null
  language: { name: string } | null
  size: number | null
}

export interface RawGistNode {
  name: string
  description: string | null
  url: string
  createdAt: string
  isPublic: boolean
  files: Array<RawGistFile | null> | null
}

export function mapGist(raw: RawGistNode): Gist {
  return {
    name: raw.name,
    description: raw.description,
    url: raw.url,
    createdAt: raw.createdAt,
    isPublic: raw.isPublic,
    files: (raw.files ?? [])
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map((f) => ({
        name: f.name,
        extension: f.extension,
        language: f.language?.name ?? null,
        size: f.size,
      })),
  }
}

export function mapProfile(raw: RawProfileUser): Profile {
  return {
    login: raw.login,
    name: raw.name,
    bio: raw.bio,
    avatarUrl: raw.avatarUrl,
    url: raw.url,
    email: raw.email,
    location: raw.location,
    company: raw.company,
    websiteUrl: raw.websiteUrl,
    twitterUsername: raw.twitterUsername,
    createdAt: raw.createdAt,
    followersCount: raw.followers.totalCount,
    followingCount: raw.following.totalCount,
    socialAccounts: (raw.socialAccounts.nodes ?? [])
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .map((n) => ({
        provider: n.provider,
        displayName: n.displayName,
        url: n.url,
      })),
  }
}

export interface RawUserNode {
  login: string
  name: string | null
  avatarUrl: string
  url: string
}

export function mapUser(raw: RawUserNode): User {
  return {
    login: raw.login,
    name: raw.name,
    avatarUrl: raw.avatarUrl,
    url: raw.url,
  }
}

export interface RawOrganizationNode {
  login: string
  name: string | null
  description: string | null
  avatarUrl: string
  url: string
}

export function mapOrganization(raw: RawOrganizationNode): Organization {
  return {
    login: raw.login,
    name: raw.name,
    description: raw.description,
    avatarUrl: raw.avatarUrl,
    url: raw.url,
  }
}

// ─── pinnedRepos ──────────────────────────────────────────────────────────────

export type RawPinnedItemNode =
  | ({ __typename: 'Repository' } & RawRepoNode)
  | { __typename: 'Gist' }
  | { __typename: string }

export function mapPinnedRepos(nodes: Array<RawPinnedItemNode | null>): Repo[] {
  return nodes
    .filter(
      (n): n is { __typename: 'Repository' } & RawRepoNode =>
        n !== null && n.__typename === 'Repository',
    )
    .map(mapRepo)
}

// ─── contributions ────────────────────────────────────────────────────────────

export interface RawCommitContributionsByRepo {
  repository: {
    name: string
    nameWithOwner: string
    url: string
    isPrivate: boolean
    isFork: boolean
    stargazerCount: number
    owner: { login: string }
  }
  contributions: {
    totalCount: number
    nodes: Array<{ occurredAt: string }>
  }
}

export function mapContribution(
  raw: RawCommitContributionsByRepo,
  startedAt: string,
): Contribution {
  // Use the most recent contribution date if available, otherwise fall back to collection startedAt
  const occurredAt = raw.contributions.nodes[0]?.occurredAt ?? startedAt
  return {
    repoName: raw.repository.name,
    repoNameWithOwner: raw.repository.nameWithOwner,
    repoUrl: raw.repository.url,
    commitCount: raw.contributions.totalCount,
    stargazerCount: raw.repository.stargazerCount,
    occurredAt,
  }
}

// ─── contributionStats ────────────────────────────────────────────────────────

export interface RawContributionStatsCollection {
  startedAt: string
  endedAt: string
  totalCommitContributions: number
  totalIssueContributions: number
  totalPullRequestContributions: number
  totalPullRequestReviewContributions: number
  totalRepositoriesWithContributedCommits: number
  restrictedContributionsCount: number
}

// ─── sponsors / sponsoring ────────────────────────────────────────────────────

type RawSponsorEntity =
  | {
      __typename: 'User'
      login: string
      name: string | null
      avatarUrl: string
      url: string
    }
  | {
      __typename: 'Organization'
      login: string
      name: string | null
      avatarUrl: string
      url: string
    }
  | { __typename: string }

export interface RawSponsorshipNode {
  createdAt: string
  sponsorEntity: RawSponsorEntity | null
  tier: {
    name: string
    monthlyPriceInDollars: number
    isOneTime: boolean
  } | null
}

type RawKnownSponsorEntity =
  | {
      __typename: 'User'
      login: string
      name: string | null
      avatarUrl: string
      url: string
    }
  | {
      __typename: 'Organization'
      login: string
      name: string | null
      avatarUrl: string
      url: string
    }

function isKnownSponsorEntity(
  entity: RawSponsorEntity,
): entity is RawKnownSponsorEntity {
  return entity.__typename === 'User' || entity.__typename === 'Organization'
}

export function mapSponsorship(raw: RawSponsorshipNode): Sponsor | null {
  const entity = raw.sponsorEntity
  if (!entity) return null
  if (!isKnownSponsorEntity(entity)) return null
  return {
    login: entity.login,
    name: entity.name,
    avatarUrl: entity.avatarUrl,
    url: entity.url,
    type: entity.__typename,
    createdAt: raw.createdAt,
    tier: raw.tier
      ? {
          name: raw.tier.name,
          monthlyPriceInDollars: raw.tier.monthlyPriceInDollars,
          isOneTime: raw.tier.isOneTime,
        }
      : null,
  }
}

// ─── releases ─────────────────────────────────────────────────────────────────

export interface RawReleaseNode {
  name: string | null
  tagName: string
  publishedAt: string | null
  url: string
}

export interface RawContributedRepoNode {
  name: string
  nameWithOwner: string
  url: string
  isPrivate: boolean
  releases: {
    nodes: Array<RawReleaseNode | null> | null
  } | null
}

export function mapRelease(
  raw: RawReleaseNode,
  repo: { name: string; nameWithOwner: string; url: string },
): Release {
  return {
    name: raw.name,
    tagName: raw.tagName,
    publishedAt: raw.publishedAt,
    url: raw.url,
    repoName: repo.name,
    repoNameWithOwner: repo.nameWithOwner,
    repoUrl: repo.url,
  }
}

// ─── languages ────────────────────────────────────────────────────────────────

export interface RawLanguageEdge {
  size: number
  node: { name: string; color: string | null }
}

export function mapContributionStats(
  raw: RawContributionStatsCollection,
): ContributionStats {
  return {
    year: new Date(raw.startedAt).getUTCFullYear(),
    totalCommitContributions: raw.totalCommitContributions,
    totalIssueContributions: raw.totalIssueContributions,
    totalPullRequestContributions: raw.totalPullRequestContributions,
    totalPullRequestReviewContributions:
      raw.totalPullRequestReviewContributions,
    totalRepositoriesWithContributedCommits:
      raw.totalRepositoriesWithContributedCommits,
    restrictedContributionsCount: raw.restrictedContributionsCount,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
  }
}
