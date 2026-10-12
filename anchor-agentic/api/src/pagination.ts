// PostgREST answers HTTP 416 with code PGRST103 ("Requested range not satisfiable") when a page's
// offset is past the last row. A page past the end is an empty page, not a server error.
type RangeError = { code?: string } | null

interface RangeQuery<Row> {
  range(from: number, to: number): PromiseLike<{ data: Row[] | null; error: RangeError; count: number | null }>
}

export function isRangeNotSatisfiable(error: RangeError | undefined): boolean {
  return error?.code === 'PGRST103'
}

/**
 * Runs a counted query for one page. Past the end it returns no rows plus the real total (taken
 * from a one-row request), so clients can still show "page X of N" and a way back. Any other
 * error is rethrown for the error handler.
 */
export async function fetchPage<Row>(
  query: RangeQuery<Row>,
  page: number,
  pageSize: number,
): Promise<{ rows: Row[]; total: number }> {
  const from = (page - 1) * pageSize
  const result = await query.range(from, from + pageSize - 1)
  if (!result.error) return { rows: result.data ?? [], total: result.count ?? 0 }
  if (!isRangeNotSatisfiable(result.error)) throw result.error

  const head = await query.range(0, 0)
  if (head.error) throw head.error
  return { rows: [], total: head.count ?? 0 }
}
