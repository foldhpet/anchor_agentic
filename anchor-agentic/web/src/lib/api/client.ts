import { PUBLIC_API_URL } from '$env/static/public';

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

/** Nothing the API does should take this long; a hung request must not hang the page with it. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Optional page data (version history, provenance) must never hold a page hostage. */
export const OPTIONAL_TIMEOUT_MS = 5_000;

type RequestOptions = RequestInit & {
	accessToken?: string | null;
	fetchFn?: typeof fetch;
	timeoutMs?: number;
};

// Thin wrapper around the API Worker: attaches the caller's Supabase access
// token as a Bearer header and normalizes 401s (expired/missing session) and
// other non-2xx responses into ApiError so callers can branch on `.status`.
// A request that does not answer within `timeoutMs` fails with ApiError 504 'request_timeout'.
export async function apiRequest<T>(
	path: string,
	{ accessToken, fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: RequestOptions = {}
): Promise<T> {
	const headers = new Headers(init.headers);
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
	if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

	const timeout = AbortSignal.timeout(timeoutMs);
	const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

	let res: Response;
	try {
		res = await fetchFn(`${PUBLIC_API_URL}${path}`, { ...init, headers, signal });
	} catch (err) {
		if (timeout.aborted && !init.signal?.aborted) throw new ApiError(504, 'request_timeout');
		throw err;
	}

	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		throw new ApiError(res.status, body.error ?? 'request_failed');
	}
	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}

export interface OptionalResult<T> {
	data: T;
	/** True when the data could not be loaded and `data` is the fallback. */
	failed: boolean;
}

/**
 * Loads data a page can live without. When the API is slow, down or erroring (timeout, network
 * failure, 5xx) it returns `fallback` with `failed: true` so the page still renders and the
 * caller can say what is missing. 4xx answers (not signed in, forbidden, not found) are real
 * outcomes and are rethrown.
 */
export async function optionalApiRequest<T>(
	path: string,
	options: RequestOptions,
	fallback: T
): Promise<OptionalResult<T>> {
	try {
		const data = await apiRequest<T>(path, { timeoutMs: OPTIONAL_TIMEOUT_MS, ...options });
		return { data, failed: false };
	} catch (err) {
		if (err instanceof ApiError && err.status < 500) throw err;
		console.warn(`[api] optional request failed, using fallback: ${path}: ${String(err)}`);
		return { data: fallback, failed: true };
	}
}
