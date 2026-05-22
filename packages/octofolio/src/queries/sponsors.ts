export const SPONSORS_QUERY = `
  query GetSponsors($login: String!, $cursor: String) {
    user(login: $login) {
      sponsorshipsAsMaintainer(
        first: 100
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          createdAt
          sponsorEntity {
            __typename
            ... on User {
              login
              name
              avatarUrl
              url
            }
            ... on Organization {
              login
              name
              avatarUrl
              url
            }
          }
          tier {
            name
            monthlyPriceInDollars
            isOneTime
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

export const SPONSORING_QUERY = `
  query GetSponsoring($login: String!, $cursor: String) {
    user(login: $login) {
      sponsorshipsAsSponsor(
        first: 100
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          createdAt
          sponsorEntity {
            __typename
            ... on User {
              login
              name
              avatarUrl
              url
            }
            ... on Organization {
              login
              name
              avatarUrl
              url
            }
          }
          tier {
            name
            monthlyPriceInDollars
            isOneTime
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`
