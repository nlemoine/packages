import { GraphqlResponseError } from '@octokit/graphql'

// V8/Node.js extension — guarded so non-V8 engines work without it
function captureStackTrace(target: object): void {
  const ctor = (target as { constructor: unknown }).constructor
  if (
    typeof (Error as unknown as Record<string, unknown>)[
      'captureStackTrace'
    ] === 'function'
  ) {
    ;(
      Error as unknown as { captureStackTrace(t: object, c: unknown): void }
    ).captureStackTrace(target, ctor)
  }
}

export class AuthError extends Error {
  readonly name = 'AuthError' as const
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    captureStackTrace(this)
  }
}

export class RateLimitError extends Error {
  readonly name = 'RateLimitError' as const
  constructor(
    message: string,
    public readonly resetAt: string | null,
    public readonly cause?: unknown,
  ) {
    super(message)
    captureStackTrace(this)
  }
}

export class NotFoundError extends Error {
  readonly name = 'NotFoundError' as const
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    captureStackTrace(this)
  }
}

export class GraphQLError extends Error {
  readonly name = 'GraphQLError' as const
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    captureStackTrace(this)
  }
}

export function wrapError(e: unknown): never {
  if (e instanceof GraphqlResponseError) {
    const type = e.errors?.[0]?.type
    const msg = e.message
    if (type === 'RATE_LIMITED') {
      const resetAt =
        (e.errors?.[0]?.extensions?.['reset_at'] as string | undefined) ?? null
      throw new RateLimitError(msg, resetAt, e)
    }
    if (type === 'NOT_FOUND') throw new NotFoundError(msg, e)
    if (type === 'FORBIDDEN' || type === 'UNAUTHORIZED')
      throw new AuthError(msg, e)
    throw new GraphQLError(msg, e)
  }
  throw e
}
