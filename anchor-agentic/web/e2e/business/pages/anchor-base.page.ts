import { expect, type Locator } from '@playwright/test';
import { BasePage as CoreBasePage } from '../../core/base.page';

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
