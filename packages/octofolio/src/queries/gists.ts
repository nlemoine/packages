export const GISTS_QUERY = `
  query GetGists($login: String!, $orderBy: GistOrder!, $cursor: String) {
    user(login: $login) {
      gists(first: 100, after: $cursor, privacy: PUBLIC, orderBy: $orderBy) {
        nodes {
          name
          description
          url
          createdAt
          isPublic
          files {
            name
            extension
            language { name }
            size
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
