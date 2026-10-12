/**
 * Query string (without `?`) for `params` with `updates` applied, so a pager link keeps the other
 * parameters of the current page (for example `from` on an item page).
 */
export function searchWith(
	params: URLSearchParams,
	updates: Record<string, string | number>
): string {
	const next = new URLSearchParams(params);
	for (const [key, value] of Object.entries(updates)) next.set(key, String(value));
	return next.toString();
}
