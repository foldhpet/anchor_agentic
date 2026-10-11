/**
 * `aria-current` value for a global-nav link, so the page the user is on is marked for assistive
 * technology (docs/STYLE-GUIDE.md section 6). The Marketplace link stays current on its item pages.
 * Exact match otherwise: /library must not light up on /library/all.
 */
export function navCurrent(pathname: string, href: string): 'page' | undefined {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	const current = href === '/' ? path === '/' || path.startsWith('/marketplace/') : path === href;
	return current ? 'page' : undefined;
}
