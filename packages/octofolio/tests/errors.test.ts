import { GraphqlResponseError } from '@octokit/graphql'
import { describe, expect, it } from 'vitest'
import { wrapError } from '../src/errors.js'
import {
  AuthError,
  GraphQLError,
  NotFoundError,
  RateLimitError,
} from '../src/index.js'

describe('error classes', () => {
  it('AuthError is instanceof Error and AuthError', () => {
    const err = new AuthError('forbidden')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.name).toBe('AuthError')
    expect(err.message).toBe('forbidden')
  })

  it('RateLimitError carries resetAt', () => {
    const err = new RateLimitError('rate limited', '2026-01-01T00:00:00Z')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(RateLimitError)
    expect(err.name).toBe('RateLimitError')
    expect(err.resetAt).toBe('2026-01-01T00:00:00Z')
  })

  it('RateLimitError accepts null resetAt', () => {
    const err = new RateLimitError('rate limited', null)
    expect(err.resetAt).toBeNull()
  })

  it('NotFoundError is instanceof Error and NotFoundError', () => {
    const err = new NotFoundError('not found')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(NotFoundError)
    expect(err.name).toBe('NotFoundError')
  })

  it('GraphQLError is instanceof Error and GraphQLError', () => {
    const err = new GraphQLError('query failed')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(GraphQLError)
    expect(err.name).toBe('GraphQLError')
  })

  it('error classes preserve cause', () => {
    const original = new Error('original')
    const err = new AuthError('wrapped', original)
    expect(err.cause).toBe(original)
  })
})

describe('wrapError', () => {
  function makeGraphqlResponseError(
    type: string,
    extensions?: Record<string, unknown>,
  ) {
    // GraphqlResponseError requires: request, headers, response
    // Cast to any to avoid strict-mode issues with internal Octokit types
    const request = { query: '{ viewer { login } }', variables: {} }
    const headers = { 'content-type': 'application/json' }
    const response = {
      data: null,
      errors: [
        {
          type,
          message: 'test error',
          extensions: extensions ?? {},
          path: ['viewer'],
          locations: [{ line: 1, column: 1 }],
        },
      ],
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new GraphqlResponseError(
      request as any,
      headers as any,
      response as any,
    )
  }

  it('maps RATE_LIMITED to RateLimitError', () => {
    const gqlErr = makeGraphqlResponseError('RATE_LIMITED', {
      reset_at: '2026-01-01T00:00:00Z',
    })
    expect(() => wrapError(gqlErr)).toThrow(RateLimitError)
    try {
      wrapError(gqlErr)
    } catch (e) {
      expect((e as RateLimitError).resetAt).toBe('2026-01-01T00:00:00Z')
    }
  })

  it('maps NOT_FOUND to NotFoundError', () => {
    const gqlErr = makeGraphqlResponseError('NOT_FOUND')
    expect(() => wrapError(gqlErr)).toThrow(NotFoundError)
  })

  it('maps FORBIDDEN to AuthError', () => {
    const gqlErr = makeGraphqlResponseError('FORBIDDEN')
    expect(() => wrapError(gqlErr)).toThrow(AuthError)
  })

  it('maps UNAUTHORIZED to AuthError', () => {
    const gqlErr = makeGraphqlResponseError('UNAUTHORIZED')
    expect(() => wrapError(gqlErr)).toThrow(AuthError)
  })

  it('maps unknown type to GraphQLError', () => {
    const gqlErr = makeGraphqlResponseError('SOME_OTHER_TYPE')
    expect(() => wrapError(gqlErr)).toThrow(GraphQLError)
  })

  it('re-throws non-GraphqlResponseError as-is', () => {
    const plain = new Error('plain error')
    expect(() => wrapError(plain)).toThrow(plain)
  })
})
