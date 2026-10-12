// US-056: which library items are clones. Only Agents, Skills and Workflows have a clone entry point
// and a clone record (US-021, US-022); Roles and Tasks never do.
const CLONEABLE_TYPES = ['AGENT', 'SKILL', 'WORKFLOW']

type ItemRef = { item_type: string; id: string }
type CloneRecordRef = { source_item_type: string; cloned_item_id: string }

const key = (type: string, id: string) => `${type}:${id}`

/** Ids on this page worth looking up in clone_records (empty means no lookup is needed). */
export function cloneCandidateIds(items: ItemRef[]): string[] {
  return items.filter((item) => CLONEABLE_TYPES.includes(item.item_type)).map((item) => item.id)
}

/**
 * Adds `cloned` to each item: true only when a clone record names that item (of that type) as the
 * cloned item. A clone has the same type as its source, so the record's source type is the clone's type.
 */
export function flagCloned<T extends ItemRef>(items: T[], records: CloneRecordRef[]): (T & { cloned: boolean })[] {
  const cloned = new Set(records.map((record) => key(record.source_item_type, record.cloned_item_id)))
  return items.map((item) => ({ ...item, cloned: cloned.has(key(item.item_type, item.id)) }))
}
