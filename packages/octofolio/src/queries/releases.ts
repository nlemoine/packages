export const RELEASES_QUERY = `
  query GetReleases($login: String!, $cursor: String) {
    user(login: $login) {
      repositoriesContributedTo(
        first: 100
        after: $cursor
        includeUserRepositories: true
        contributionTypes: [COMMIT, PULL_REQUEST]
      ) {
        nodes {
          name
          nameWithOwner
          url
          isPrivate
          releases(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              name
              tagName
              publishedAt
              url
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
