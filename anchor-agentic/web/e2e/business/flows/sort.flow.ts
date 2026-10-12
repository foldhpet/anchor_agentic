import { expect, type Page } from '@playwright/test';
import { MarketplacePage } from '../pages/marketplace.page';
import { log } from '../../core/log';

const FLOW = 'SortFlow';

/** Choosing how the Marketplace list is ordered (US-058). */
export class SortFlow {
	readonly listing: MarketplacePage;

	constructor(page: Page) {
		this.listing = new MarketplacePage(page);
	}

	/** Default state: no sort in the URL, "Most cloned" chosen, no "Sorted by" line. */
	async expectDefaultOrder() {
		log.step(FLOW, 'Opening the Marketplace without a sort');
		await this.listing.open();
		this.listing.expectSortParam(null);
		await this.listing.expectSortSelected('Most cloned');
		await this.listing.expectSortedBySummary(null);
		log.ok(FLOW, 'Default is Most cloned and is not written into the URL');
	}

	/** Choosing "Highest rated" then "Newest" puts the value in the URL, keeps it selected and says so. */
	async chooseEachOrder() {
		await this.listing.open();
		log.step(FLOW, 'Choosing Highest rated');
		await this.listing.sortBy('Highest rated', 'rating');
		await this.listing.expectSortSelected('Highest rated');
		await this.listing.expectSortedBySummary('Highest rated');

		log.step(FLOW, 'Choosing Newest');
		await this.listing.sortBy('Newest', 'newest');
		await this.listing.expectSortSelected('Newest');
		await this.listing.expectSortedBySummary('Newest');
		await this.listing.expectRenderedWithoutError();

		log.step(FLOW, 'Choosing Most cloned again');
		await this.listing.sortByDefault();
		await this.listing.expectSortSelected('Most cloned');
		await this.listing.expectSortedBySummary(null);
		log.ok(FLOW, 'Each order is applied and shown');
	}

	/** An unknown value falls back to the default without an error page. */
	async expectInvalidSortFallsBack(value: string) {
		log.step(FLOW, `Opening /?sort=${value}`);
		const response = await this.listing.open({ sort: value });
		expect(response?.status()).toBe(200);
		await this.listing.expectRenderedWithoutError();
		await this.listing.expectSortSelected('Most cloned');
		await this.listing.expectSortedBySummary(null);
		log.ok(FLOW, 'HTTP 200, Most cloned selected, no error');
	}

	/** A new search drops the page but keeps the sort; Clear filters keeps the sort too. */
	async expectSortSurvivesFiltering(sort: string, q: string) {
		log.step(FLOW, `Searching "${q}" from sort=${sort}&page=2`);
		await this.listing.open({ sort, page: 2 });
		await this.listing.waitForHydration();
		await this.listing.search({ q });
		this.listing.expectSortParam(sort);
		expect(this.listing.currentParams.get('q')).toBe(q);
		expect(this.listing.currentParams.has('page'), 'a new filter resets to page 1').toBe(false);
		await this.listing.expectSortSelected('Highest rated');
		log.ok(FLOW, 'Sort kept and page reset across a filter change');
	}

	/** Clear filters (shown for a no-match search) keeps the sort. */
	async expectClearFiltersKeepsSort(sort: string, missingTerm: string) {
		log.step(FLOW, `Searching for nothing under sort=${sort}`);
		await this.listing.open({ sort, q: missingTerm });
		await this.listing.expectNoItemsMatch(`search "${missingTerm}"`);
		await this.listing.clearFiltersKeepingSort(sort);
		await this.listing.expectSortSelected('Highest rated');
		log.ok(FLOW, 'Clear filters removed q but kept sort');
	}

	/** Pager links keep the sort. Returns false (and warns) when the live list fits on one page. */
	async expectPagerKeepsSort(sort: string): Promise<boolean> {
		await this.listing.open({ sort });
		const checked = await this.listing.expectPagerLinksKeepSort(sort);
		if (checked) log.ok(FLOW, `Every pager link carries sort=${sort}`);
		else log.warn(FLOW, 'Only one page of results; pager links not checked');
		return checked;
	}

	/** Keyboard only: select, ArrowDown, Tab to Sort, Enter. */
	async sortWithKeyboardOnly() {
		await this.listing.open();
		await this.listing.sortByKeyboardNextOption('rating');
		await this.listing.expectSortSelected('Highest rated');
		await this.listing.expectSortedBySummary('Highest rated');
		log.ok(FLOW, 'Sort applied with the keyboard alone');
	}
}
