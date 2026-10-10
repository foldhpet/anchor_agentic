import { describe, expect, it, vi } from 'vitest'
import { recordVersionSnapshot } from '../../src/versioning'

function fakeClient(insertError: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error: insertError })
  const from = vi.fn(() => ({ insert }))
  return { client: { from } as never, from, insert }
}

describe('recordVersionSnapshot', () => {
  it('inserts exactly one snapshot row and touches no other table (callers own the current_version write)', async () => {
    const { client, from, insert } = fakeClient()
    await recordVersionSnapshot(client, 'WORKFLOW', 'wf-1', 3, { a: 1 }, 'user-1')

    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('version_snapshots')
    expect(insert).toHaveBeenCalledWith({
      item_type: 'WORKFLOW',
      item_id: 'wf-1',
      version_number: 3,
      snapshot_data: { a: 1 },
      created_by: 'user-1',
    })
  })

  it('throws when the insert fails', async () => {
    const { client } = fakeClient(new Error('duplicate key'))
    await expect(recordVersionSnapshot(client, 'ROLE', 'r-1', 1, {}, 'user-1')).rejects.toThrow('duplicate key')
  })
})
