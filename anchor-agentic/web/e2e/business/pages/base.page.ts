import { expect, type Locator, type Page } from '@playwright/test';

/** Shared layout: header nav, auth controls and footer present on every page. */
export abstract class BasePage {
	constructor(protected readonly page: Page) {}

	// --- Header / footer ---
	get logOutButton(): Locator {
		return this.page.getByRole('button', { name: 'Log out' });
	}
	get logInLink(): Locator {
		return this.page.getByRole('link', { name: 'Log in' });
	}
	get donationLink(): Locator {
		return this.page.getByRole('link', { name: /support this project/i });
	}
	get alert(): Locator {
		return this.page.getByRole('alert');
	}

	async goto(path: string) {
		return this.page.goto(path);
	}

	/** SvelteKit forms only enhance after hydration; filling earlier can reset the form. */
	async waitForHydration() {
		await this.page.waitForLoadState('networkidle');
	}

	async logOut() {
		await this.logOutButton.click();
	}

	async expectLoggedIn() {
		await expect(this.logOutButton).toBeVisible();
	}

	async expectLoggedOut() {
		await expect(this.logInLink).toBeVisible();
	}

	/** Last path segment of the *current* URL — read it right after creating/opening the item. */
	get currentId(): string {
		return this.page.url().split('/').pop() ?? '';
	}

	get url(): string {
		return this.page.url();
	}

	/** Waits for a POSTed SvelteKit form action (e.g. '?/publish') to complete. */
	protected waitForAction(action: string) {
		return this.page.waitForResponse(
			(resp) => resp.url().includes(`?/${action}`) && resp.request().method() === 'POST'
		);
	}
}
