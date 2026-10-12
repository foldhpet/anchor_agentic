import { env } from 'cloudflare:test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SIGN_IN_TIMEOUT_MS, signInAs } from './support/signIn'

// delete_workflow_step / reorder_workflow_steps (0024_workflow_step_rpcs.sql)
// run as SECURITY INVOKER, so the caller's RLS still applies. This proves, with
// no Hono Worker in the path, that they are atomic (one version bump, one
// snapshot, gapless order) and that a non-owner or anon caller cannot use them.
//
// Requires the linked cloud project with 0024 applied, plus the credentials
// described in sandboxItems.rls.test.ts.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD

type Session = Awaited<ReturnType<typeof signInAs>>
type Probe = { roleId?: string; taskId?: string; workflowId?: string; stepIds: string[] }

// Records ids on `probe` as it goes so cleanup works even if setup fails midway.
async function seedWorkflowWithSteps(owner: Session, probe: Probe, stepCount: number) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const { data: role, error: roleError } = await owner.client
    .from('roles')
    .insert({ name: `RLS probe role step-rpc ${suffix}`, owner_id: owner.session.user.id })
    .select('id')
    .single()
  expect(roleError).toBeNull()
  probe.roleId = role?.id

  const { data: task, error: taskError } = await owner.client
    .from('tasks')
    .insert({ name: `RLS probe task step-rpc ${suffix}`, role_id: probe.roleId, owner_id: owner.session.user.id })
    .select('id')
    .single()
  expect(taskError).toBeNull()
  probe.taskId = task?.id

  const { data: workflow, error: workflowError } = await owner.client
    .from('workflows')
    .insert({ name: `RLS probe workflow step-rpc ${suffix}`, owner_id: owner.session.user.id })
    .select('id')
    .single()
  expect(workflowError).toBeNull()
  probe.workflowId = workflow?.id

  for (let i = 0; i < stepCount; i++) {
    const { data: step, error: stepError } = await owner.client
      .from('workflow_steps')
      .insert({ workflow_id: probe.workflowId, order_index: i, step_type: 'TASK', task_id: probe.taskId })
      .select('id')
      .single()
    expect(stepError).toBeNull()
    probe.stepIds.push(step!.id)
  }
}

async function cleanupProbe(owner: Session, probe: Probe) {
  if (probe.workflowId) {
    await owner.client.from('workflow_steps').delete().eq('workflow_id', probe.workflowId)
    await owner.client.from('workflows').delete().eq('id', probe.workflowId)
    // version_snapshots is append-only for clients; leftover probe snapshots are harmless.
  }
  if (probe.taskId) await owner.client.from('tasks').delete().eq('id', probe.taskId)
  if (probe.roleId) await owner.client.from('roles').delete().eq('id', probe.roleId)
}

async function stepOrder(client: SupabaseClient, workflowId: string) {
  const { data } = await client
    .from('workflow_steps')
    .select('id, order_index')
    .eq('workflow_id', workflowId)
    .order('order_index', { ascending: true })
  return data ?? []
}

async function currentVersion(client: SupabaseClient, workflowId: string) {
  const { data } = await client.from('workflows').select('current_version').eq('id', workflowId).single()
  return data!.current_version as number
}

describe.skipIf(!canRun)('workflow step RPCs (atomic, invoker-rights)', { timeout: SIGN_IN_TIMEOUT_MS }, () => {
  it('delete_workflow_step removes the step, closes the gap, bumps the version once and writes one snapshot', async () => {
    const a = await signInAs('A')
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 3)
      const before = await currentVersion(a.client, probe.workflowId!)

      const { data, error } = await a.client.rpc('delete_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_id: probe.stepIds[1],
      })
      expect(error).toBeNull()
      expect(data.workflow.current_version).toBe(before + 1)
      expect(data.steps.map((s: { id: string }) => s.id)).toEqual([probe.stepIds[0], probe.stepIds[2]])

      expect(await stepOrder(a.client, probe.workflowId!)).toEqual([
        { id: probe.stepIds[0], order_index: 0 },
        { id: probe.stepIds[2], order_index: 1 },
      ])
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before + 1)

      const { data: snapshots } = await a.client
        .from('version_snapshots')
        .select('version_number, snapshot_data')
        .eq('item_type', 'WORKFLOW')
        .eq('item_id', probe.workflowId!)
        .eq('version_number', before + 1)
      expect(snapshots).toHaveLength(1)
      expect(snapshots![0].snapshot_data.steps).toHaveLength(2)
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it('delete_workflow_step refuses to empty a Published workflow and changes nothing', async () => {
    const a = await signInAs('A')
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 1)
      await a.client.from('workflows').update({ status: 'Published' }).eq('id', probe.workflowId!)
      const before = await currentVersion(a.client, probe.workflowId!)

      const { error } = await a.client.rpc('delete_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_id: probe.stepIds[0],
      })
      expect(error?.message).toBe('workflow_has_no_steps')
      expect(await stepOrder(a.client, probe.workflowId!)).toHaveLength(1)
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before)
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it('reorder_workflow_steps applies the order and bumps the version once; a mismatched set changes nothing', async () => {
    const a = await signInAs('A')
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 3)
      const before = await currentVersion(a.client, probe.workflowId!)
      const [s0, s1, s2] = probe.stepIds

      const { error: mismatch } = await a.client.rpc('reorder_workflow_steps', {
        p_workflow_id: probe.workflowId,
        p_step_ids: [s0, s1],
      })
      expect(mismatch?.message).toBe('step_set_mismatch')
      expect((await stepOrder(a.client, probe.workflowId!)).map((s) => s.id)).toEqual([s0, s1, s2])
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before)

      const { error } = await a.client.rpc('reorder_workflow_steps', {
        p_workflow_id: probe.workflowId,
        p_step_ids: [s2, s0, s1],
      })
      expect(error).toBeNull()
      expect(await stepOrder(a.client, probe.workflowId!)).toEqual([
        { id: s2, order_index: 0 },
        { id: s0, order_index: 1 },
        { id: s1, order_index: 2 },
      ])
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before + 1)
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it("blocks a non-owner from deleting or reordering another user's steps, and anon from calling the functions at all", async () => {
    const a = await signInAs('A')
    const b = await signInAs('B')
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 2)
      const before = await currentVersion(a.client, probe.workflowId!)

      const { error: delByB } = await b.client.rpc('delete_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_id: probe.stepIds[0],
      })
      expect(delByB?.message).toBe('not_found')

      const { error: reorderByB } = await b.client.rpc('reorder_workflow_steps', {
        p_workflow_id: probe.workflowId,
        p_step_ids: [probe.stepIds[1], probe.stepIds[0]],
      })
      expect(reorderByB?.message).toBe('not_found')

      const { error: delByAnon } = await anon.rpc('delete_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_id: probe.stepIds[0],
      })
      expect(delByAnon).not.toBeNull()

      expect((await stepOrder(a.client, probe.workflowId!)).map((s) => s.id)).toEqual(probe.stepIds)
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before)
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it('add_workflow_step appends at the end, bumps the version once and writes one snapshot', async () => {
    const a = await signInAs('A')
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 2)
      const before = await currentVersion(a.client, probe.workflowId!)

      const { data, error } = await a.client.rpc('add_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_type: 'TASK',
        p_task_id: probe.taskId,
        p_agent_id: null,
        p_skill_id: null,
      })
      expect(error).toBeNull()
      expect(data.workflow.current_version).toBe(before + 1)
      expect(data.steps.map((s: { order_index: number }) => s.order_index)).toEqual([0, 1, 2])
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before + 1)

      const { data: snapshots } = await a.client
        .from('version_snapshots')
        .select('snapshot_data')
        .eq('item_type', 'WORKFLOW')
        .eq('item_id', probe.workflowId!)
        .eq('version_number', before + 1)
      expect(snapshots).toHaveLength(1)
      expect(snapshots![0].snapshot_data.steps).toHaveLength(3)
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it('add_workflow_step rejects a reference that breaks the one-field invariant and changes nothing', async () => {
    const a = await signInAs('A')
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 1)
      const before = await currentVersion(a.client, probe.workflowId!)

      const { error } = await a.client.rpc('add_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_type: 'TASK',
        p_task_id: probe.taskId,
        p_agent_id: probe.taskId, // a second reference field: the table CHECK must refuse it
        p_skill_id: null,
      })
      expect(error).not.toBeNull()
      expect(await stepOrder(a.client, probe.workflowId!)).toHaveLength(1)
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before)
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it('update_workflow_step edits in place without touching order, bumps once; an unknown step changes nothing', async () => {
    const a = await signInAs('A')
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 2)
      const before = await currentVersion(a.client, probe.workflowId!)

      const { error: missing } = await a.client.rpc('update_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_id: '00000000-0000-0000-0000-000000000000',
        p_step_type: 'TASK',
        p_task_id: probe.taskId,
        p_agent_id: null,
        p_skill_id: null,
      })
      expect(missing?.message).toBe('step_not_found')
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before)

      const { data, error } = await a.client.rpc('update_workflow_step', {
        p_workflow_id: probe.workflowId,
        p_step_id: probe.stepIds[0],
        p_step_type: 'TASK',
        p_task_id: probe.taskId,
        p_agent_id: null,
        p_skill_id: null,
      })
      expect(error).toBeNull()
      expect(data.workflow.current_version).toBe(before + 1)
      expect((await stepOrder(a.client, probe.workflowId!)).map((s) => s.id)).toEqual(probe.stepIds)
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before + 1)
    } finally {
      await cleanupProbe(a, probe)
    }
  })

  it("blocks a non-owner from adding or editing steps on another user's workflow, and anon from calling them", async () => {
    const a = await signInAs('A')
    const b = await signInAs('B')
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const probe: Probe = { stepIds: [] }
    try {
      await seedWorkflowWithSteps(a, probe, 1)
      const before = await currentVersion(a.client, probe.workflowId!)
      const addArgs = {
        p_workflow_id: probe.workflowId,
        p_step_type: 'TASK',
        p_task_id: probe.taskId,
        p_agent_id: null,
        p_skill_id: null,
      }
      const editArgs = { ...addArgs, p_step_id: probe.stepIds[0] }

      expect((await b.client.rpc('add_workflow_step', addArgs)).error?.message).toBe('not_found')
      expect((await b.client.rpc('update_workflow_step', editArgs)).error?.message).toBe('not_found')
      expect((await anon.rpc('add_workflow_step', addArgs)).error).not.toBeNull()
      expect((await anon.rpc('update_workflow_step', editArgs)).error).not.toBeNull()

      expect(await stepOrder(a.client, probe.workflowId!)).toHaveLength(1)
      expect(await currentVersion(a.client, probe.workflowId!)).toBe(before)
    } finally {
      await cleanupProbe(a, probe)
    }
  })
})
