import { describe, expect, it } from 'vitest';
import {
	describeFilters,
	itemCount,
	listQuery,
	isPastLastPage,
	listStateFromParams,
	marketplaceListHref,
	pageCount
} from './marketplaceList';

describe('marketplaceListHref', () => {
	it('is "/" with no state and omits page=1', () => {
		expect(marketplaceListHref()).toBe('/');
		expect(marketplaceListHref({ page: 1 })).toBe('/');
	});
	it('preserves type and role and sets page above 1', () => {
		expect(marketplaceListHref({ q: 'x', type: 'AGENT', role: 'Tester', page: 3 })).toBe(
			'/?q=x&type=AGENT&role=Tester&page=3'
		);
	});
	it('round-trips & # + % space and non-ASCII', () => {
		const q = 'a&b #1 +2 100% café ñ 日本';
		const href = marketplaceListHref({ q, role: 'R&D #', page: 2 });
		expect(href.startsWith('/?')).toBe(true);
		const parsed = listStateFromParams(new URL(href, 'http://x').searchParams);
		expect(parsed).toEqual({ q, type: '', role: 'R&D #', page: 2 });
	});
});

describe('listStateFromParams', () => {
	it('reads only the four known keys', () => {
		const params = new URLSearchParams('q=a&next=https://evil.example&from=//evil&page=2');
		expect(marketplaceListHref(listStateFromParams(params))).toBe('/?q=a&page=2');
	});
	it('rejects unknown types and bad pages', () => {
		expect(listStateFromParams(new URLSearchParams('type=EVIL&page=-4'))).toEqual({
			q: '',
			type: '',
			role: '',
			page: 1
		});
		expect(listStateFromParams(new URLSearchParams('page=abc')).page).toBe(1);
	});
});

describe('describeFilters / itemCount / listQuery', () => {
	it('describes active filters', () => {
		expect(describeFilters({ q: '', type: '', role: '' })).toBe('');
		expect(describeFilters({ q: 'tri', type: 'WORKFLOW', role: 'QA' })).toBe(
			'search "tri", type Workflow, role "QA"'
		);
	});
	it('pluralises counts', () => {
		expect(itemCount(1)).toBe('1 item');
		expect(itemCount(12)).toBe('12 items');
	});
	it('listQuery omits empties', () => {
		expect(listQuery({ q: '', page: 1 })).toBe('');
	});
	it('counts pages, with at least one even when empty', () => {
		expect(pageCount(0, 20)).toBe(1);
		expect(pageCount(20, 20)).toBe(1);
		expect(pageCount(21, 20)).toBe(2);
		expect(pageCount(95, 20)).toBe(5);
	});
	it('detects a page past the last one only when results exist', () => {
		expect(isPastLastPage(0, 95)).toBe(true);
		expect(isPastLastPage(0, 0)).toBe(false);
		expect(isPastLastPage(5, 95)).toBe(false);
	});
});
