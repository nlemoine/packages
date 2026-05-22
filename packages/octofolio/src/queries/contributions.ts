export const CONTRIBUTIONS_QUERY = `
  query GetContributions($login: String!, $from: DateTime, $to: DateTime) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        startedAt
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            name
            nameWithOwner
            url
            isPrivate
            isFork
            stargazerCount
            owner { login }
          }
          contributions(first: 1, orderBy: {field: OCCURRED_AT, direction: DESC}) {
            totalCount
            nodes {
              occurredAt
            }
          }
        }
      }
    }
  }
`

export const CONTRIBUTION_STATS_QUERY = `
  query GetContributionStats($login: String!, $from: DateTime, $to: DateTime) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        startedAt
        endedAt
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoriesWithContributedCommits
        restrictedContributionsCount
      }
    }
  }
`
