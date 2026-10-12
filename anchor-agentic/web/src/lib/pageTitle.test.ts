import { describe, expect, it } from 'vitest';
import { marketplaceTitle, pageTitle } from './pageTitle';

describe('pageTitle', () => {
	it('appends the site name', () => {
		expect(pageTitle('Log in')).toBe('Log in - AnchorAgentic');
	});
	it('normalises whitespace and handles empty headings', () => {
		expect(pageTitle('  Agent   for Test Analyst ')).toBe('Agent for Test Analyst - AnchorAgentic');
		expect(pageTitle('')).toBe('AnchorAgentic');
		expect(pageTitle(null)).toBe('AnchorAgentic');
	});
});

describe('marketplaceTitle', () => {
	it('plain', () => expect(marketplaceTitle('', 1)).toBe('Marketplace - AnchorAgentic'));
	it('search only', () =>
		expect(marketplaceTitle('triage', 1)).toBe('Marketplace: "triage" - AnchorAgentic'));
	it('page only', () =>
		expect(marketplaceTitle('', 2)).toBe('Marketplace: page 2 - AnchorAgentic'));
	it('search and page', () =>
		expect(marketplaceTitle('triage', 2)).toBe('Marketplace: "triage", page 2 - AnchorAgentic'));
	it('keeps special characters verbatim (the template escapes them)', () => {
		expect(marketplaceTitle('a&b #1 <x> "q" é+%', 3)).toBe(
			'Marketplace: "a&b #1 <x> "q" é+%", page 3 - AnchorAgentic'
		);
	});
	it('ignores a whitespace-only search', () =>
		expect(marketplaceTitle('   ', 1)).toBe('Marketplace - AnchorAgentic'));
});
