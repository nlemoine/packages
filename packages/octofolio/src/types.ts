// @n5s/octofolio public types — flat interfaces for GitHub profile data

export interface SocialAccount {
  provider: string
  displayName: string
  url: string
}

export interface Profile {
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
  followersCount: number
  followingCount: number
  socialAccounts: SocialAccount[]
}

export interface Release {
  name: string | null
  tagName: string
  publishedAt: string | null
  url: string
  repoName: string
  repoNameWithOwner: string
  repoUrl: string
}

export interface Repo {
  name: string
  nameWithOwner: string
  url: string
  description: string | null
  isPrivate: boolean
  isFork: boolean
  stargazerCount: number
  forkCount: number
  primaryLanguage: string | null
  primaryLanguageColor: string | null
  topics: string[]
  createdAt: string
  pushedAt: string | null
  lastRelease: Release | null
}

export interface PullRequest {
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  createdAt: string
  additions: number
  deletions: number
  repoNameWithOwner: string
  repoUrl: string
}

export interface Issue {
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  createdAt: string
  number: number
  commentsCount: number
  repoNameWithOwner: string
  repoUrl: string
}

export interface Star {
  starredAt: string
  repoName: string
  repoNameWithOwner: string
  repoUrl: string
  description: string | null
  stargazerCount: number
  primaryLanguage: string | null
}

export type ContributionSource = 'owned' | 'org' | 'external'

export interface ContributionCommit {
  sha: string
  url: string
  message: string
  date: string
}

export interface Contribution {
  repoName: string
  repoNameWithOwner: string
  repoUrl: string
  commitCount: number
  stargazerCount: number
  occurredAt: string
  commits?: ContributionCommit[]
}

export interface ContributionStats {
  year: number
  totalCommitContributions: number
  totalIssueContributions: number
  totalPullRequestContributions: number
  totalPullRequestReviewContributions: number
  totalRepositoriesWithContributedCommits: number
  restrictedContributionsCount: number
  startedAt: string
  endedAt: string
}

export interface GistFile {
  name: string | null
  extension: string | null
  language: string | null
  size: number | null
}

export interface Gist {
  name: string
  description: string | null
  url: string
  createdAt: string
  isPublic: boolean
  files: GistFile[]
}

export interface SponsorTier {
  name: string
  monthlyPriceInDollars: number
  isOneTime: boolean
}

export interface Sponsor {
  login: string
  name: string | null
  avatarUrl: string
  url: string
  type: 'User' | 'Organization'
  createdAt: string
  tier: SponsorTier | null
}

export interface Organization {
  login: string
  name: string | null
  description: string | null
  avatarUrl: string
  url: string
}

export interface Language {
  name: string
  color: string | null
  bytes: number
  percentage: number
}

export interface User {
  login: string
  name: string | null
  avatarUrl: string
  url: string
}
