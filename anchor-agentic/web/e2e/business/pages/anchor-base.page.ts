import { expect, type Locator } from '@playwright/test';
import { BasePage as CoreBasePage } from '../../core/base.page';

export const SITE_NAME = 'AnchorAgentic';

/** Shared layout: header nav, auth controls and footer present on every page. */
export abstract class AnchorBasePage extends CoreBasePage {
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

	/** SvelteKit forms only enhance after hydration; filling earlier can reset the form. */
	async waitForHydration() {
		await this.waitForNetworkIdle();
	}

	// --- Page title (US-055 Part A, WCAG 2.4.2) ---
	get mainHeading(): Locator {
		return this.page.getByRole('heading', { level: 1 });
	}

	/** The page's `<title>` must be exactly "<h1> - AnchorAgentic". Returns the title that was verified. */
	async expectTitleMatchesHeading(): Promise<string> {
		await expect(this.mainHeading).toHaveCount(1);
		const heading = ((await this.mainHeading.textContent()) ?? '').replace(/\s+/g, ' ').trim();
		await expect(this.page).toHaveTitle(`${heading} - ${SITE_NAME}`);
		return `${heading} - ${SITE_NAME}`;
	}

	async expectTitle(title: string) {
		await expect(this.page).toHaveTitle(title);
	}

	/** Reloads the current page and waits until it has settled. */
	async reload() {
		await this.page.reload();
		await this.waitForNetworkIdle();
	}

	async logOut() {
		await this.actions.click(this.logOutButton, 'Log out');
	}

	async expectLoggedIn() {
		await expect(this.logOutButton).toBeVisible();
	}

	async expectLoggedOut() {
		await expect(this.logInLink).toBeVisible();
	}
}
