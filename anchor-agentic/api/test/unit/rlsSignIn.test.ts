import { describe, expect, it } from 'vitest'
import {
  createSessionProvider,
  describeFailure,
  isRetryable,
  type Credentials,
  type SignInResult,
} from '../rls/support/signIn'

const creds: Credentials = { email: 'someone@mailinator.com', password: 'pw-secret-value' }
const fakeSession = { access_token: 'tok', user: { id: 'u1' } } as unknown as NonNullable<SignInResult['session']>
const rateLimited: SignInResult = {
  session: null,
  error: { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' },
}

function makeProvider(results: Array<SignInResult | Error>) {
  const sleeps: number[] = []
  let calls = 0
  const provider = createSessionProvider({
    credentialsFor: () => creds,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    signIn: async () => {
      const next = results[Math.min(calls++, results.length - 1)]
      if (next instanceof Error) throw next
      return next
    },
  })
  return { provider, sleeps, calls: () => calls }
}

describe('RLS sign-in helper', () => {
  it('classifies rate limiting and transient errors as retryable', () => {
    expect(isRetryable({ status: 429 })).toBe(true)
    expect(isRetryable({ code: 'over_request_rate_limit' })).toBe(true)
    expect(isRetryable({ status: 0, name: 'AuthRetryableFetchError' })).toBe(true)
    expect(isRetryable({ message: 'fetch failed' })).toBe(true)
    expect(isRetryable({ status: 503 })).toBe(true)
  })

  it('does not retry bad credentials', () => {
    expect(isRetryable({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(false)
    expect(isRetryable({ status: 400, message: 'Invalid login credentials' })).toBe(false)
  })

  it('caches one session per account', async () => {
    const { provider, calls } = makeProvider([{ session: fakeSession, error: null }])
    const [first, second] = await Promise.all([provider.getSession('A'), provider.getSession('A')])
    await provider.getSession('A')
    expect(first).toBe(second)
    expect(calls()).toBe(1)
  })

  it('retries rate limiting with increasing waits and then succeeds', async () => {
    const { provider, sleeps, calls } = makeProvider([
      rateLimited,
      new Error('network down'),
      { session: fakeSession, error: null },
    ])
    await expect(provider.getSession('B')).resolves.toBe(fakeSession)
    expect(calls()).toBe(3)
    expect(sleeps).toEqual([2000, 5000])
  })

  it('gives up after the last delay and reports account, status, code and message but no secrets', async () => {
    const { provider, sleeps, calls } = makeProvider([rateLimited])
    const failure = await provider.getSession('MODERATOR').then(
      () => null,
      (e: Error) => e,
    )
    expect(failure).not.toBeNull()
    expect(calls()).toBe(4)
    expect(sleeps).toEqual([2000, 5000, 10000])
    expect(failure!.message).toContain('MODERATOR')
    expect(failure!.message).toContain('status=429')
    expect(failure!.message).toContain('code=over_request_rate_limit')
    expect(failure!.message).toContain('Request rate limit reached')
    expect(failure!.message).not.toContain(creds.email)
    expect(failure!.message).not.toContain(creds.password)
  })

  it('does not retry invalid credentials and does not cache the failure', async () => {
    const bad: SignInResult = {
      session: null,
      error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
    }
    const { provider, sleeps, calls } = makeProvider([bad, { session: fakeSession, error: null }])
    await expect(provider.getSession('A')).rejects.toThrow(/status=400 code=invalid_credentials/)
    expect(calls()).toBe(1)
    expect(sleeps).toEqual([])
    await expect(provider.getSession('A')).resolves.toBe(fakeSession)
  })

  it('redacts credentials that appear inside the upstream message', () => {
    const message = describeFailure('A', { status: 400, message: `bad ${creds.email} / ${creds.password}` }, creds)
    expect(message).not.toContain(creds.email)
    expect(message).not.toContain(creds.password)
  })
})
