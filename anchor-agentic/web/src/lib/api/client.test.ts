import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, optionalApiRequest } from './client';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fetch that never answers on its own but rejects when its signal aborts, like a real hung request. */
const hungFetch = vi.fn(
	(_url: unknown, init?: RequestInit) =>
		new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
		})
) as unknown as typeof fetch;

describe('apiRequest', () => {
	it('returns the parsed body and sends the bearer token', async () => {
		const fetchFn = vi.fn(async () => json({ ok: 1 })) as unknown as typeof fetch;
		await expect(apiRequest('/x', { accessToken: 'tok', fetchFn })).resolves.toEqual({ ok: 1 });

		const [, init] = vi.mocked(fetchFn).mock.calls[0];
		expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok');
	});

	it('turns a request that never answers into a 504 request_timeout instead of hanging', async () => {
		const error = await apiRequest('/slow', { fetchFn: hungFetch, timeoutMs: 20 }).catch((e) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 504, message: 'request_timeout' });
	});

	it('still reports API errors with their status and code', async () => {
		const fetchFn = (async () => json({ error: 'forbidden' }, 403)) as unknown as typeof fetch;
		await expect(apiRequest('/x', { fetchFn })).rejects.toMatchObject({
			status: 403,
			message: 'forbidden'
		});
	});

	it('uses request_failed when an error response has no usable body', async () => {
		const fetchFn = (async () =>
			new Response('<html>oops</html>', { status: 500 })) as unknown as typeof fetch;
		await expect(apiRequest('/x', { fetchFn })).rejects.toMatchObject({
			status: 500,
			message: 'request_failed'
		});
	});

	it('lets the caller abort without it being reported as a timeout', async () => {
		const controller = new AbortController();
		const pending = apiRequest('/x', {
			fetchFn: hungFetch,
			signal: controller.signal,
			timeoutMs: 5000
		});
		controller.abort(new Error('caller gave up'));

		const error = await pending.catch((e) => e);
		expect(error).not.toBeInstanceOf(ApiError);
	});
});

describe('optionalApiRequest', () => {
	const fallback = { items: [] as string[] };

	it('returns the data when the call works', async () => {
		const fetchFn = (async () => json({ items: ['a'] })) as unknown as typeof fetch;
		await expect(optionalApiRequest('/x', { fetchFn }, fallback)).resolves.toEqual({
			data: { items: ['a'] },
			failed: false
		});
	});

	it.each([
		['a 500', (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch],
		['a 503', (async () => json({ error: 'down' }, 503)) as unknown as typeof fetch],
		[
			'a network failure',
			(async () => {
				throw new TypeError('fetch failed');
			}) as unknown as typeof fetch
		]
	])('falls back on %s so the page can still render', async (_name, fetchFn) => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(optionalApiRequest('/x', { fetchFn }, fallback)).resolves.toEqual({
			data: fallback,
			failed: true
		});
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('falls back when the call hangs, after the short optional timeout', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = await optionalApiRequest('/x', { fetchFn: hungFetch, timeoutMs: 20 }, fallback);

		expect(result).toEqual({ data: fallback, failed: true });
		warn.mockRestore();
	});

	it.each([401, 403, 404])(
		'rethrows a %s: auth and not-found are real outcomes, not outages',
		async (status) => {
			const fetchFn = (async () => json({ error: 'nope' }, status)) as unknown as typeof fetch;
			await expect(optionalApiRequest('/x', { fetchFn }, fallback)).rejects.toMatchObject({
				status
			});
		}
	);
});
