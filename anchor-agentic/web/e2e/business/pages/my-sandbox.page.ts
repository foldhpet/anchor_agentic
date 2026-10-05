import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export type GroupHeading = 'Roles' | 'Tasks' | 'Agents' | 'Skills' | 'Workflows';

/** `/library` — "My Sandbox": the owner's items grouped by type, with status badges. */
export class MySandboxPage extends BasePage {
	get showArchivedCheckbox(): Locator {
		return this.page.getByLabel('Show archived');
	}

	async open() {
		await this.goto('/library');
	}

	groupHeading(name: GroupHeading): Locator {
		return this.page.getByRole('heading', { name });
	}

	itemLink(name: string): Locator {
		return this.page.getByRole('link', { name, exact: true });
	}

	/** The list row for an item, matched by its exact link text. */
	itemRow(name: string): Locator {
		return this.page.locator('li').filter({ has: this.itemLink(name) });
	}

	async expectGroups(...headings: GroupHeading[]) {
		for (const heading of headings) await expect(this.groupHeading(heading)).toBeVisible();
	}

	async expectItemStatus(name: string, status: 'Draft' | 'Published' | 'Archived') {
		await expect(this.itemRow(name)).toContainText(`[${status}]`);
	}

	async expectItemVisible(name: string) {
		await expect(this.itemLink(name)).toBeVisible();
	}

	/** Archived items are hidden by default — matched loosely on row text. */
	async expectItemHidden(name: string) {
		await expect(this.page.locator('li', { hasText: name })).toHaveCount(0);
	}

	async showArchived() {
		await this.showArchivedCheckbox.check();
	}

	async expectArchivedItemShown(name: string) {
		await expect(this.page.locator('li', { hasText: name })).toContainText('[Archived]');
	}

	async openItem(name: string) {
		await this.itemLink(name).click();
	}
}
