import { env } from 'cloudflare:test'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

// Shared sign-in for the RLS suite. Not a test file (no .test suffix).
// - One session per account per test file (vitest isolates modules per file).
// - Retries rate limiting / transient failures with increasing waits; never retries bad credentials.
// - Failure messages carry the account label plus Supabase's status, code and message, never the email or password.

export type Account = 'A' | 'B' | 'MODERATOR'

export type SignInFailure = { status?: number; code?: string; message?: string; name?: string }
export type SignInResult = { session: Session | null; error: SignInFailure | null }
export type Credentials = { email: string; password: string }
export type SignInFn = (credentials: Credentials) => Promise<SignInResult>

export const RETRY_DELAYS_MS = [2000, 5000, 10000]
// Worst case: 4 attempts + 17s of waiting. Pass as the describe timeout in RLS suites (the default is 5s).
export const SIGN_IN_TIMEOUT_MS = 60000

export function isRetryable(error: SignInFailure): boolean {
  if (error.code === 'invalid_credentials') return false
  if (error.message === 'Invalid login credentials') return false
  if (error.status === 429 || error.code === 'over_request_rate_limit') return true
  if (error.name === 'AuthRetryableFetchError') return true
  // status 0 / undefined: the request never got an HTTP answer (network failure)
  if (!error.status) return true
  return error.status >= 500
}

function scrub(text: string, credentials: Credentials): string {
  let out = text
  for (const secret of [credentials.email, credentials.password]) {
    if (secret) out = out.split(secret).join('[redacted]')
  }
  return out
}

export function describeFailure(account: Account, error: SignInFailure | null, credentials: Credentials): string {
  const status = error?.status ?? 'none'
  const code = error?.code ?? 'none'
  const message = scrub(error?.message ?? 'no session returned and no error reported', credentials)
  return `could not sign in as RLS_TEST_USER_${account}: status=${status} code=${code} message=${message}`
}

export function createSessionProvider(options: {
  signIn: SignInFn
  credentialsFor: (account: Account) => Credentials | undefined
  sleep?: (ms: number) => Promise<void>
  delaysMs?: number[]
}) {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const delays = options.delaysMs ?? RETRY_DELAYS_MS
  const cache = new Map<Account, Promise<Session>>()

  async function attemptSignIn(account: Account): Promise<Session> {
    const credentials = options.credentialsFor(account)
    if (!credentials) throw new Error(`RLS_TEST_USER_${account} credentials are not configured`)
    let failure: SignInFailure | null = null
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      let result: SignInResult
      try {
        result = await options.signIn(credentials)
      } catch (thrown) {
        const err = thrown as { message?: string; name?: string; status?: number; code?: string }
        result = {
          session: null,
          error: { message: err?.message, name: err?.name, status: err?.status, code: err?.code },
        }
      }
      if (result.session) return result.session
      failure = result.error
      if (failure && !isRetryable(failure)) break
      if (attempt < delays.length) await sleep(delays[attempt])
    }
    throw new Error(describeFailure(account, failure, credentials))
  }

  return {
    getSession(account: Account): Promise<Session> {
      let cached = cache.get(account)
      if (!cached) {
        cached = attemptSignIn(account)
        cache.set(account, cached)
        // do not cache failures: a later call in the same file gets a fresh attempt
        cached.catch(() => cache.delete(account))
      }
      return cached
    },
  }
}

function credentialsFor(account: Account): Credentials | undefined {
  const pairs: Record<Account, [string | undefined, string | undefined]> = {
    A: [env.RLS_TEST_USER_A_EMAIL, env.RLS_TEST_USER_A_PASSWORD],
    B: [env.RLS_TEST_USER_B_EMAIL, env.RLS_TEST_USER_B_PASSWORD],
    MODERATOR: [env.RLS_TEST_MODERATOR_EMAIL, env.RLS_TEST_MODERATOR_PASSWORD],
  }
  const [email, password] = pairs[account]
  return email && password ? { email, password } : undefined
}

const provider = createSessionProvider({
  credentialsFor,
  signIn: async (credentials) => {
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const { data, error } = await anon.auth.signInWithPassword(credentials)
    return {
      session: data?.session ?? null,
      error: error ? { status: error.status, code: error.code, message: error.message, name: error.name } : null,
    }
  },
})

/** The (cached) Supabase session for the account. */
export function getSession(account: Account): Promise<Session> {
  return provider.getSession(account)
}

/** A Supabase client authorised with the session's access token. */
export function clientForSession(session: Session): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
}

/** Session plus an authorised client, e.g. `const { session, client } = await signInAs('A')`. */
export async function signInAs(account: Account): Promise<{ session: Session; client: SupabaseClient }> {
  const session = await getSession(account)
  return { session, client: clientForSession(session) }
}
