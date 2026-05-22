export const ISSUES_QUERY = `
  query GetIssues($login: String!, $state: IssueState!, $orderBy: IssueOrder!, $cursor: String) {
    user(login: $login) {
      issues(first: 100, after: $cursor, states: [$state], orderBy: $orderBy) {
        nodes {
          title
          url
          state
          createdAt
          number
          comments { totalCount }
          repository { nameWithOwner url isPrivate }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
