import { redirect } from '@sveltejs/kit';
import { apiRequest } from '$lib/api/client';
import type { MarketplaceListItem } from '$lib/api/types';
import { normaliseSort } from '$lib/marketplaceList';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 20;

// Marketplace root listing — public, anonymous-readable (US-026 AC1).
// Mirrors library/all/+page.server.ts's param-building; adds the `role`
// filter (US-028 AC3) on top of `q`/`type`, and `sort` (US-058; default omitted).
export const load: PageServerLoad = async ({ url, fetch }) => {
	// The form submits every field, so choosing the default order arrives as `sort=cloned`.
	// The default is never written into URLs (US-058), so drop it with a redirect.
	if (url.searchParams.get('sort') === 'cloned') {
		const rest = new URLSearchParams(url.searchParams);
		rest.delete('sort');
		const qs = rest.toString();
		redirect(303, qs ? `/?${qs}` : '/');
	}
	const q = url.searchParams.get('q') ?? '';
	const type = url.searchParams.get('type') ?? '';
	const role = url.searchParams.get('role') ?? '';
	const sort = normaliseSort(url.searchParams.get('sort'));
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
	if (q) params.set('q', q);
	if (type) params.set('type', type);
	if (role) params.set('role', role);
	if (sort !== 'cloned') params.set('sort', sort);

	const { items, total } = await apiRequest<{ items: MarketplaceListItem[]; total: number }>(
		`/api/v1/marketplace/items?${params.toString()}`,
		{ fetchFn: fetch }
	);

	return { items, total, page, pageSize: PAGE_SIZE, q, type, role, sort };
};
