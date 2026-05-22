import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const server = setupServer(
  http.post('https://api.github.com/graphql', () => {
    return HttpResponse.json({
      data: {
        viewer: { login: 'test-user' },
      },
    })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('@n5s/octofolio', () => {
  it('placeholder: vitest runs', () => {
    expect(true).toBe(true)
  })

  it('placeholder: msw intercepts GraphQL requests', async () => {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ viewer { login } }' }),
    })
    const json = await response.json()
    expect(json.data.viewer.login).toBe('test-user')
  })
})
