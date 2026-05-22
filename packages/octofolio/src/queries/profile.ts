export const VIEWER_QUERY = `
  query GetViewer {
    viewer {
      login
    }
  }
`

export const PROFILE_QUERY = `
  query GetProfile {
    viewer {
      login
      name
      bio
      avatarUrl
      url
      email
      location
      company
      websiteUrl
      twitterUsername
      createdAt
      followers { totalCount }
      following { totalCount }
      socialAccounts(first: 10) {
        nodes {
          provider
          displayName
          url
        }
      }
    }
  }
`
