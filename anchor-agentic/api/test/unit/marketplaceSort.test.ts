import { describe, expect, it } from 'vitest'
import { marketplaceSortOrder, parseMarketplaceSort } from '../../src/marketplaceSort'

describe('parseMarketplaceSort', () => {
  it('accepts exactly the allow-listed values', () => {
    expect(parseMarketplaceSort('cloned')).toBe('cloned')
    expect(parseMarketplaceSort('rating')).toBe('rating')
    expect(parseMarketplaceSort('newest')).toBe('newest')
  })

  it.each([
    undefined,
    null,
    '',
    'SORT',
    'Rating',
    'NEWEST',
    'popular',
    'rating desc',
    'rating;drop table x',
    'rating,created_at',
    'constructor',
    '__proto__',
    'toString',
  ])('falls back to cloned for %j', (raw) => {
    expect(parseMarketplaceSort(raw as string | undefined)).toBe('cloned')
  })
})

describe('marketplaceSortOrder', () => {
  const describeOrder = (sort: Parameters<typeof marketplaceSortOrder>[0]) =>
    marketplaceSortOrder(sort).map((o) => `${o.column} ${o.ascending ? 'asc' : 'desc'}`)

  it('cloned: clone_count desc, created_at desc, id asc', () => {
    expect(describeOrder('cloned')).toEqual(['clone_count desc', 'created_at desc', 'id asc'])
  })

  it('rating: rated first (nulls last), then count, clones, recency, id', () => {
    expect(describeOrder('rating')).toEqual([
      'rating desc',
      'rating_count desc',
      'clone_count desc',
      'created_at desc',
      'id asc',
    ])
    expect(marketplaceSortOrder('rating')[0].nullsFirst).toBe(false)
  })

  it('newest: created_at desc, id asc', () => {
    expect(describeOrder('newest')).toEqual(['created_at desc', 'id asc'])
  })

  it('every ordering ends on id so paging is total', () => {
    for (const sort of ['cloned', 'rating', 'newest'] as const) {
      const order = marketplaceSortOrder(sort)
      expect(order[order.length - 1]).toEqual({ column: 'id', ascending: true })
    }
  })
})
