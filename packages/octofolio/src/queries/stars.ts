export const STARS_QUERY = `
  query GetStars($login: String!, $orderBy: StarOrder!, $cursor: String) {
    user(login: $login) {
      starredRepositories(first: 100, after: $cursor, orderBy: $orderBy) {
        edges {
          starredAt
          node {
            name
            nameWithOwner
            url
            description
            stargazerCount
            isPrivate
            primaryLanguage { name color }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
