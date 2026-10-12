import { describe, expect, it, vi } from 'vitest'
import { fetchPage, isRangeNotSatisfiable } from '../../src/pagination'

const outOfRange = { code: 'PGRST103', message: 'Requested range not satisfiable' }

function queryReturning(...results: { data: unknown[] | null; error: { code?: string } | null; count: number | null }[]) {
  const range = vi.fn()
  for (const result of results) range.mockResolvedValueOnce(result)
  return { range }
}

describe('isRangeNotSatisfiable', () => {
  it('recognises only the PostgREST out-of-range code', () => {
    expect(isRangeNotSatisfiable(outOfRange)).toBe(true)
    expect(isRangeNotSatisfiable({ code: '42501' })).toBe(false)
    expect(isRangeNotSatisfiable({})).toBe(false)
    expect(isRangeNotSatisfiable(null)).toBe(false)
    expect(isRangeNotSatisfiable(undefined)).toBe(false)
  })
})

describe('fetchPage', () => {
  it('requests the page window and returns its rows and the count', async () => {
    const query = queryReturning({ data: [{ id: 'a' }], error: null, count: 41 })

    await expect(fetchPage(query, 3, 20)).resolves.toEqual({ rows: [{ id: 'a' }], total: 41 })
    expect(query.range).toHaveBeenCalledWith(40, 59)
  })

  it('treats a null data and count as an empty page', async () => {
    const query = queryReturning({ data: null, error: null, count: null })

    await expect(fetchPage(query, 1, 20)).resolves.toEqual({ rows: [], total: 0 })
  })

  it('returns no rows but the real total for a page past the end', async () => {
    const query = queryReturning({ data: null, error: outOfRange, count: null }, { data: [], error: null, count: 7 })

    await expect(fetchPage(query, 9, 20)).resolves.toEqual({ rows: [], total: 7 })
    expect(query.range).toHaveBeenNthCalledWith(1, 160, 179)
    expect(query.range).toHaveBeenNthCalledWith(2, 0, 0)
  })

  it('rethrows any other error without a second request', async () => {
    const error = { code: '42501', message: 'permission denied' }
    const query = queryReturning({ data: null, error, count: null })

    await expect(fetchPage(query, 2, 20)).rejects.toBe(error)
    expect(query.range).toHaveBeenCalledTimes(1)
  })

  it('rethrows an error from the follow-up count request', async () => {
    const error = { code: 'XX000', message: 'boom' }
    const query = queryReturning({ data: null, error: outOfRange, count: null }, { data: null, error, count: null })

    await expect(fetchPage(query, 9, 20)).rejects.toBe(error)
  })
})
