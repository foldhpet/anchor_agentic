import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';
import type { ItemType } from '../support/test-data';

export interface MarketplaceQuery {
	q?: string;
	type?: ItemType;
	role?: string;
	page?: number;
}

/** `/` — public Marketplace listing with search, type and role filters. */
export class MarketplacePage extends AnchorBasePage {
	get heading(): Locator {
		return this.page.getByRole('heading', { name: 'Marketplace' });
	}

	itemLink(name: string): Locator {
		return this.page.getByRole('link', { name, exact: true });
	}

	async open(query: MarketplaceQuery = {}) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(query)) if (value) params.set(key, String(value));
		const qs = params.toString();
		await this.goto(qs ? `/?${qs}` : '/');
	}

	async expectListed(name: string) {
		await expect(this.itemLink(name)).toBeVisible();
	}

	async expectNotListed(name: string) {
		await expect(this.itemLink(name)).toHaveCount(0);
	}

	/** Clicks through to the item's Marketplace detail page. */
	async openItem(name: string, itemType: ItemType, id: string) {
		await this.actions.clickAndWaitForUrl(
			this.itemLink(name),
			`/marketplace/${itemType}/${id}`,
			name
		);
	}

	async expectDonationLinkOpensExternally(href: string) {
		await expect(this.donationLink).toBeVisible();
		await expect(this.donationLink).toHaveAttribute('href', href);
		await expect(this.donationLink).toHaveAttribute('target', '_blank');
		await expect(this.donationLink).toHaveAttribute('rel', /noopener/);
	}

	// --- Search form (US-028 / US-055 Part C) ---
	get searchInput(): Locator {
		return this.page.locator('input[name="q"]');
	}
	get typeSelect(): Locator {
		return this.page.locator('select[name="type"]');
	}
	get roleInput(): Locator {
		return this.page.locator('input[name="role"]');
	}
	get searchButton(): Locator {
		return this.page.getByRole('button', { name: 'Search' });
	}

	/** Fills the form like a user and submits it (a plain GET navigation, so the URL carries the filters). */
	async search(query: { q?: string; type?: 'Agent' | 'Skill' | 'Workflow'; role?: string }) {
		if (query.q !== undefined) await this.actions.fill(this.searchInput, query.q, 'Search');
		if (query.type) await this.actions.select(this.typeSelect, { label: query.type }, 'Type');
		if (query.role !== undefined) await this.actions.fill(this.roleInput, query.role, 'Role');
		// The form always submits q, type and role, so wait for the submitted values to show in the URL.
		const type = query.type?.toUpperCase();
		await this.actions.clickAndWaitForUrl(
			this.searchButton,
			(url) =>
				url.pathname === '/' &&
				(query.q === undefined || url.searchParams.get('q') === query.q) &&
				(type === undefined || url.searchParams.get('type') === type) &&
				(query.role === undefined || url.searchParams.get('role') === query.role),
			'Search'
		);
	}

	/** The query string the browser is currently on, parsed. */
	get currentParams(): URLSearchParams {
		return new URL(this.page.url()).searchParams;
	}

	/** Type options read Agent/Skill/Workflow while the submitted values stay AGENT/SKILL/WORKFLOW. */
	async expectTypeOptionsLabelledWithPlainValues() {
		const options = this.typeSelect.locator('option');
		await expect(options).toHaveText(['All types', 'Agent', 'Skill', 'Workflow']);
		expect(
			await options.evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value))
		).toEqual(['', 'AGENT', 'SKILL', 'WORKFLOW']);
	}

	async expectSearchRoundTrips(q: string) {
		expect(this.currentParams.get('q')).toBe(q);
		await expect(this.searchInput).toHaveValue(q);
		await this.expectTitle(`Marketplace: "${q}" - AnchorAgentic`);
	}

	async expectTypeParam(value: 'AGENT' | 'SKILL' | 'WORKFLOW') {
		expect(this.currentParams.get('type')).toBe(value);
	}

	// --- Count line, empty states, clear filters ---
	async expectCountLine(text: string) {
		await expect(this.page.getByText(text)).toBeVisible();
	}

	async expectNoItemsMatch(filters: string) {
		await expect(this.page.getByText(`No items match ${filters}.`)).toBeVisible();
		await expect(this.clearFiltersLink).toBeVisible();
		await this.expectColdStartTextAbsent();
	}

	async expectColdStartTextAbsent() {
		await expect(this.page.getByText('No published items yet')).toHaveCount(0);
	}

	get clearFiltersLink(): Locator {
		return this.page.getByRole('link', { name: 'Clear filters' });
	}

	async clearFilters() {
		await this.actions.clickAndWaitForUrl(
			this.clearFiltersLink,
			(url) => url.pathname === '/' && url.search === '',
			'Clear filters'
		);
	}

	// --- A page past the last one ---
	async openPage(page: number) {
		await this.actions.goTo(`/?page=${page}`);
	}

	async expectNoSuchPage(page: number) {
		await expect(this.page.getByText(`There is no page ${page}.`)).toBeVisible();
		await this.expectColdStartTextAbsent();
		await expect(this.pager).toHaveCount(0);
	}

	async goToFirstPage() {
		await this.actions.clickAndWaitForUrl(
			this.page.getByRole('link', { name: 'Go to the first page' }),
			(url) => url.pathname === '/' && !url.searchParams.has('page'),
			'Go to the first page'
		);
	}

	// --- Pager ---
	get pager(): Locator {
		return this.page.getByRole('navigation', { name: 'Marketplace pages' });
	}
	get nextLink(): Locator {
		return this.pager.getByRole('link', { name: /Next/ });
	}

	async hasNextPage(): Promise<boolean> {
		return (await this.nextLink.count()) > 0;
	}

	async goToNextPage() {
		await this.actions.clickAndWaitForUrl(
			this.nextLink,
			(url) => url.searchParams.get('page') === '2',
			'Next'
		);
	}
}
