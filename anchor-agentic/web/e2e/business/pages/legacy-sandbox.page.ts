import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';

/** `/sandbox` — the original generic Sandbox item list (still routed, not in the nav). */
export class LegacySandboxPage extends AnchorBasePage {
	async open() {
		await this.goto('/sandbox');
	}

	async createItem(title: string) {
		await this.actions.fill(this.page.getByLabel('New item title'), title, 'New item title');
		await this.actions.click(this.page.getByRole('button', { name: 'Create' }), 'Create');
		await expect(this.page.locator('li input[name="title"]').first()).toHaveValue(title);
	}
}

/** `/sandbox/all` — every user's generic items, with a "try editing" probe on non-owned rows. */
export class LegacyAllSandboxPage extends AnchorBasePage {
	async open() {
		await this.goto('/sandbox/all');
	}

	/** Scoped to one row: the live DB accumulates other runs' items on this page. */
	rowFor(title: string): Locator {
		return this.page.locator('li', { hasText: title });
	}

	async expectItemListed(title: string) {
		await expect(this.page.getByText(title, { exact: false })).toBeVisible();
	}

	async attemptForbiddenEdit(title: string) {
		await this.actions.click(
			this.rowFor(title).getByRole('button', { name: 'Try editing (expect forbidden)' }),
			'Try editing (expect forbidden)'
		);
		await expect(this.page.getByRole('alert')).toContainText('Forbidden');
	}
}
