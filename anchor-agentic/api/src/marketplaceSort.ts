// US-058: the Marketplace list sort allow-list. The request's `sort` value is only ever used as a
// key into SORTS, so no user input reaches the query text; every ordering ends on `id` so paging is
// stable (each item appears exactly once across pages).
export type MarketplaceSort = 'cloned' | 'rating' | 'newest'

export type SortOrder = { column: string; ascending: boolean; nullsFirst?: boolean }

export const DEFAULT_MARKETPLACE_SORT: MarketplaceSort = 'cloned'

// For 'rating': marketplace_items.rating is round(avg(score), 1), and avg() over zero rows is NULL
// (migration 0018), while rating_count is 0. So an unrated item has rating = NULL, and ordering
// `rating desc nulls last` puts every unrated item after every rated one regardless of its clone
// count or age. Unrated items then tie on rating and rating_count (0), which leaves the clone_count
// desc, created_at desc, id asc order the story requires for them.
const SORTS: Record<MarketplaceSort, readonly SortOrder[]> = {
  cloned: [
    { column: 'clone_count', ascending: false },
    { column: 'created_at', ascending: false },
    { column: 'id', ascending: true },
  ],
  rating: [
    { column: 'rating', ascending: false, nullsFirst: false },
    { column: 'rating_count', ascending: false },
    { column: 'clone_count', ascending: false },
    { column: 'created_at', ascending: false },
    { column: 'id', ascending: true },
  ],
  newest: [
    { column: 'created_at', ascending: false },
    { column: 'id', ascending: true },
  ],
}

// Missing, empty, wrong-case or unknown values fall back to the default; never throws.
export function parseMarketplaceSort(raw: string | undefined | null): MarketplaceSort {
  if (typeof raw === 'string' && Object.hasOwn(SORTS, raw)) return raw as MarketplaceSort
  return DEFAULT_MARKETPLACE_SORT
}

export function marketplaceSortOrder(sort: MarketplaceSort): readonly SortOrder[] {
  return SORTS[sort]
}
