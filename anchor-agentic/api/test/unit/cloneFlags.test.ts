import { describe, expect, it } from 'vitest'
import { cloneCandidateIds, flagCloned } from '../../src/cloneFlags'

describe('cloneCandidateIds', () => {
  it('keeps only Agents, Skills and Workflows', () => {
    const items = [
      { item_type: 'ROLE', id: 'r' },
      { item_type: 'TASK', id: 't' },
      { item_type: 'AGENT', id: 'a' },
      { item_type: 'SKILL', id: 's' },
      { item_type: 'WORKFLOW', id: 'w' },
    ]
    expect(cloneCandidateIds(items)).toEqual(['a', 's', 'w'])
  })

  it('is empty for a page of Roles and Tasks', () => {
    expect(cloneCandidateIds([{ item_type: 'ROLE', id: 'r' }])).toEqual([])
    expect(cloneCandidateIds([])).toEqual([])
  })
})

describe('flagCloned', () => {
  const items = [
    { item_type: 'SKILL', id: 'copy', name: 'Copy' },
    { item_type: 'SKILL', id: 'original', name: 'Original' },
    { item_type: 'ROLE', id: 'role', name: 'Role' },
  ]

  it('flags only the item a clone record names as the cloned item', () => {
    const flagged = flagCloned(items, [{ source_item_type: 'SKILL', cloned_item_id: 'copy' }])
    expect(flagged.map((item) => [item.id, item.cloned])).toEqual([
      ['copy', true],
      ['original', false],
      ['role', false],
    ])
  })

  it('does not flag an item whose id matches a record of a different type', () => {
    const flagged = flagCloned([{ item_type: 'AGENT', id: 'x' }], [{ source_item_type: 'SKILL', cloned_item_id: 'x' }])
    expect(flagged[0].cloned).toBe(false)
  })

  it('keeps every other field and flags nothing without records', () => {
    expect(flagCloned(items, [])).toEqual(items.map((item) => ({ ...item, cloned: false })))
  })
})
