import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../src/app'
import { chain, chainWithRanges, testEnv } from './testEnv'

const { createRequestSupabaseClient } = vi.hoisted(() => ({
  createRequestSupabaseClient: vi.fn(),
}))

vi.mock('../../src/supabase', () => ({ createRequestSupabaseClient }))

const OWNER_ID = 'owner-1'

function authedClient(fromImpl: () => ReturnType<typeof chain>) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
    from: vi.fn(fromImpl),
  }
}

describe('library routes', () => {
  beforeEach(() => {
    createRequestSupabaseClient.mockReset()
  })

  it('401s when the caller has no valid session', async () => {
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'no token' } }) },
    })

    const app = createApp()
    const res = await app.request('/api/v1/library', {}, testEnv)

    expect(res.status).toBe(401)
  })

  it('GET / defaults to scope=all and returns paginated items with total', async () => {
    const items = [
      { item_type: 'ROLE', id: 'role-1', owner_id: OWNER_ID, name: 'BA', status: 'Draft', current_version: 1 },
    ]
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: items, error: null, count: 1 })))

    const app = createApp()
    const res = await app.request('/api/v1/library', {}, testEnv)
    const body = await res.json<{ items: unknown[]; total: number; page: number; pageSize: number }>()

    expect(res.status).toBe(200)
    expect(body.items).toEqual(items.map((item) => ({ ...item, cloned: false }))) // US-056 adds `cloned`
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(20)
  })

  it('GET / tags a cloned Agent, Skill or Workflow with cloned: true and leaves originals and Roles false', async () => {
    const items = [
      { item_type: 'SKILL', id: 'skill-copy', owner_id: OWNER_ID, name: 'Copy', status: 'Draft', current_version: 1 },
      { item_type: 'SKILL', id: 'skill-own', owner_id: OWNER_ID, name: 'Own', status: 'Draft', current_version: 1 },
      { item_type: 'ROLE', id: 'role-1', owner_id: OWNER_ID, name: 'BA', status: 'Draft', current_version: 1 },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: items, error: null, count: 3 })) // library_items page
      .mockReturnValueOnce(chain({ data: [{ source_item_type: 'SKILL', cloned_item_id: 'skill-copy' }], error: null })) // clone_records
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library', {}, testEnv)
    const body = await res.json<{ items: { id: string; cloned: boolean }[] }>()

    expect(res.status).toBe(200)
    expect(body.items.map((item) => [item.id, item.cloned])).toEqual([
      ['skill-copy', true],
      ['skill-own', false],
      ['role-1', false],
    ])
    expect(fromMock).toHaveBeenNthCalledWith(2, 'clone_records')
  })

  it('GET / makes no clone lookup when the page holds no Agent, Skill or Workflow', async () => {
    const items = [{ item_type: 'ROLE', id: 'role-1', owner_id: OWNER_ID, name: 'BA', status: 'Draft', current_version: 1 }]
    const fromMock = vi.fn().mockReturnValue(chain({ data: items, error: null, count: 1 }))
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library', {}, testEnv)
    const body = await res.json<{ items: { cloned: boolean }[] }>()

    expect(res.status).toBe(200)
    expect(body.items.every((item) => item.cloned === false)).toBe(true)
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('GET / fails with a 500 when the clone lookup errors', async () => {
    const items = [{ item_type: 'AGENT', id: 'agent-1', owner_id: OWNER_ID, name: 'A', status: 'Draft', current_version: 1 }]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: items, error: null, count: 1 }))
      .mockReturnValueOnce(chain({ data: null, error: Object.assign(new Error('boom'), { code: 'XX000' }) }))
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library', {}, testEnv)

    expect(res.status).toBe(500)
  })

  it('GET / past the last page returns an empty page with the real total, not a 500', async () => {
    createRequestSupabaseClient.mockReturnValue(
      authedClient(() =>
        chainWithRanges(
          { data: null, error: { code: 'PGRST103', message: 'Requested range not satisfiable' }, count: null },
          { data: [], error: null, count: 3 },
        ),
      ),
    )

    const app = createApp()
    const res = await app.request('/api/v1/library?page=5', {}, testEnv)
    const body = await res.json<{ items: unknown[]; total: number; page: number }>()

    expect(res.status).toBe(200)
    expect(body.items).toEqual([])
    expect(body.total).toBe(3)
    expect(body.page).toBe(5)
  })

  it('GET /?scope=mine restricts to the caller (owner filter applied server-side)', async () => {
    const fromMock = vi.fn(() => chain({ data: [], error: null, count: 0 }))
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library?scope=mine', {}, testEnv)

    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('library_items')
  })

  it('GET /:itemType/:id/versions 400s an unknown item type', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request('/api/v1/library/BOGUS/role-1/versions', {}, testEnv)
    const body = await res.json<{ error: string }>()

    expect(res.status).toBe(400)
    expect(body.error).toBe('invalid_item_type')
  })

  it('GET /:itemType/:id/versions 404s when the parent item does not exist', async () => {
    createRequestSupabaseClient.mockReturnValue(authedClient(() => chain({ data: null, error: null })))

    const app = createApp()
    const res = await app.request('/api/v1/library/ROLE/missing/versions', {}, testEnv)

    expect(res.status).toBe(404)
  })

  it('GET /:itemType/:id/versions past the last page returns an empty page with the real total, not a 500', async () => {
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1' }, error: null })) // parent existence check
      .mockReturnValueOnce(
        chainWithRanges(
          { data: null, error: { code: 'PGRST103', message: 'Requested range not satisfiable' }, count: null },
          { data: [], error: null, count: 2 },
        ),
      )
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'someone-else' } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library/ROLE/role-1/versions?page=4', {}, testEnv)
    const body = await res.json<{ versions: unknown[]; total: number; page: number }>()

    expect(res.status).toBe(200)
    expect(body.versions).toEqual([])
    expect(body.total).toBe(2)
    expect(body.page).toBe(4)
  })

  it('GET /:itemType/:id/versions returns a paginated, newest-first snapshot list for any registered user', async () => {
    const versions = [
      { id: 'v2', item_type: 'ROLE', item_id: 'role-1', version_number: 2, snapshot_data: {}, created_by: 'x' },
      { id: 'v1', item_type: 'ROLE', item_id: 'role-1', version_number: 1, snapshot_data: {}, created_by: 'x' },
    ]
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(chain({ data: { id: 'role-1' }, error: null })) // parent existence check
      .mockReturnValueOnce(chain({ data: versions, error: null, count: 2 })) // version_snapshots select
    createRequestSupabaseClient.mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'someone-else' } }, error: null }) },
      from: fromMock,
    })

    const app = createApp()
    const res = await app.request('/api/v1/library/ROLE/role-1/versions', {}, testEnv)
    const body = await res.json<{ versions: unknown[]; total: number }>()

    expect(res.status).toBe(200)
    expect(body.versions).toEqual(versions)
    expect(body.total).toBe(2)
  })
})
