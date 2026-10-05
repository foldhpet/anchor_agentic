import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import type { ItemType } from '../support/test-data';

/** `/marketplace/[itemType]/[id]` — published item detail with rating, clone and report. */
export class MarketplaceDetailPage extends BasePage {
	get cloneButton(): Locator {
		return this.page.getByRole('button', { name: 'Clone into My Sandbox' });
	}
	get saveButton(): Locator {
		return this.page.getByRole('button', { name: 'Save' });
	}
	get rateForm(): Locator {
		return this.page.locator('form[action="?/rate"]');
	}
	get scoreSelect(): Locator {
		return this.rateForm.locator('select[name="score"]');
	}
	get rateButton(): Locator {
		return this.page.getByRole('button', { name: 'Rate' });
	}

	/** Returns the navigation response so callers can assert on 404s for Drafts. */
	async open(itemType: ItemType, id: string) {
		return this.goto(`/marketplace/${itemType}/${id}`);
	}

	async rate(score: number) {
		await this.scoreSelect.selectOption(String(score));
		await Promise.all([this.waitForAction('rate'), this.rateButton.click()]);
	}

	async expectRating(summary: string) {
		await expect(this.page.getByText(`Rating: ${summary}`)).toBeVisible();
	}

	async expectNotYetRated() {
		await expect(this.page.getByText('Not yet rated')).toBeVisible();
	}

	async expectNoRatingControl() {
		await expect(this.rateForm).toHaveCount(0);
	}

	async expectCloneAvailable() {
		await expect(this.cloneButton).toBeVisible();
	}

	async expectNoOwnerControls() {
		await expect(this.cloneButton).toHaveCount(0);
		await expect(this.saveButton).toHaveCount(0);
	}

	/** Clones into the viewer's Sandbox; resolves once redirected to the new Draft's own page. */
	async cloneIntoSandbox(routeSegment: 'agents' | 'skills' | 'workflows') {
		await Promise.all([this.waitForAction('clone'), this.cloneButton.click()]);
		await this.page.waitForURL(new RegExp(`/${routeSegment}/[0-9a-f-]+$`));
	}
}
