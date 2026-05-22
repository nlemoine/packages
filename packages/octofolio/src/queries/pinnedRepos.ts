export const PINNED_REPOS_QUERY = `
  query GetPinnedRepos($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6) {
        nodes {
          __typename
          ... on Repository {
            name
            nameWithOwner
            url
            description
            isPrivate
            isFork
            stargazerCount
            forkCount
            primaryLanguage { name color }
            repositoryTopics(first: 10) { nodes { topic { name } } }
            createdAt
            pushedAt
            latestRelease { tagName name publishedAt url }
          }
        }
      }
    }
  }
`
