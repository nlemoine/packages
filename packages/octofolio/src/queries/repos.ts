const REPO_FIELDS = `
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
`

export const REPOS_QUERY = `
  query GetRepos($login: String!, $isFork: Boolean!, $orderBy: RepositoryOrder!, $cursor: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        privacy: PUBLIC
        isFork: $isFork
        ownerAffiliations: [OWNER]
        orderBy: $orderBy
      ) {
        nodes {
          ${REPO_FIELDS}
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

export const REPO_QUERY = `
  query GetRepo($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      ${REPO_FIELDS}
    }
  }
`
