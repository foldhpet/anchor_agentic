import { describe, expect, it } from 'vitest';
import { navCurrent } from './navCurrent';

describe('navCurrent', () => {
	it('marks the Marketplace link on the home page and on marketplace item pages', () => {
		expect(navCurrent('/', '/')).toBe('page');
		expect(navCurrent('/marketplace/agents/42', '/')).toBe('page');
	});

	it('does not mark Marketplace on other pages', () => {
		expect(navCurrent('/library', '/')).toBeUndefined();
		expect(navCurrent('/settings', '/')).toBeUndefined();
	});

	it('keeps My Sandbox and All Sandbox mutually exclusive', () => {
		expect(navCurrent('/library', '/library')).toBe('page');
		expect(navCurrent('/library', '/library/all')).toBeUndefined();
		expect(navCurrent('/library/all', '/library/all')).toBe('page');
		expect(navCurrent('/library/all', '/library')).toBeUndefined();
	});

	it('ignores a trailing slash', () => {
		expect(navCurrent('/library/', '/library')).toBe('page');
		expect(navCurrent('/settings/', '/settings')).toBe('page');
	});

	it('marks nothing for a detail page that has no nav link', () => {
		for (const href of ['/', '/library', '/library/all', '/settings', '/login', '/register']) {
			expect(navCurrent('/agents/7', href)).toBeUndefined();
		}
	});
});
