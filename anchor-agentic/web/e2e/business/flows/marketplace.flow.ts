import { expect, type Page } from '@playwright/test';
import { MarketplaceDetailPage } from '../pages/marketplace-detail.page';
import { MarketplacePage, type MarketplaceQuery } from '../pages/marketplace.page';
import { log } from '../support/log';
import type { ItemType } from '../support/test-data';

const FLOW = 'MarketplaceFlow';

/** Browsing, searching, filtering and rating on the public Marketplace (Epic F/G). */
export class MarketplaceFlow {
	readonly listing: MarketplacePage;
	readonly detail: MarketplaceDetailPage;

	constructor(private readonly page: Page) {
		this.listing = new MarketplacePage(page);
		this.detail = new MarketplaceDetailPage(page);
	}

	/** Anonymous journey: find the item in the listing → open it → read-only detail. */
	async browseAndOpenDetail(name: string, itemType: ItemType, id: string, searchTerm: string = name) {
		log.step(FLOW, `Browsing to "${name}"`);
		// Agents are indexed by Role name + system prompt, not their own "Agent for ..." name, so
		// callers pass the Role name as searchTerm for Agents. Narrowing is needed because the live
		// Marketplace accumulates items across runs and paginates.
		await this.listing.open({ q: searchTerm });
		await this.listing.expectListed(name);
		await this.listing.openItem(name, itemType, id);
		await this.detail.expectNotYetRated();
		log.ok(FLOW, 'Detail page opened');
	}

	async expectFound(query: MarketplaceQuery, name: string) {
		log.step(FLOW, `Searching ${JSON.stringify(query)} for "${name}"`);
		await this.listing.open(query);
		await this.listing.expectListed(name);
	}

	async expectFilteredOut(query: MarketplaceQuery, name: string) {
		log.step(FLOW, `Filtering ${JSON.stringify(query)} should hide "${name}"`);
		await this.listing.open(query);
		await this.listing.expectNotListed(name);
	}

	/** US-030: rating twice by the same user upserts rather than duplicating. */
	async rateTwiceAndVerifyUpsert(itemType: ItemType, id: string, first: number, second: number) {
		log.step(FLOW, `Rating ${itemType} ${id}: ${first} then ${second}`);
		await this.detail.open(itemType, id);
		await this.detail.expectNotYetRated();

		await this.detail.rate(first);
		await this.detail.expectRating(`${first.toFixed(1)}/5 (1 rating)`);

		await this.detail.rate(second);
		await this.detail.expectRating(`${second.toFixed(1)}/5 (1 rating)`);
		log.ok(FLOW, 'Resubmitting updated the existing rating');
	}

	/** US-031/032: a visitor sees the live aggregate but gets no rating control. */
	async expectAggregateWithoutRatingControl(
		visitorPage: Page,
		itemType: ItemType,
		id: string,
		summary: string
	) {
		const visitor = new MarketplaceDetailPage(visitorPage);
		await visitor.open(itemType, id);
		await visitor.expectRating(summary);
		await visitor.expectNoRatingControl();
		log.ok(FLOW, 'Visitor sees aggregate with no rating control');
	}

	/** US-027: a Draft's Marketplace URL is a 404 for everyone but (implicitly) nobody. */
	async expectDraftNotFound(visitorPage: Page, itemType: ItemType, id: string) {
		const response = await new MarketplaceDetailPage(visitorPage).open(itemType, id);
		expect(response?.status()).toBe(404);
		log.ok(FLOW, `Draft ${itemType} ${id} returned 404`);
	}
}
