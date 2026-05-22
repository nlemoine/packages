export const REPOS_WITH_LANGUAGES_QUERY = `
  query GetReposWithLanguages($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        privacy: PUBLIC
        isFork: false
        ownerAffiliations: [OWNER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          nameWithOwner
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node { name color }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
