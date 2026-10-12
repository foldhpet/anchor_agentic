import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { clientForSession, getSession, SIGN_IN_TIMEOUT_MS } from './support/signIn'

// Proves two independent DB-level invariants for Agents, bypassing the Hono
// app entirely so a bug in the Worker (agents.ts) can never make either
// pass by accident:
//   1. RLS blocks a non-owner write, same shape as roles.rls.test.ts.
//   2. unique(role_id) (Architecture Decision 5: one Agent per Role) holds
//      even against a raw insert that never went through the Worker's own
//      pre-check.
//
// Requires the linked cloud project's real credentials — see
// sandboxItems.rls.test.ts for the .dev.vars setup this shares.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD

describe.skipIf(!canRun)('agents RLS and unique(role_id) constraint', { timeout: SIGN_IN_TIMEOUT_MS }, () => {
  it("blocks user B from updating user A's agent even with a valid, unrelated JWT", async () => {
    const sessionA = await getSession('A')

    const clientA = clientForSession(sessionA)
    const { data: role, error: roleError } = await clientA
      .from('roles')
      .insert({ name: 'RLS probe role for agent boundary', owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(roleError).toBeNull()

    const { data: agent, error: agentError } = await clientA
      .from('agents')
      .insert({ role_id: role!.id, owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(agentError).toBeNull()

    const sessionB = await getSession('B')

    const clientB = clientForSession(sessionB)
    const { data: updated, error: updateError } = await clientB
      .from('agents')
      .update({ system_prompt: 'hijacked' })
      .eq('id', agent!.id)
      .select('id')

    expect(updateError).toBeNull()
    expect(updated).toEqual([])

    await clientA.from('agents').delete().eq('id', agent!.id)
    await clientA.from('roles').delete().eq('id', role!.id)
  })

  it('rejects a second Agent for the same Role with a raw insert, independent of the Worker pre-check', async () => {
    const sessionA = await getSession('A')

    const clientA = clientForSession(sessionA)
    const { data: role, error: roleError } = await clientA
      .from('roles')
      .insert({ name: 'RLS probe role for 1:1 constraint', owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(roleError).toBeNull()

    const { data: firstAgent, error: firstAgentError } = await clientA
      .from('agents')
      .insert({ role_id: role!.id, owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(firstAgentError).toBeNull()

    const { data: secondAgent, error: secondAgentError } = await clientA
      .from('agents')
      .insert({ role_id: role!.id, owner_id: sessionA.user.id })
      .select('id')
      .single()

    expect(secondAgent).toBeNull()
    expect(secondAgentError?.code).toBe('23505')

    await clientA.from('agents').delete().eq('id', firstAgent!.id)
    await clientA.from('roles').delete().eq('id', role!.id)
  })
})
