import { describe, expect, it } from 'vitest';
import {
	describeFilters,
	itemCount,
	listQuery,
	isPastLastPage,
	listStateFromParams,
	marketplaceListHref,
	normaliseSort,
	pageCount,
	sortLabel
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
		expect(parsed).toEqual({ q, type: '', role: 'R&D #', sort: 'cloned', page: 2 });
	});
});

describe('listStateFromParams', () => {
	it('reads only the five known keys', () => {
		const params = new URLSearchParams('q=a&next=https://evil.example&from=//evil&page=2');
		expect(marketplaceListHref(listStateFromParams(params))).toBe('/?q=a&page=2');
	});
	it('rejects unknown types and bad pages', () => {
		expect(listStateFromParams(new URLSearchParams('type=EVIL&page=-4'))).toEqual({
			q: '',
			type: '',
			role: '',
			sort: 'cloned',
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

describe('normaliseSort', () => {
	it('keeps the three known values', () => {
		expect(normaliseSort('cloned')).toBe('cloned');
		expect(normaliseSort('rating')).toBe('rating');
		expect(normaliseSort('newest')).toBe('newest');
	});
	it.each([undefined, null, '', 'SORT', 'Rating', 'popular', 'rating desc', 'constructor'])(
		'normalises %j to the default',
		(raw) => {
			expect(normaliseSort(raw)).toBe('cloned');
		}
	);
	it('labels sorts, falling back to the default label', () => {
		expect(sortLabel('rating')).toBe('Highest rated');
		expect(sortLabel('newest')).toBe('Newest');
		expect(sortLabel('bogus')).toBe('Most cloned');
	});
});

describe('sort in list links (US-058)', () => {
	it('omits the default sort and includes a non-default one', () => {
		expect(listQuery({ sort: 'cloned' })).toBe('');
		expect(marketplaceListHref({ sort: 'cloned' })).toBe('/');
		expect(marketplaceListHref({ sort: 'rating' })).toBe('/?sort=rating');
		expect(marketplaceListHref({ sort: 'newest', q: 'x' })).toBe('/?q=x&sort=newest');
	});
	it('normalises an invalid sort to the default (omitted)', () => {
		expect(listQuery({ sort: 'bogus' as never })).toBe('');
	});
	it('keeps sort across pagination and filter links', () => {
		const state = { q: 'triage', type: 'AGENT', role: 'QA', sort: 'rating' as const };
		expect(marketplaceListHref({ ...state, page: 3 })).toBe(
			'/?q=triage&type=AGENT&role=QA&sort=rating&page=3'
		);
		expect(marketplaceListHref({ ...state, type: 'SKILL' })).toBe(
			'/?q=triage&type=SKILL&role=QA&sort=rating'
		);
		expect(marketplaceListHref({ sort: 'rating' })).toBe('/?sort=rating');
	});
	it('resets page when sort or a filter changes (state rebuilt without page)', () => {
		const current = listStateFromParams(new URLSearchParams('q=triage&type=AGENT&page=3'));
		expect(current.page).toBe(3);
		expect(marketplaceListHref({ ...current, page: 1, sort: 'rating' })).toBe(
			'/?q=triage&type=AGENT&sort=rating'
		);
	});
	it('reads sort from params and drops invalid values', () => {
		expect(listStateFromParams(new URLSearchParams('sort=rating')).sort).toBe('rating');
		expect(listStateFromParams(new URLSearchParams('sort=Rating')).sort).toBe('cloned');
		expect(listStateFromParams(new URLSearchParams('sort=a&sort=newest')).sort).toBe('cloned');
	});
	it('accepts a sorted URL as a next target round-trip', () => {
		const href = marketplaceListHref({ sort: 'rating', q: 'x', page: 2 });
		expect(href).toBe('/?q=x&sort=rating&page=2');
	});
});
