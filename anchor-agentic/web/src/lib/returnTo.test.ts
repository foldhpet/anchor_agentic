import { describe, expect, it } from 'vitest';
import { nextFromParams, nextQuery, safeNext, targetFromUrl } from './returnTo';

const long512 = '/' + 'a'.repeat(511);

describe('safeNext: accepted values are preserved', () => {
	const accepted = [
		'/',
		'/?q=triage&page=2',
		'/?q=a%20b%26c',
		'/marketplace/agent/0a1b2c',
		'/marketplace/agent/abc123',
		'/library',
		'/agents/abc?tab=2',
		'/?q=x&page=2&type=agent',
		long512
	];
	it.each(accepted)('accepts %s', (value) => {
		expect(safeNext(value)).toBe(value);
	});

	it('accepts a 512-character value and rejects 513', () => {
		expect(long512).toHaveLength(512);
		expect(safeNext(long512)).toBe(long512);
		expect(safeNext(long512 + 'a')).toBe('/');
	});

	it('drops the fragment', () => {
		expect(safeNext('/a?x=1#frag')).toBe('/a?x=1');
		expect(safeNext('/a#frag')).toBe('/a');
	});

	it('allows paths that merely start like an auth page', () => {
		expect(safeNext('/loginx')).toBe('/loginx');
		expect(safeNext('/registered')).toBe('/registered');
	});

	it('allows an encoded slash in the query part', () => {
		expect(safeNext('/?q=a%2Fb')).toBe('/?q=a%2Fb');
	});
});

describe('safeNext: rejected values fall back to /', () => {
	const rejected: Array<[string, unknown]> = [
		['https URL', 'https://evil.example'],
		['http URL with path', 'http://evil.example/path'],
		['protocol-relative', '//evil.example'],
		['triple slash', '///evil.example'],
		['slash backslash', '/\\evil.example'],
		['double backslash', '\\\\evil.example'],
		['backslash slash', '\\/evil.example'],
		['javascript scheme', 'javascript:alert(1)'],
		['data scheme', 'data:text/html,x'],
		['no leading slash', 'evil.example'],
		['empty', ''],
		['spaces only', '   '],
		['tab only', '\t'],
		['leading space', ' //evil.example'],
		['leading tab', '\t//evil.example'],
		['leading space before a valid path', ' /ok'],
		['encoded slash upper', '/%2Fevil.example'],
		['encoded slash lower', '/%2fevil.example'],
		['encoded backslash', '/%5Cevil.example'],
		['encoded backslash lower', '/%5cevil.example'],
		['double encoded', '/%252Fevil.example'],
		['encoded CRLF', '/%0d%0aSet-Cookie:x=1'],
		['encoded NUL', '/%00'],
		['encoded DEL', '/%7f'],
		['raw newline', '/ok\nhttps://evil.example'],
		['raw CR', '/ok\rx'],
		['raw NUL', '/ok\u0000'],
		['raw DEL', '/ok\u007f'],
		['backslash inside path', '/ok\\x'],
		['backslash inside query', '/ok?x=\\y'],
		['513 characters', long512 + 'a'],
		['form action URL', '/marketplace/agent/abc123?/clone'],
		['form action on root', '/?/rate'],
		['null', null],
		['undefined', undefined],
		['number', 5],
		['array', ['/a']],
		['object', {}]
	];
	it.each(rejected)('rejects %s', (_label, value) => {
		expect(safeNext(value)).toBe('/');
	});

	describe('encoded control characters in every form', () => {
		for (let code = 0; code <= 0x1f; code++) {
			const hex = code.toString(16).padStart(2, '0');
			it(`rejects %${hex} and %${hex.toUpperCase()}`, () => {
				expect(safeNext(`/a%${hex}b`)).toBe('/');
				expect(safeNext(`/a%${hex.toUpperCase()}b`)).toBe('/');
			});
		}
	});

	describe('raw control characters', () => {
		for (let code = 0; code <= 0x1f; code++) {
			it(`rejects U+${code.toString(16).padStart(4, '0')}`, () => {
				expect(safeNext(`/a${String.fromCharCode(code)}b`)).toBe('/');
			});
		}
	});

	describe('auth pages and every variant (no login/register loop)', () => {
		const bases = ['/login', '/register', '/logout'];
		const variants = (b: string) => [
			b,
			b.toUpperCase(),
			b[0] + b.slice(1, 3).toUpperCase() + b.slice(3),
			`${b}/`,
			`${b}//`,
			`${b}/sub`,
			`${b}/sub/`,
			`${b}?x=1`,
			`${b}/?x=1`,
			`${b}#frag`,
			`${b}?next=%2Fa`,
			// Percent-encoded letters decode to the same page.
			b.replace(/^\/./, (m) => '/%' + m.charCodeAt(1).toString(16))
		];
		for (const base of bases) {
			for (const v of variants(base)) {
				it(`rejects ${v}`, () => {
					expect(safeNext(v)).toBe('/');
				});
			}
		}
		it('rejects explicit examples from the story', () => {
			for (const v of ['/LOGIN', '/login/', '/register?x=1']) expect(safeNext(v)).toBe('/');
		});
	});

	it('is idempotent: a result is always safe to feed back in', () => {
		for (const v of ['/a?b=1', 'https://x', '/login', '//x', '/ok#f']) {
			expect(safeNext(safeNext(v))).toBe(safeNext(v));
		}
	});
});

describe('nextFromParams', () => {
	it('validates the first next value', () => {
		expect(nextFromParams(new URLSearchParams('next=%2Fa%3Fb%3D1'))).toBe('/a?b=1');
	});
	it('ignores later duplicates', () => {
		expect(nextFromParams(new URLSearchParams('next=/a&next=//evil.example'))).toBe('/a');
	});
	it('does not fall through to a valid later duplicate when the first is invalid', () => {
		expect(nextFromParams(new URLSearchParams('next=//evil.example&next=/a'))).toBe('/');
	});
	it('falls back to / when absent or empty', () => {
		expect(nextFromParams(new URLSearchParams(''))).toBe('/');
		expect(nextFromParams(new URLSearchParams('next='))).toBe('/');
	});
	it('rejects a form-action target', () => {
		expect(nextFromParams(new URLSearchParams('next=' + encodeURIComponent('/m/a/b?/clone')))).toBe(
			'/'
		);
	});
});

describe('targetFromUrl', () => {
	it('returns pathname plus search', () => {
		expect(targetFromUrl({ pathname: '/', search: '?q=triage&page=2' })).toBe('/?q=triage&page=2');
		expect(targetFromUrl({ pathname: '/marketplace/agent/abc', search: '' })).toBe(
			'/marketplace/agent/abc'
		);
	});
	it('works with a real URL', () => {
		expect(targetFromUrl(new URL('http://localhost:5173/agents/abc?tab=2#x'))).toBe(
			'/agents/abc?tab=2'
		);
	});
	it('returns null for the auth pages', () => {
		for (const p of ['/login', '/register', '/logout', '/login/', '/LOGIN'])
			expect(targetFromUrl({ pathname: p, search: '?next=%2Fa' })).toBeNull();
	});
	it('returns null for anything the validator rejects', () => {
		expect(targetFromUrl({ pathname: '/a%2Fb', search: '' })).toBeNull();
		expect(targetFromUrl({ pathname: '/a', search: '?/clone' })).toBeNull();
		expect(targetFromUrl({ pathname: '/' + 'a'.repeat(600), search: '' })).toBeNull();
	});
});

describe('nextQuery', () => {
	it('encodes so & and # round-trip intact', () => {
		const target = '/?q=a%26b&page=2';
		const query = nextQuery(target);
		expect(query).toBe('next=' + encodeURIComponent(target));
		expect(new URLSearchParams(query).get('next')).toBe(target);
	});
	it('encodes a literal # and & inside the query', () => {
		const query = nextQuery('/?q=a&b=c');
		expect(query).toBe('next=%2F%3Fq%3Da%26b%3Dc');
		expect(query).not.toContain('&');
		expect(query).not.toContain('#');
	});
	it('is empty for null, the default / and rejected values', () => {
		expect(nextQuery(null)).toBe('');
		expect(nextQuery('/')).toBe('');
		expect(nextQuery('//evil.example')).toBe('');
		expect(nextQuery('/login')).toBe('');
		expect(nextQuery('/a?/clone')).toBe('');
	});
	it('round-trips through nextFromParams', () => {
		const target = '/agents/abc?tab=2&x=%20y';
		expect(nextFromParams(new URLSearchParams(nextQuery(target)))).toBe(target);
	});
});
