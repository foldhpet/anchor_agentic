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

	// --- Direct form-action requests (bypass the UI, keep the session) ---
	/**
	 * POSTs a SvelteKit form action as the signed-in user, the way a hand-built request would: the page
	 * hides the form from a non-owner, but the action endpoint still has to refuse. Needs a loaded page
	 * (for the origin SvelteKit checks) and returns the action result (`type`, `status`, `data`).
	 */
	async postFormAction(
		path: string,
		form: Record<string, string>
	): Promise<{ type: string; status: number; data: string }> {
		const origin = new URL(this.page.url()).origin;
		const response = await this.page.request.post(path, {
			form,
			headers: { origin, 'x-sveltekit-action': 'true', accept: 'application/json' }
		});
		return await response.json();
	}

	// --- Affordance ---
	/** Clickable controls show the hand cursor (a base rule in layout.css; Tailwind v4 no longer sets it). */
	async expectPointerCursor(control: Locator) {
		await expect(control).toHaveCSS('cursor', 'pointer');
	}

	// --- Skip link (WCAG 2.4.1 Bypass Blocks) ---
	get skipLink(): Locator {
		return this.page.getByRole('link', { name: 'Skip to content' });
	}
	get mainLandmark(): Locator {
		return this.page.getByRole('main');
	}

	/**
	 * The skip link is the first Tab stop, becomes visible when focused, and activating it moves focus
	 * to <main>, past the repeated navigation.
	 */
	async expectSkipLinkBypassesNav() {
		await this.page.keyboard.press('Tab');
		await expect(this.skipLink).toBeFocused();
		const box = await this.skipLink.boundingBox();
		expect(box?.width ?? 0, 'the focused skip link is visibly rendered').toBeGreaterThan(40);
		await this.page.keyboard.press('Enter');
		await expect(this.mainLandmark).toBeFocused();
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
