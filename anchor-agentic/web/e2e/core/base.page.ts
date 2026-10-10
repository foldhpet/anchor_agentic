import type { Page } from '@playwright/test';

/**
 * Core Base Page: application-independent browser plumbing shared by every page model.
 * Anything that knows about AnchorAgentic.io (locators, routes, auth controls) belongs in
 * business/pages/anchor-base.page.ts, not here.
 */
export abstract class BasePage {
	constructor(protected readonly page: Page) {}

	async goto(path: string) {
		return this.page.goto(path);
	}

	/** Waits until the page has no in-flight network requests. */
	async waitForNetworkIdle() {
		await this.page.waitForLoadState('networkidle');
	}

	/** Last path segment of the *current* URL — read it right after creating/opening the item. */
	get currentId(): string {
		return this.page.url().split('/').pop() ?? '';
	}

	get url(): string {
		return this.page.url();
	}
}
