import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';

/** The custom root error page (`+error.svelte`) shown for unknown routes and missing items. */
export class ErrorPage extends AnchorBasePage {
	get marketplaceLink(): Locator {
		return this.page.getByRole('link', { name: 'Go to the Marketplace' });
	}
	get loginLink(): Locator {
		return this.page.getByRole('main').getByRole('link', { name: 'Log in' });
	}

	/** Opens a path expected to fail; returns the navigation response. */
	async open(path: string) {
		return this.goto(path);
	}

	/** US-055 Part A: h1, plain-language 404 reason, links out, no stack trace or internals. */
	async expectFriendlyNotFound() {
		await expect(this.mainHeading).toHaveText('Page not found');
		await expect(
			this.page.getByText('This item may have been removed or unpublished')
		).toBeVisible();
		await expect(this.marketplaceLink).toHaveAttribute('href', '/');
		await expect(this.loginLink).toHaveAttribute('href', '/login');
		const body = (await this.page.locator('body').innerText()).toLowerCase();
		for (const leak of [
			'stack',
			'internal error',
			'item not found',
			'.ts:',
			'.js:',
			'node_modules'
		]) {
			expect(body, `error page must not expose "${leak}"`).not.toContain(leak);
		}
		await this.expectTitleMatchesHeading();
	}

	async goToMarketplace() {
		await this.actions.clickAndWaitForUrl(
			this.marketplaceLink,
			(url) => url.pathname === '/',
			'Go to the Marketplace'
		);
	}
}
