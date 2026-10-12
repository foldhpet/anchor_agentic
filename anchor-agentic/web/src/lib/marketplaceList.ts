// US-055: pure helpers for the Marketplace list state (q, type, role, page), used by the pager
// links, the "Back to Marketplace" link on item pages and the empty/count messages.
export interface ListState {
	q: string;
	type: string;
	role: string;
	page: number;
}

const TYPE_LABELS: Record<string, string> = {
	AGENT: 'Agent',
	SKILL: 'Skill',
	WORKFLOW: 'Workflow'
};
const MAX_TEXT = 200;

export function typeLabel(type: string): string {
	return TYPE_LABELS[type] ?? type;
}

/** Query string (without `?`) for a list state. Empty values and `page=1` are omitted. */
export function listQuery(state: Partial<ListState>): string {
	const params = new URLSearchParams();
	if (state.q) params.set('q', state.q);
	if (state.type) params.set('type', state.type);
	if (state.role) params.set('role', state.role);
	if (state.page && state.page > 1) params.set('page', String(state.page));
	return params.toString();
}

/** Same-site path for a list state; always starts with `/`. */
export function marketplaceListHref(state: Partial<ListState> = {}): string {
	const qs = listQuery(state);
	return qs ? `/?${qs}` : '/';
}

/** Reads ONLY the four known keys, so no other parameter can ever be echoed into a link. */
export function listStateFromParams(params: URLSearchParams): ListState {
	const type = params.get('type') ?? '';
	const page = Number.parseInt(params.get('page') ?? '1', 10);
	return {
		q: (params.get('q') ?? '').slice(0, MAX_TEXT),
		type: type in TYPE_LABELS ? type : '',
		role: (params.get('role') ?? '').slice(0, MAX_TEXT),
		page: Number.isFinite(page) && page > 1 ? page : 1
	};
}

/** Human-readable active filters, e.g. `search "triage", type Agent`; empty string when none. */
export function describeFilters(state: Pick<ListState, 'q' | 'type' | 'role'>): string {
	const parts: string[] = [];
	if (state.q) parts.push(`search "${state.q}"`);
	if (state.type) parts.push(`type ${typeLabel(state.type)}`);
	if (state.role) parts.push(`role "${state.role}"`);
	return parts.join(', ');
}

/** Number of pages for a result set; an empty result still has one (empty) page. */
export function pageCount(total: number, pageSize: number): number {
	return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * True when the list is asking for a page that does not exist although results do: an in-range
 * page always has rows, so "no rows but a positive total" means the page is past the last one.
 */
export function isPastLastPage(rowCount: number, total: number): boolean {
	return rowCount === 0 && total > 0;
}

/** "1 item" / "12 items". */
export function itemCount(total: number): string {
	return `${total} ${total === 1 ? 'item' : 'items'}`;
}
