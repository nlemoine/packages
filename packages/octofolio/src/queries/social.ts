export const FOLLOWERS_QUERY = `
  query GetFollowers($login: String!, $cursor: String) {
    user(login: $login) {
      followers(first: 100, after: $cursor) {
        nodes {
          login
          name
          avatarUrl
          url
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

export const FOLLOWING_QUERY = `
  query GetFollowing($login: String!, $cursor: String) {
    user(login: $login) {
      following(first: 100, after: $cursor) {
        nodes {
          login
          name
          avatarUrl
          url
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

export const ORGS_QUERY = `
  query GetOrganizations($login: String!, $cursor: String) {
    user(login: $login) {
      organizations(first: 100, after: $cursor) {
        nodes {
          login
          name
          description
          avatarUrl
          url
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
