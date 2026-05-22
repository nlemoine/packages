export const PULL_REQUESTS_QUERY = `
  query GetPullRequests($login: String!, $state: PullRequestState!, $orderBy: IssueOrder!, $cursor: String) {
    user(login: $login) {
      pullRequests(first: 100, after: $cursor, states: [$state], orderBy: $orderBy) {
        nodes {
          title
          url
          state
          createdAt
          additions
          deletions
          repository { nameWithOwner url isPrivate }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
