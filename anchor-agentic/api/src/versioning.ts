import type { SupabaseClient } from '@supabase/supabase-js'

export type VersionedItemType = 'ROLE' | 'TASK' | 'AGENT' | 'SKILL' | 'WORKFLOW'

// Single choke point for every write to version_snapshots (Architecture
// Decision 2/3). It only inserts the snapshot: every caller has already written
// the new current_version to the parent row in its own create/update (or
// insert default of 1), so a second write here would just repeat it. Called by
// every create/update handler across the roles/tasks/agents/skills/workflows routers.
export async function recordVersionSnapshot(
  supabase: SupabaseClient,
  itemType: VersionedItemType,
  itemId: string,
  versionNumber: number,
  snapshotData: unknown,
  userId: string,
) {
  const { error: snapshotError } = await supabase.from('version_snapshots').insert({
    item_type: itemType,
    item_id: itemId,
    version_number: versionNumber,
    snapshot_data: snapshotData,
    created_by: userId,
  })
  if (snapshotError) throw snapshotError
}
