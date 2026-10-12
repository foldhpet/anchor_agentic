import { describe, expect, it } from 'vitest';
import { searchWith } from './searchWith';

describe('searchWith', () => {
	it('sets a parameter on an empty query', () => {
		expect(searchWith(new URLSearchParams(), { vpage: 2 })).toBe('vpage=2');
	});
	it('keeps the other parameters and replaces the one it sets', () => {
		expect(searchWith(new URLSearchParams('from=all&vpage=2'), { vpage: 3 })).toBe(
			'from=all&vpage=3'
		);
	});
	it('does not mutate the params it was given', () => {
		const params = new URLSearchParams('from=mine');
		searchWith(params, { vpage: 2 });
		expect(params.toString()).toBe('from=mine');
	});
	it('encodes special characters', () => {
		expect(searchWith(new URLSearchParams(), { q: 'a&b #c' })).toBe('q=a%26b+%23c');
	});
});
