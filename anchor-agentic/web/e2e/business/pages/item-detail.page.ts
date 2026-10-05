import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Behaviour shared by every Sandbox detail page (Role, Task, Agent, Skill, Workflow):
 * status line, Save/Publish/Archive/Clone controls, provenance and Version History.
 */
export abstract class ItemDetailPage extends BasePage {
	/** Route segment this page lives under, e.g. 'agents'. */
	protected abstract readonly routeSegment: string;

	get saveButton(): Locator {
		return this.page.getByRole('button', { name: 'Save' });
	}
	get publishButton(): Locator {
		return this.page.getByRole('button', { name: 'Publish' });
	}
	get archiveButton(): Locator {
		return this.page.getByRole('button', { name: 'Archive' });
	}
	get cloneButton(): Locator {
		return this.page.getByRole('button', { name: 'Clone into My Sandbox' });
	}

	async open(id: string) {
		await this.goto(`/${this.routeSegment}/${id}`);
	}

	async expectOnDetailPage() {
		await expect(this.page).toHaveURL(new RegExp(`/${this.routeSegment}/[0-9a-f-]+$`));
	}

	// --- Status ---
	async expectStatus(status: 'Draft' | 'Published' | 'Archived') {
		await expect(this.page.getByText(`Status: ${status}`)).toBeVisible();
	}

	async expectPublishedVersion() {
		await expect(this.page.getByText(/Published at v\d+\./)).toBeVisible();
	}

	// --- Actions ---
	/** Waits for the publish round-trip; callers then assert success or the quality-gate alert. */
	async publish() {
		// Let any in-flight invalidation (e.g. after adding a step) settle before submitting.
		await this.waitForHydration();
		await Promise.all([this.waitForAction('publish'), this.publishButton.click()]);
	}

	async archive() {
		await this.archiveButton.click();
		await this.expectStatus('Archived');
	}

	/** Clones a Published item; resolves once redirected to the new Draft (different URL). */
	async clone() {
		const sourceUrl = this.page.url();
		const detailUrl = new RegExp(`/${this.routeSegment}/[0-9a-f-]+$`);
		await Promise.all([this.waitForAction('clone'), this.cloneButton.click()]);
		await this.page.waitForURL((url) => url.href !== sourceUrl && detailUrl.test(url.pathname));
	}

	// --- Read-only / provenance ---
	async expectReadOnly() {
		await expect(this.saveButton).toHaveCount(0);
		await expect(this.page.getByText('Status:')).toBeVisible();
	}

	async expectArchivedReadOnly() {
		await expect(
			this.page.getByText('This item is archived — clone it to resume work.')
		).toBeVisible();
		await expect(this.saveButton).toHaveCount(0);
	}

	async expectClonedFrom() {
		await expect(this.page.getByText('Cloned from')).toBeVisible();
	}

	async expectCloneCount(times: number) {
		await expect(this.page.getByText(`Cloned ${times} times`)).toBeVisible();
	}

	// --- Version History ---
	get versionButtons(): Locator {
		return this.page.locator('h2:has-text("Version History") ~ ul button');
	}
	get versionSnapshot(): Locator {
		return this.page.locator('pre');
	}

	async expectVersionCount(count: number) {
		await expect(this.versionButtons).toHaveCount(count);
	}

	async openOldestVersion() {
		await this.versionButtons.last().click();
		await expect(this.versionSnapshot).toBeVisible();
	}

	async closeVersionSnapshot() {
		await this.page.getByRole('button', { name: 'Close' }).click();
		await expect(this.versionSnapshot).toHaveCount(0);
	}
}
