import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// workflow_steps has no owner_id of its own (see 0012_rls_policies_epic_b.sql)
// — ownership is derived via a subquery to the parent Workflow's owner_id.
// This proves that derived-ownership policy actually holds at the DB level,
// independent of workflows.ts's own Archived/ownership guards in the Worker.
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

describe.skipIf(!canRun)('workflow_steps RLS (ownership derived from parent Workflow)', () => {
  it("blocks user B from inserting, updating, or deleting a step on user A's workflow", async () => {
    const anonClientA = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const {
      data: { session: sessionA },
    } = await anonClientA.auth.signInWithPassword({
      email: env.RLS_TEST_USER_A_EMAIL,
      password: env.RLS_TEST_USER_A_PASSWORD,
    })
    if (!sessionA) throw new Error('could not sign in as RLS_TEST_USER_A')

    const clientA = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionA.access_token}` } },
    })

    const { data: role, error: roleError } = await clientA
      .from('roles')
      .insert({ name: 'RLS probe role for workflow_steps boundary', owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(roleError).toBeNull()

    const { data: task, error: taskError } = await clientA
      .from('tasks')
      .insert({ name: 'RLS probe task for workflow_steps boundary', role_id: role!.id, owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(taskError).toBeNull()

    const { data: workflow, error: workflowError } = await clientA
      .from('workflows')
      .insert({ name: 'RLS probe workflow', owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(workflowError).toBeNull()

    const { data: step, error: stepError } = await clientA
      .from('workflow_steps')
      .insert({ workflow_id: workflow!.id, order_index: 0, step_type: 'TASK', task_id: task!.id })
      .select('id')
      .single()
    expect(stepError).toBeNull()

    const anonClientB = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const {
      data: { session: sessionB },
    } = await anonClientB.auth.signInWithPassword({
      email: env.RLS_TEST_USER_B_EMAIL,
      password: env.RLS_TEST_USER_B_PASSWORD,
    })
    if (!sessionB) throw new Error('could not sign in as RLS_TEST_USER_B')

    const clientB = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionB.access_token}` } },
    })

    const { data: insertedByB, error: insertErrorByB } = await clientB
      .from('workflow_steps')
      .insert({ workflow_id: workflow!.id, order_index: 1, step_type: 'TASK', task_id: task!.id })
      .select('id')
    expect(insertedByB).toBeNull()
    expect(insertErrorByB).not.toBeNull()

    const { data: updatedByB, error: updateErrorByB } = await clientB
      .from('workflow_steps')
      .update({ order_index: 5 })
      .eq('id', step!.id)
      .select('id')
    expect(updateErrorByB).toBeNull()
    expect(updatedByB).toEqual([])

    const { data: deletedByB, error: deleteErrorByB } = await clientB
      .from('workflow_steps')
      .delete()
      .eq('id', step!.id)
      .select('id')
    expect(deleteErrorByB).toBeNull()
    expect(deletedByB).toEqual([])

    const { data: stillThere } = await clientA.from('workflow_steps').select('id').eq('id', step!.id).maybeSingle()
    expect(stillThere?.id).toBe(step!.id)

    await clientA.from('workflow_steps').delete().eq('id', step!.id)
    await clientA.from('workflows').delete().eq('id', workflow!.id)
    await clientA.from('tasks').delete().eq('id', task!.id)
    await clientA.from('roles').delete().eq('id', role!.id)
  })

  // US-012 (TC-21/TC-22): read visibility for registered/anon users, and the
  // owner's own update + delete rights, which the test above does not assert.
  it('lets any registered user read a Draft step, and hides it from anon with all writes blocked', async () => {
    const a = await signIn(env.RLS_TEST_USER_A_EMAIL, env.RLS_TEST_USER_A_PASSWORD)
    const b = await signIn(env.RLS_TEST_USER_B_EMAIL, env.RLS_TEST_USER_B_PASSWORD)
    const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const probe: Probe = {}

    try {
      await seedProbe(a, probe)

      // Sandbox is never private: another registered user can read the Draft step.
      const { data: readByB, error: readErrorB } = await b.client.from('workflow_steps').select('id').eq('id', probe.stepId!)
      expect(readErrorB).toBeNull()
      expect(readByB).toEqual([{ id: probe.stepId }])

      // Anon: no read of a Draft step, and no writes.
      const { data: readByAnon } = await anonClient.from('workflow_steps').select('id').eq('id', probe.stepId!)
      expect(readByAnon ?? []).toEqual([])
      const { data: insertedByAnon, error: insertErrorByAnon } = await anonClient
        .from('workflow_steps')
        .insert({ workflow_id: probe.workflowId, order_index: 1, step_type: 'TASK', task_id: probe.taskId })
        .select('id')
      expect(insertedByAnon).toBeNull()
      expect(insertErrorByAnon).not.toBeNull()
      const { data: updatedByAnon } = await anonClient
        .from('workflow_steps')
        .update({ order_index: 7 })
        .eq('id', probe.stepId!)
        .select('id')
      expect(updatedByAnon ?? []).toEqual([])
      const { data: deletedByAnon } = await anonClient.from('workflow_steps').delete().eq('id', probe.stepId!).select('id')
      expect(deletedByAnon ?? []).toEqual([])

      // The step survived the anon attempts.
      const { data: stillThere } = await a.client.from('workflow_steps').select('id, order_index').eq('id', probe.stepId!)
      expect(stillThere).toEqual([{ id: probe.stepId, order_index: 0 }])
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it('lets the owner update and then delete their own step', async () => {
    const a = await signIn(env.RLS_TEST_USER_A_EMAIL, env.RLS_TEST_USER_A_PASSWORD)
    const probe: Probe = {}

    try {
      await seedProbe(a, probe)

      const { data: updatedByOwner, error: updateErrorByOwner } = await a.client
        .from('workflow_steps')
        .update({ order_index: 3 })
        .eq('id', probe.stepId!)
        .select('id, order_index')
      expect(updateErrorByOwner).toBeNull()
      expect(updatedByOwner).toEqual([{ id: probe.stepId, order_index: 3 }])

      const { data: deletedByOwner, error: deleteErrorByOwner } = await a.client
        .from('workflow_steps')
        .delete()
        .eq('id', probe.stepId!)
        .select('id')
      expect(deleteErrorByOwner).toBeNull()
      expect(deletedByOwner).toEqual([{ id: probe.stepId }])
      const { data: gone } = await a.client.from('workflow_steps').select('id').eq('id', probe.stepId!)
      expect(gone).toEqual([])
    } finally {
      await cleanupProbe(a, probe)
    }
  })
})

type Session = Awaited<ReturnType<typeof signIn>>
type Probe = { roleId?: string; taskId?: string; workflowId?: string; stepId?: string }

async function signIn(email: string, password: string) {
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  const {
    data: { session },
  } = await anon.auth.signInWithPassword({ email, password })
  if (!session) throw new Error(`could not sign in as ${email}`)
  return {
    userId: session.user.id,
    client: createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    }),
  }
}

// Records each created id on `probe` as it goes, so cleanup removes whatever got created even if setup fails midway.
async function seedProbe(owner: Session, probe: Probe) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const { data: role, error: roleError } = await owner.client
    .from('roles')
    .insert({ name: `RLS probe role US-012 ${suffix}`, owner_id: owner.userId })
    .select('id')
    .single()
  expect(roleError).toBeNull()
  probe.roleId = role?.id

  const { data: task, error: taskError } = await owner.client
    .from('tasks')
    .insert({ name: `RLS probe task US-012 ${suffix}`, role_id: probe.roleId, owner_id: owner.userId })
    .select('id')
    .single()
  expect(taskError).toBeNull()
  probe.taskId = task?.id

  const { data: workflow, error: workflowError } = await owner.client
    .from('workflows')
    .insert({ name: `RLS probe workflow US-012 ${suffix}`, owner_id: owner.userId })
    .select('id, status')
    .single()
  expect(workflowError).toBeNull()
  probe.workflowId = workflow?.id
  expect(workflow?.status).toBe('Draft')

  const { data: step, error: stepError } = await owner.client
    .from('workflow_steps')
    .insert({ workflow_id: probe.workflowId, order_index: 0, step_type: 'TASK', task_id: probe.taskId })
    .select('id')
    .single()
  expect(stepError).toBeNull()
  probe.stepId = step?.id
}

async function cleanupProbe(owner: Session, probe: Probe) {
  if (probe.workflowId) await owner.client.from('workflow_steps').delete().eq('workflow_id', probe.workflowId)
  if (probe.workflowId) await owner.client.from('workflows').delete().eq('id', probe.workflowId)
  if (probe.taskId) await owner.client.from('tasks').delete().eq('id', probe.taskId)
  if (probe.roleId) await owner.client.from('roles').delete().eq('id', probe.roleId)
}
