// US-055 Part A (WCAG 2.4.2): every page's <title> is "<page h1> - AnchorAgentic".
export const SITE_NAME = 'AnchorAgentic';

/** `<heading> - AnchorAgentic`; falls back to the bare site name when the heading is empty. */
export function pageTitle(heading: string | null | undefined): string {
	const text = (heading ?? '').replace(/\s+/g, ' ').trim();
	return text ? `${text} - ${SITE_NAME}` : SITE_NAME;
}

/** Marketplace list title; includes the search term and the page number when above 1. */
export function marketplaceTitle(q: string, page: number): string {
	const parts: string[] = [];
	const term = q.replace(/\s+/g, ' ').trim();
	if (term) parts.push(`"${term}"`);
	if (page > 1) parts.push(`page ${page}`);
	return pageTitle(parts.length ? `Marketplace: ${parts.join(', ')}` : 'Marketplace');
}
