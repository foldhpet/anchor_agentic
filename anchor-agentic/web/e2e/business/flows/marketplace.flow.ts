import { expect, type Page } from '@playwright/test';
import { MarketplaceDetailPage } from '../pages/marketplace-detail.page';
import { MarketplacePage, type MarketplaceQuery } from '../pages/marketplace.page';
import { log } from '../../core/log';
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
	async browseAndOpenDetail(
		name: string,
		itemType: ItemType,
		id: string,
		searchTerm: string = name
	) {
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

	/** US-055 Part B: what an anonymous visitor sees on a Published item page. */
	async expectAnonymousItemPage(itemType: ItemType, id: string, contentHeading: string) {
		log.step(FLOW, `Anonymous visitor opens ${itemType} ${id}`);
		await this.detail.open(itemType, id);
		await this.detail.expectAnonymousNotice();
		await this.detail.expectNoOwnerControls();
		await this.detail.expectNoRatingControl();
		await this.detail.expectPlainTypeBadge(itemType);

		await this.detail.expectReportCollapsedBelowContent(contentHeading);
		await this.detail.expandReport();
		await this.detail.collapseReportWithKeyboard();

		await this.detail.followNoticeLogInLink();
		log.ok(FLOW, 'Notice with working links; no Rate/Clone; Report collapsed below the content');
	}

	/** US-055 Part B: a registered user gets the controls and never the log-in notice. */
	async expectRegisteredItemControls(itemType: ItemType, id: string) {
		log.step(FLOW, `Registered user opens ${itemType} ${id}`);
		await this.detail.open(itemType, id);
		await this.detail.expectRateAndCloneControls();
		await this.detail.expectNoAnonymousNotice();
		await this.detail.expectCloneButtonIdleName();
		log.ok(FLOW, 'Rate and Clone present, no log-in notice');
	}

	/** US-055 Part B: clicking through from a filtered list, "Back to Marketplace" returns to it. */
	async expectBackLinkReturnsToFilteredList(
		name: string,
		itemType: ItemType,
		id: string,
		query: MarketplaceQuery
	) {
		log.step(FLOW, `Back link after browsing ${JSON.stringify(query)}`);
		await this.listing.open(query);
		await this.listing.expectListed(name);
		await this.listing.openItem(name, itemType, id);
		const expected = `/?${new URLSearchParams(query as Record<string, string>).toString()}`;
		await this.detail.followBackLinkTo(expected);
		log.ok(FLOW, `Back link returned to ${expected}`);
	}

	/** Arriving from a list page (referrer) keeps all four list parameters, including `page`. */
	async expectBackLinkKeepsAllListParameters(
		itemType: ItemType,
		id: string,
		list: Required<MarketplaceQuery>
	) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(list)) params.set(key, String(value));
		const expected = `/?${params.toString()}`;
		log.step(FLOW, `Back link when arriving from ${expected}`);
		await this.detail.openFrom(itemType, id, expected);
		await this.detail.followBackLinkTo(expected);
		log.ok(FLOW, 'q, type, role and page were preserved');
	}

	async expectBackLinkGoesHomeOnDirectArrival(itemType: ItemType, id: string) {
		await this.detail.open(itemType, id);
		await this.detail.followBackLinkTo('/');
		log.ok(FLOW, 'Direct arrival: Back goes to "/"');
	}

	/** US-055 Part C: type labels, special characters, count line, no-match message, Clear filters. */
	async searchAndClearFilters(itemName: string, missingTerm: string) {
		log.step(FLOW, `Searching for "${itemName}" through the form`);
		await this.listing.open();
		await this.listing.expectTypeOptionsLabelledWithPlainValues();

		await this.listing.search({ q: itemName });
		await this.listing.expectSearchRoundTrips(itemName);
		await this.listing.expectListed(itemName);
		await this.listing.expectCountLine(`1 item matching search "${itemName}"`);

		await this.listing.search({ q: itemName, type: 'Skill' });
		await this.listing.expectTypeParam('SKILL');
		await this.listing.expectListed(itemName);

		await this.listing.search({ q: missingTerm, type: 'Workflow' });
		await this.listing.expectTypeParam('WORKFLOW');
		await this.listing.expectNoItemsMatch(`search "${missingTerm}", type Workflow`);
		await this.listing.clearFilters();
		log.ok(FLOW, 'Count line, type labels, no-match message and Clear filters all work');
	}

	/** US-055 Part C: placeholder for an unrated item, then the "Thanks" confirmation after saving. */
	async rateAndExpectFeedback(itemType: ItemType, id: string, score: number) {
		log.step(FLOW, `Rating ${itemType} ${id} with ${score} and checking the feedback`);
		await this.detail.open(itemType, id);
		await this.detail.expectNotYetRated();
		await this.detail.expectRatingPlaceholderSelected();

		await this.detail.waitForHydration();
		await this.detail.rate(score);
		await this.detail.expectRatingSavedMessage();
		await this.detail.expectRating(`${score.toFixed(1)}/5 (1 rating)`);

		log.ok(FLOW, 'Placeholder and confirmation verified');
	}

	/** US-055 Part C: having rated before, the visitor's own score is preselected and there is no placeholder. */
	async expectOwnRatingPreselected(itemType: ItemType, id: string, score: number) {
		await this.detail.open(itemType, id);
		await this.detail.expectRatingPreselected(score);
		log.ok(FLOW, `Own score ${score} is preselected`);
	}
}
