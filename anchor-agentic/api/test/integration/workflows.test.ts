import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

const OWNER_ID = 'owner-1'
const OTHER_USER_ID = 'other-2'

function authedClient(fromImpl: () => ReturnType<typeof chain>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
    from: vi.fn(fromImpl),
  }
}

function authedClientWithFrom(fromMock: ReturnType<typeof vi.fn>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
    from: fromMock,
  }
}

const WORKFLOW = {
  id: 'wf-1',
  owner_id: OWNER_ID,
  name: 'Ship a feature',
  description: null,
  status: 'Draft',
  current_version: 1,
  created_at: 't',
  updated_at: 't',
}

describe('workflows routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/workflows', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('POST / rejects an empty name', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_name')
  })

  it('POST / creates a Draft workflow with zero steps and records a version 1 snapshot', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: WORKFLOW, error: null })) // insert into workflows
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ship a feature' }),
      },
      testEnv,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ workflow: WORKFLOW })
  })

  it('GET /:id/steps lists steps ordered by order_index', async () => {
    const steps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 't1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: steps, error: null })))

    const app = createApp()
    const res = await app.request('/api/v1/workflows/wf-1/steps', {}, testEnv)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ steps })
  })

  it('PATCH /:id 403s a non-owner', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'wf-1', owner_id: OTHER_USER_ID, current_version: 1 }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hijacked' }),
      },
      testEnv,
    )

    expect(res.status).toBe(403)
  })

  it('PATCH /:id bumps current_version', async () => {
    const updated = { ...WORKFLOW, name: 'Renamed', current_version: 2 }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: updated, error: null })) // main update
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps for snapshot
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: typeof updated }>()

    expect(res.status).toBe(200)
    expect(body.workflow.current_version).toBe(2)
  })

  it('POST /:id/steps rejects a step with no reference field populated', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() => chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_reference')
  })

  it('POST /:id/steps rejects referencing another owner’s non-Published task', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OTHER_USER_ID, status: 'Draft' }, error: null })) // canReference
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('reference_not_allowed')
  })

  it('POST /:id/steps appends a step at the end and bumps the workflow version', async () => {
    const newStepList = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: { id: 'task-1', owner_id: OWNER_ID, status: 'Draft' }, error: null })) // canReference (own item)
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps (existing, empty -> order_index 0)
      .mockReturnValueOnce(chain({ data: null, error: null })) // insert workflow_steps
      .mockReturnValueOnce(chain({ data: { ...WORKFLOW, current_version: 2 }, error: null })) // bumpAndSnapshot: workflows update
      .mockReturnValueOnce(chain({ data: newStepList, error: null })) // bumpAndSnapshot: loadSteps
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // workflows update (recordVersionSnapshot bump)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: { current_version: number }; steps: typeof newStepList }>()

    expect(res.status).toBe(201)
    expect(body.workflow.current_version).toBe(2)
    expect(body.steps).toEqual(newStepList)
  })

  it('DELETE /:id/steps/:stepId 404s a step that does not belong to the workflow', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps (existing, empty)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-missing',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('step_not_found')
  })

  it('DELETE /:id/steps/:stepId delegates the delete, renumber and version bump to the RPC', async () => {
    const existingSteps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const rpcResult = { workflow: { ...WORKFLOW, current_version: 2 }, steps: [] }
    const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: null })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: existingSteps, error: null })) // loadSteps (existing)
    createRequestSupabaseClient.mockReturnValue({ ...authedClientWithFrom(fromMock), rpc })

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ workflow: { current_version: number }; steps: unknown[] }>()

    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('delete_workflow_step', { p_workflow_id: 'wf-1', p_step_id: 'step-1' })
    expect(fromMock).toHaveBeenCalledTimes(2) // reads only: the route itself writes nothing
    expect(body.workflow.current_version).toBe(2)
    expect(body.steps).toEqual([])
  })

  it('PUT /:id/steps/reorder rejects a step_ids set that does not match the existing steps', async () => {
    const existingSteps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: existingSteps, error: null })) // loadSteps (existing)
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/reorder',
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: ['step-1', 'step-does-not-exist'] }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('step_set_mismatch')
  })

  it('PUT /:id/steps/reorder delegates the renumber and version bump to the RPC', async () => {
    const existingSteps = [
      { id: 'step-1', workflow_id: 'wf-1', order_index: 0, step_type: 'TASK', task_id: 'task-1', agent_id: null, skill_id: null, created_at: 't' },
      { id: 'step-2', workflow_id: 'wf-1', order_index: 1, step_type: 'TASK', task_id: 'task-2', agent_id: null, skill_id: null, created_at: 't' },
    ]
    const reorderedSteps = [existingSteps[1], existingSteps[0]]
    const rpc = vi.fn().mockResolvedValue({
      data: { workflow: { ...WORKFLOW, current_version: 2 }, steps: reorderedSteps },
      error: null,
    })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'wf-1', owner_id: OWNER_ID, current_version: 1 }, error: null })) // checkOwnership
      .mockReturnValueOnce(chain({ data: existingSteps, error: null })) // loadSteps (existing)
    createRequestSupabaseClient.mockReturnValue({ ...authedClientWithFrom(fromMock), rpc })

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/reorder',
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: ['step-2', 'step-1'] }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: { current_version: number }; steps: typeof reorderedSteps }>()

    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('reorder_workflow_steps', { p_workflow_id: 'wf-1', p_step_ids: ['step-2', 'step-1'] })
    expect(fromMock).toHaveBeenCalledTimes(2)
    expect(body.workflow.current_version).toBe(2)
    expect(body.steps).toEqual(reorderedSteps)
  })

  it('PATCH /:id 400s any edit once the item is Archived, even without a status field in the body', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Trying to edit anyway' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('PATCH /:id 400s Published -> Archived (only a Draft item can be archived)', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Published', current_version: 2 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('only_draft_can_be_archived')
  })

  it('PATCH /:id allows Draft -> Archived', async () => {
    const archived = { ...WORKFLOW, status: 'Archived', current_version: 2 }
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Draft', current_version: 1 }, error: null }),
      ) // checkOwnership
      .mockReturnValueOnce(chain({ data: archived, error: null })) // main update
      .mockReturnValueOnce(chain({ data: [], error: null })) // loadSteps for snapshot
      .mockReturnValueOnce(chain({ data: null, error: null })) // version_snapshots insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // version bump update
    createRequestSupabaseClient.mockReturnValue(authedClientWithFrom(fromMock))

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archived' }),
      },
      testEnv,
    )
    const body = await res.json<{ workflow: typeof archived }>()

    expect(res.status).toBe(200)
    expect(body.workflow.status).toBe('Archived')
  })

  it('POST /:id/steps 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('PATCH /:id/steps/:stepId 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-1',
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_type: 'TASK', task_id: 'task-1' }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('DELETE /:id/steps/:stepId 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/step-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })

  it('PUT /:id/steps/reorder 400s when the workflow is Archived', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chain({ data: { id: 'wf-1', owner_id: OWNER_ID, status: 'Archived', current_version: 3 }, error: null }),
      ),
    )

    const app = createApp()
    const res = await app.request(
      '/api/v1/workflows/wf-1/steps/reorder',
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: ['step-1'] }),
      },
      testEnv,
    )
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('archived_item_is_terminal')
  })
})

// US-012: table-aware fake that records every call with its filter arguments,
// so the tests can assert what was written and where (the ordered-mock style
// above cannot).
type Filter = [column: string, value: unknown]
type Call = {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  payload?: Record<string, unknown>
  filters: Filter[]
}
type Res = { data: unknown; error: unknown }

const RPC_OK = { workflow: { id: 'wf-1', current_version: 5 }, steps: [{ id: 's0', order_index: 0 }] }

function recordingClient(
  userId: string,
  queues: Record<string, Res[]>,
  rpcResult: Res = { data: RPC_OK, error: null },
) {
  const rpcCalls: { fn: string; args: unknown }[] = []
  const rpc = vi.fn((fn: string, args: unknown) => {
    rpcCalls.push({ fn, args })
    return Promise.resolve(rpcResult)
  })
  const calls: Call[] = []
  const ops: Call[] = [] // writes only, in call order
  const from = vi.fn((table: string) => {
    const queue = queues[table] ?? []
    const result = queue.length > 1 ? queue.shift()! : (queue[0] ?? { data: null, error: null })
    const call: Call = { table, op: 'select', filters: [] }
    calls.push(call)
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        call.filters.push([column, value])
        return builder
      },
      in: (column: string, value: unknown) => {
        call.filters.push([column, value])
        return builder
      },
      order: () => builder,
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      then: (f: (v: Res) => unknown) => f(result),
    }
    for (const op of ['insert', 'update', 'delete'] as const) {
      builder[op] = (payload?: Record<string, unknown>) => {
        call.op = op
        call.payload = payload
        ops.push(call)
        return builder
      }
    }
    return builder
  })
  return {
    client: { auth: { getUser: () => Promise.resolve({ data: { user: { id: userId } }, error: null }) }, from, rpc },
    ops,
    calls,
    rpcCalls,
  }
}

const step = (id: string, order_index: number, extra: Record<string, unknown> = {}) => ({
  id,
  workflow_id: 'wf-1',
  order_index,
  step_type: 'TASK',
  task_id: `task-${id}`,
  agent_id: null,
  skill_id: null,
  created_at: 't',
  ...extra,
})

const wfRow = (extra: Record<string, unknown> = {}) => ({
  id: 'wf-1',
  owner_id: OWNER_ID,
  status: 'Draft',
  current_version: 4,
  ...extra,
})

function patchStep(body: unknown, stepId = 's0') {
  return createApp().request(
    `/api/v1/workflows/wf-1/steps/${stepId}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    testEnv,
  )
}

function deleteStep(stepId: string) {
  return createApp().request(
    `/api/v1/workflows/wf-1/steps/${stepId}`,
    { method: 'DELETE', headers: { Authorization: 'Bearer whatever' } },
    testEnv,
  )
}

const snapshots = (ops: Call[]) => ops.filter((o) => o.table === 'version_snapshots' && o.op === 'insert')
const stepWrites = (ops: Call[]) => ops.filter((o) => o.table === 'workflow_steps')
const workflowWrites = (ops: Call[]) => ops.filter((o) => o.table === 'workflows')

// Expected write shapes. current_version 5 = wfRow's 4 + 1. The route's bumpAndSnapshot and
// recordVersionSnapshot each write it, so a successful mutation produces two identical workflow updates.
const stepUpdate = (id: string, payload: Record<string, unknown>) => ({
  table: 'workflow_steps',
  op: 'update',
  payload,
  filters: [['id', id]],
})
const orderUpdate = (id: string, order_index: number) => stepUpdate(id, { order_index })
const stepDelete = (id: string) => ({ table: 'workflow_steps', op: 'delete', payload: undefined, filters: [['id', id]] })
const versionBump = {
  table: 'workflows',
  op: 'update',
  payload: { current_version: 5, updated_at: expect.any(String) },
  filters: [['id', 'wf-1']],
}

describe('US-012 edit step (PATCH /:id/steps/:stepId)', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  function setup(refTable: string, ref: Res, existing = step('s0', 0), after: unknown[] = [step('s0', 0)]) {
    const { client, ops, calls } = recordingClient(OWNER_ID, {
      workflows: [
        { data: wfRow(), error: null },
        { data: { ...WORKFLOW, current_version: 5 }, error: null },
      ],
      workflow_steps: [
        { data: existing, error: null },
        { data: null, error: null },
        { data: after, error: null },
      ],
      [refTable]: [ref],
      version_snapshots: [{ data: null, error: null }],
    })
    createRequestSupabaseClient.mockReturnValue(client)
    return { ops, calls }
  }

  it('TC-01 changes Task A to Task C in place, bumps the version and records a new snapshot (AC1)', async () => {
    const { ops } = setup('tasks', { data: { id: 'task-c', owner_id: OWNER_ID, status: 'Draft' }, error: null })
    const res = await patchStep({ step_type: 'TASK', task_id: 'task-c' })

    expect(res.status).toBe(200)
    // order_index is not part of the payload, and only the targeted step is written.
    expect(stepWrites(ops)).toEqual([
      stepUpdate('s0', { step_type: 'TASK', task_id: 'task-c', agent_id: null, skill_id: null }),
    ])
    expect(workflowWrites(ops)).toEqual([versionBump, versionBump])
    const snaps = snapshots(ops)
    expect(snaps).toHaveLength(1)
    expect(snaps[0].payload).toMatchObject({ item_type: 'WORKFLOW', item_id: 'wf-1', version_number: 5 })
  })

  it('TC-02 same-type AGENT edit sets only agent_id, one snapshot', async () => {
    const { ops } = setup(
      'agents',
      { data: { id: 'agent-y', owner_id: OWNER_ID, status: 'Draft' }, error: null },
      step('s0', 0, { step_type: 'AGENT', task_id: null, agent_id: 'agent-x' }),
    )
    const res = await patchStep({ step_type: 'AGENT', agent_id: 'agent-y' })

    expect(res.status).toBe(200)
    expect(stepWrites(ops)).toEqual([
      stepUpdate('s0', { step_type: 'AGENT', task_id: null, agent_id: 'agent-y', skill_id: null }),
    ])
    expect(snapshots(ops)).toHaveLength(1)
  })

  it('TC-02 same-type SKILL edit sets only skill_id, one snapshot', async () => {
    const { ops } = setup(
      'skills',
      { data: { id: 'skill-q', owner_id: OWNER_ID, status: 'Draft' }, error: null },
      step('s0', 0, { step_type: 'SKILL', task_id: null, skill_id: 'skill-p' }),
    )
    const res = await patchStep({ step_type: 'SKILL', skill_id: 'skill-q' })

    expect(res.status).toBe(200)
    expect(stepWrites(ops)).toEqual([
      stepUpdate('s0', { step_type: 'SKILL', task_id: null, agent_id: null, skill_id: 'skill-q' }),
    ])
    expect(snapshots(ops)).toHaveLength(1)
  })

  it('TC-10 changing TASK to AGENT clears task_id and sets exactly agent_id (AC3)', async () => {
    const { ops } = setup('agents', { data: { id: 'agent-y', owner_id: OWNER_ID, status: 'Draft' }, error: null })
    const res = await patchStep({ step_type: 'AGENT', agent_id: 'agent-y' })

    expect(res.status).toBe(200)
    expect(stepWrites(ops)).toEqual([
      stepUpdate('s0', { step_type: 'AGENT', task_id: null, agent_id: 'agent-y', skill_id: null }),
    ])
    expect(snapshots(ops)).toHaveLength(1)
  })

  it('falls back to the existing step type when step_type is omitted', async () => {
    const { ops, calls } = setup(
      'agents',
      { data: { id: 'agent-y', owner_id: OWNER_ID, status: 'Draft' }, error: null },
      step('s0', 0, { step_type: 'AGENT', task_id: null, agent_id: 'agent-x' }),
    )
    const res = await patchStep({ agent_id: 'agent-y' })

    expect(res.status).toBe(200)
    // The reference is checked against the agents table, not tasks, because the existing type is AGENT.
    expect(calls.some((c) => c.table === 'agents')).toBe(true)
    expect(calls.some((c) => c.table === 'tasks')).toBe(false)
    expect(stepWrites(ops)).toEqual([
      stepUpdate('s0', { step_type: 'AGENT', task_id: null, agent_id: 'agent-y', skill_id: null }),
    ])
  })

  it('400s invalid_reference when step_type is omitted and the id does not match the existing step type', async () => {
    const { ops } = setup(
      'tasks',
      { data: { id: 't', owner_id: OWNER_ID, status: 'Draft' }, error: null },
      step('s0', 0, { step_type: 'AGENT', task_id: null, agent_id: 'agent-x' }),
    )
    const res = await patchStep({ task_id: 't' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_reference')
    expect(ops).toEqual([])
  })

  it('accepts a Published item owned by someone else as a reference, checking it by id', async () => {
    const { ops, calls } = setup('tasks', {
      data: { id: 'task-pub', owner_id: OTHER_USER_ID, status: 'Published' },
      error: null,
    })
    const res = await patchStep({ step_type: 'TASK', task_id: 'task-pub' })

    expect(res.status).toBe(200)
    expect(calls.find((c) => c.table === 'tasks')!.filters).toEqual([['id', 'task-pub']])
    expect(stepWrites(ops)).toEqual([
      stepUpdate('s0', { step_type: 'TASK', task_id: 'task-pub', agent_id: null, skill_id: null }),
    ])
  })

  it('TC-03 / TC-12 400s reference_not_allowed for a missing or foreign non-Published reference, no write', async () => {
    for (const ref of [
      { data: null, error: null },
      { data: { id: 'task-z', owner_id: OTHER_USER_ID, status: 'Draft' }, error: null },
    ]) {
      createRequestSupabaseClient.mockReset()
      const { ops } = setup('tasks', ref)
      const res = await patchStep({ step_type: 'TASK', task_id: 'task-z' })
      const body = await res.json<{ error: string }>()

      expect(res.status).toBe(400)
      expect(body.error).toBe('reference_not_allowed')
      expect(ops).toEqual([])
    }
  })

  it('TC-12 400s reference_not_allowed for a nonexistent agent_id', async () => {
    const { ops } = setup('agents', { data: null, error: null })
    const res = await patchStep({ step_type: 'AGENT', agent_id: 'ghost' })
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('reference_not_allowed')
    expect(ops).toEqual([])
  })

  it.each([
    ['no id at all', { step_type: 'TASK' }],
    ['AGENT without agent_id (AC3)', { step_type: 'AGENT' }],
    ['two refs', { step_type: 'TASK', task_id: 't', agent_id: 'a' }],
    ['AGENT with task_id and agent_id', { step_type: 'AGENT', task_id: 't', agent_id: 'a' }],
    ['id not matching type', { step_type: 'TASK', agent_id: 'a' }],
    ['unknown step_type', { step_type: 'BOGUS', task_id: 't' }],
    ['wrong JSON type for id', { step_type: 'TASK', task_id: 123 }],
    ['invalid JSON', '{not json'],
  ])('TC-04 / TC-11 400s invalid_reference for %s, no write and no snapshot', async (_name, body) => {
    const { ops } = setup('tasks', { data: { id: 't', owner_id: OWNER_ID, status: 'Draft' }, error: null })
    const res = await patchStep(body)
    const json = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(json.error).toBe('invalid_reference')
    expect(ops).toEqual([])
  })

  it('TC-05 404s step_not_found, looking the step up by id AND the path workflow_id', async () => {
    // The lookup is scoped to workflow_id, so a step of another workflow also comes back null.
    const { client, ops, calls } = recordingClient(OWNER_ID, {
      workflows: [{ data: wfRow(), error: null }],
      workflow_steps: [{ data: null, error: null }],
    })
    createRequestSupabaseClient.mockReturnValue(client)
    const res = await patchStep({ step_type: 'TASK', task_id: 't' }, 'other-wf-step')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('step_not_found')
    const lookups = calls.filter((c) => c.table === 'workflow_steps')
    expect(lookups).toHaveLength(1)
    expect(lookups[0].op).toBe('select')
    expect(lookups[0].filters).toEqual([
      ['id', 'other-wf-step'],
      ['workflow_id', 'wf-1'],
    ])
    expect(ops).toEqual([])
  })

  it('TC-17 403s a non-owner before reading the body and writes nothing', async () => {
    const { client, ops, calls } = recordingClient(OTHER_USER_ID, { workflows: [{ data: wfRow(), error: null }] })
    createRequestSupabaseClient.mockReturnValue(client)
    const res = await patchStep({ step_type: 'TASK', task_id: 't' })

    expect(res.status).toBe(403)
    expect(ops).toEqual([])
    expect(calls.map((c) => c.table)).toEqual(['workflows'])
  })

  it('TC-17 ignores owner_id / id / workflow_id in the owner request body: none reach a write', async () => {
    const { ops } = setup('tasks', { data: { id: 'task-c', owner_id: OWNER_ID, status: 'Draft' }, error: null })
    const res = await patchStep({
      step_type: 'TASK',
      task_id: 'task-c',
      owner_id: 'attacker',
      id: 'evil-id',
      workflow_id: 'evil-wf',
    })

    expect(res.status).toBe(200)
    expect(ops.length).toBeGreaterThan(0)
    for (const op of ops) {
      const keys = Object.keys(op.payload ?? {})
      expect(keys).not.toContain('owner_id')
      expect(keys).not.toContain('workflow_id')
      expect(keys).not.toContain('id')
      expect(JSON.stringify(op)).not.toMatch(/attacker|evil/)
    }
  })

  it('TC-18 401s without a session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })
    expect((await patchStep({ step_type: 'TASK', task_id: 't' })).status).toBe(401)
  })
})

describe('US-012 remove step (DELETE /:id/steps/:stepId)', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  function setup(existing: unknown[], status = 'Draft', rpcResult?: Res) {
    const { client, ops, calls, rpcCalls } = recordingClient(
      OWNER_ID,
      { workflows: [{ data: wfRow({ status }), error: null }], workflow_steps: [{ data: existing, error: null }] },
      rpcResult,
    )
    createRequestSupabaseClient.mockReturnValue(client)
    return { ops, calls, rpcCalls }
  }

  const three = () => [step('s0', 0), step('s1', 1), step('s2', 2)]

  it('AC2 deleting a step makes one RPC call and no direct writes (delete, renumber, bump and snapshot are atomic in Postgres)', async () => {
    const { ops, rpcCalls } = setup(three())
    const res = await deleteStep('s1')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(RPC_OK)
    expect(rpcCalls).toEqual([{ fn: 'delete_workflow_step', args: { p_workflow_id: 'wf-1', p_step_id: 's1' } }])
    expect(ops).toEqual([])
  })

  it('AC4 deleting the only step of a Draft workflow is allowed', async () => {
    const { rpcCalls } = setup([step('s0', 0)])
    const res = await deleteStep('s0')

    expect(res.status).toBe(200)
    expect(rpcCalls).toHaveLength(1)
  })

  it('AC4 deleting the only step of a Published workflow 400s workflow_has_no_steps without calling the RPC', async () => {
    const { ops, rpcCalls } = setup([step('s0', 0)], 'Published')
    const res = await deleteStep('s0')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('workflow_has_no_steps')
    expect(rpcCalls).toEqual([])
    expect(ops).toEqual([])
  })

  it('AC4 deleting one of two steps of a Published workflow is still allowed', async () => {
    const { rpcCalls } = setup([step('s0', 0), step('s1', 1)], 'Published')
    const res = await deleteStep('s0')

    expect(res.status).toBe(200)
    expect(rpcCalls).toHaveLength(1)
  })

  it('maps a known RPC failure (a concurrent request won the row lock) to its status instead of a 500', async () => {
    setup(three(), 'Draft', { data: null, error: { message: 'step_not_found' } })
    const res = await deleteStep('s1')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('step_not_found')
  })

  it('an unrecognised RPC failure surfaces as a 500', async () => {
    setup(three(), 'Draft', { data: null, error: new Error('deadlock detected') })
    const res = await deleteStep('s1')

    expect(res.status).toBe(500)
  })

  it('TC-08 deleting an already-removed step 404s step_not_found with no write or snapshot', async () => {
    const { ops, calls, rpcCalls } = setup([step('s0', 0)])
    const res = await deleteStep('s-gone')
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(404)
    expect(body.error).toBe('step_not_found')
    // The existence check lists the steps of the path workflow only.
    expect(calls.find((c) => c.table === 'workflow_steps')!.filters).toEqual([['workflow_id', 'wf-1']])
    expect(ops).toEqual([])
    expect(rpcCalls).toEqual([])
  })

  it('TC-17 403s a non-owner and deletes nothing', async () => {
    const { client, ops, calls } = recordingClient(OTHER_USER_ID, { workflows: [{ data: wfRow(), error: null }] })
    createRequestSupabaseClient.mockReturnValue(client)
    const res = await deleteStep('s0')

    expect(res.status).toBe(403)
    expect(ops).toEqual([])
    expect(calls.map((c) => c.table)).toEqual(['workflows'])
  })

  it('TC-18 401s without a session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })
    expect((await deleteStep('s0')).status).toBe(401)
  })
})
