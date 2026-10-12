import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { clientForSession, getSession, SIGN_IN_TIMEOUT_MS } from './support/signIn'

// Proves RLS enforces clone_records' append-only, self-attributed-insert
// policy independently of the Worker's own logic (clone.ts always sets
// cloned_by from the verified JWT) — Architecture Decision 6: RLS is an
// independent second layer.
//
// Unlike an UPDATE `using` clause, an INSERT `with check` violation is a
// hard error rather than a silently-filtered zero-row result — see
// 0014_clone_records.sql's `creator_insert` policy.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD

const FAKE_SOURCE_ID = '00000000-0000-0000-0000-000000000001'
const FAKE_CLONED_ID = '00000000-0000-0000-0000-000000000002'

describe.skipIf(!canRun)('clone_records RLS policies', { timeout: SIGN_IN_TIMEOUT_MS }, () => {
  it("blocks user B from inserting a clone_records row attributed to user A", async () => {
    const sessionA = await getSession('A')

    const sessionB = await getSession('B')

    const clientB = clientForSession(sessionB)
    const { data: inserted, error: insertError } = await clientB
      .from('clone_records')
      .insert({
        source_item_type: 'SKILL',
        source_item_id: FAKE_SOURCE_ID,
        cloned_item_id: FAKE_CLONED_ID,
        cloned_by: sessionA.user.id,
      })
      .select('id')

    // An INSERT `with check` violation is a hard error, not a filtered result.
    expect(insertError).not.toBeNull()
    expect(inserted).toBeNull()
  })

  it('lets any authenticated user read a clone_records row they do not own (needed for cloneCount)', async () => {
    const sessionA = await getSession('A')

    const clientA = clientForSession(sessionA)
    const { data: created, error: insertError } = await clientA
      .from('clone_records')
      .insert({
        source_item_type: 'SKILL',
        source_item_id: FAKE_SOURCE_ID,
        cloned_item_id: FAKE_CLONED_ID,
        cloned_by: sessionA.user.id,
      })
      .select('id')
      .single()
    expect(insertError).toBeNull()

    const sessionB = await getSession('B')

    const clientB = clientForSession(sessionB)
    const { data: readByB, error: readError } = await clientB
      .from('clone_records')
      .select('id')
      .eq('id', created!.id)
      .maybeSingle()

    expect(readError).toBeNull()
    expect(readByB?.id).toBe(created!.id)

    // No cleanup: clone_records is append-only by design (0014's migration
    // defines no delete policy), same tradeoff as version_snapshots.
  })
})
