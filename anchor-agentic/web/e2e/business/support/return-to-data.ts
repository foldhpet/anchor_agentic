// Test data for the "return to the page I was on" journeys (US-057).

/** The `/login` or `/register` URL that carries `target` as its (URL-encoded) return target. */
export function authHrefFor(route: '/login' | '/register', target: string): string {
	return `${route}?next=${encodeURIComponent(target)}`;
}

/** Values the story requires the validator to reject: the user lands on "/" and never leaves the site. */
export const REJECTED_TARGETS: readonly string[] = [
	'https://evil.example',
	'http://evil.example/path',
	'//evil.example',
	'///evil.example',
	'/\\evil.example',
	'\\\\evil.example',
	'\\/evil.example',
	'javascript:alert(1)',
	'data:text/html,x',
	'evil.example',
	' ',
	' //evil.example',
	'\t//evil.example',
	'/%2Fevil.example',
	'/%2fevil.example',
	'/%5Cevil.example',
	'/%252Fevil.example',
	'/%0d%0aSet-Cookie:x=1',
	'/%00',
	'/ok\nhttps://evil.example',
	`/${'a'.repeat(512)}`, // 513 characters
	'/login',
	'/LOGIN',
	'/login/',
	'/register?x=1',
	'/logout',
	'/marketplace/AGENT/abc?/clone'
];

/** Values that are valid: the user lands on exactly that path and query. */
export function acceptedTargets(itemPath: string): readonly string[] {
	return ['/', '/?q=triage&page=2', itemPath, '/library'];
}

/** `next` given twice: only the first value counts, so the second (hostile) one is ignored. */
export const DUPLICATE_NEXT = {
	query: `next=${encodeURIComponent('/library')}&next=${encodeURIComponent('//evil.example')}`,
	landsOn: '/library'
} as const;
