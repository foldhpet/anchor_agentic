import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import type { ItemType } from '../support/test-data';

export interface MarketplaceQuery {
	q?: string;
	type?: ItemType;
	role?: string;
}

/** `/` — public Marketplace listing with search, type and role filters. */
export class MarketplacePage extends BasePage {
	get heading(): Locator {
		return this.page.getByRole('heading', { name: 'Marketplace' });
	}

	itemLink(name: string): Locator {
		return this.page.getByRole('link', { name, exact: true });
	}

	async open(query: MarketplaceQuery = {}) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
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
		await this.itemLink(name).click();
		await this.page.waitForURL(`/marketplace/${itemType}/${id}`);
	}

	async expectDonationLinkOpensExternally(href: string) {
		await expect(this.donationLink).toBeVisible();
		await expect(this.donationLink).toHaveAttribute('href', href);
		await expect(this.donationLink).toHaveAttribute('target', '_blank');
		await expect(this.donationLink).toHaveAttribute('rel', /noopener/);
	}
}
