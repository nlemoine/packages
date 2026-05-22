// @n5s/octofolio entry point

// Client factory: plain export — runtime function value
export { createOctofolio } from './client.js'

// Errors: plain export — classes are runtime values
export {
  AuthError,
  GraphQLError,
  NotFoundError,
  RateLimitError,
} from './errors.js'
// Types: use 'export type' — interfaces are type-only (verbatimModuleSyntax)
export type {
  Contribution,
  ContributionCommit,
  ContributionSource,
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
} from './types.js'
