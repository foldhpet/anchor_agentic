/**
 * US-057: the "where I was" target carried in `?next=` through the Log in / Register links and the
 * route guard, and honoured after login or registration. Pure (no `$app` imports) so it is unit
 * tested. Everything that renders, links to or redirects to a `next` must go through `safeNext`.
 */

const MAX_LENGTH = 512;

/** Pages a visitor must never be sent back to: that would loop (or log them straight out). */
const AUTH_PAGES = ['/login', '/register', '/logout'];

// U+0000-U+001F and U+007F.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
// Encoded slash, backslash or control character (%00-%1f, %7f), any case, and %25 (double encoding).
const ENCODED_UNSAFE = /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f|25)/i;

function isAuthPage(path: string): boolean {
	let decoded: string;
	try {
		decoded = decodeURIComponent(path);
	} catch {
		return true;
	}
	const lower = decoded.toLowerCase();
	return AUTH_PAGES.some((p) => lower === p || lower.startsWith(p + '/'));
}

/** The validated same-site relative path plus query (fragment dropped), or null when rejected. */
function validate(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw === '' || raw.length > MAX_LENGTH) return null;
	if (raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return null;
	if (raw.includes('\\') || CONTROL_CHARS.test(raw)) return null;

	const hash = raw.indexOf('#');
	const withoutFragment = hash === -1 ? raw : raw.slice(0, hash);
	const q = withoutFragment.indexOf('?');
	const path = q === -1 ? withoutFragment : withoutFragment.slice(0, q);
	const query = q === -1 ? '' : withoutFragment.slice(q + 1);

	if (ENCODED_UNSAFE.test(path)) return null;
	// A query starting with '/' is a SvelteKit form-action URL (`?/clone`): a view is never an action.
	if (query.startsWith('/')) return null;
	if (isAuthPage(path)) return null;

	return query ? `${path}?${query}` : path;
}

/** The validated target, or '/' when `raw` is missing or fails any rule. */
export function safeNext(raw: unknown): string {
	return validate(raw) ?? '/';
}

/** The validated first `next` of a query string (later duplicates are ignored); '/' if none/invalid. */
export function nextFromParams(params: URLSearchParams): string {
	return safeNext(params.get('next'));
}

/**
 * The target for a visitor's current page, or null for the auth pages and anything the validator
 * rejects (so no `next` is carried).
 */
export function targetFromUrl(url: { pathname: string; search: string }): string | null {
	return validate(url.pathname + url.search);
}

/**
 * Query string (without `?`) carrying `target` as `next`, or '' when there is nothing worth
 * carrying (null, rejected, or the default '/'). Re-validates, so it can take raw input safely.
 */
export function nextQuery(target: unknown): string {
	const safe = validate(target);
	return safe && safe !== '/' ? `next=${encodeURIComponent(safe)}` : '';
}
