import { expect, type Page } from '@playwright/test';
import { AllSandboxPage } from '../pages/all-sandbox.page';
import { ErrorPage } from '../pages/error.page';
import { LoginPage } from '../pages/login.page';
import { MarketplaceDetailPage } from '../pages/marketplace-detail.page';
import { MarketplacePage } from '../pages/marketplace.page';
import { MySandboxPage } from '../pages/my-sandbox.page';
import { RegisterPage } from '../pages/register.page';
import { SettingsPage } from '../pages/settings.page';
import { log } from '../../core/log';
import type { ItemType } from '../support/test-data';

const FLOW = 'PageTitleFlow';

/** Page titles and the friendly error page (US-055 Part A, WCAG 2.4.2). */
export class PageTitleFlow {
	/**
	 * Every representative page is titled "<h1> - AnchorAgentic" and the titles are unique.
	 * `visitor` is not logged in (login/register stay reachable); `member` is a signed-in session.
	 */
	async expectUniqueTitles(visitor: Page, member: Page, item: { type: ItemType; id: string }) {
		log.step(FLOW, 'Checking page titles of a representative set of pages');
		const titles: string[] = [];

		const marketplace = new MarketplacePage(visitor);
		await marketplace.open();
		const plain = await marketplace.expectTitleMatchesHeading();
		expect(plain).toBe('Marketplace - AnchorAgentic');
		titles.push(plain);

		const q = `triage ${Date.now()}`;
		await marketplace.open({ q });
		const searched = `Marketplace: "${q}" - AnchorAgentic`;
		await marketplace.expectTitle(searched);
		titles.push(searched);

		// A second page only exists when the shared Marketplace holds more than one page of items;
		// asking for a page past the end is an API error (see report), so follow the pager instead.
		await marketplace.open();
		if (await marketplace.hasNextPage()) {
			await marketplace.goToNextPage();
			const paged = 'Marketplace: page 2 - AnchorAgentic';
			await marketplace.expectTitle(paged);
			titles.push(paged);
		} else {
			log.warn(FLOW, 'Marketplace has a single page of items: the "page 2" title is not checked');
		}

		const detail = new MarketplaceDetailPage(visitor);
		await detail.open(item.type, item.id);
		titles.push(await detail.expectTitleMatchesHeading());

		const login = new LoginPage(visitor);
		await login.open();
		titles.push(await login.expectTitleMatchesHeading());

		const register = new RegisterPage(visitor);
		await register.open();
		titles.push(await register.expectTitleMatchesHeading());

		const library = new MySandboxPage(member);
		await library.open();
		titles.push(await library.expectTitleMatchesHeading());

		const allSandbox = new AllSandboxPage(member);
		await allSandbox.open();
		titles.push(await allSandbox.expectTitleMatchesHeading());

		const settings = new SettingsPage(member);
		await settings.open();
		titles.push(await settings.expectTitleMatchesHeading());

		expect(new Set(titles).size, `titles are unique: ${titles.join(' | ')}`).toBe(titles.length);
		log.ok(FLOW, `${titles.length} pages, all titled "<h1> - AnchorAgentic" and unique`);
	}

	/** An unknown route and a missing item both show the custom error page, with HTTP 404. */
	async expectFriendly404s(visitor: Page, missingItem: { type: ItemType; id: string }) {
		log.step(FLOW, 'Opening an unknown route and a missing Marketplace item');
		const error = new ErrorPage(visitor);

		const route = await error.open(`/no-such-page-${Date.now()}`);
		expect(route?.status()).toBe(404);
		await error.expectFriendlyNotFound();

		const item = await error.open(`/marketplace/${missingItem.type}/${missingItem.id}`);
		expect(item?.status()).toBe(404);
		await error.expectFriendlyNotFound();

		await error.goToMarketplace();
		log.ok(FLOW, 'Both 404s use the friendly error page, which leads back to the Marketplace');
	}
}
