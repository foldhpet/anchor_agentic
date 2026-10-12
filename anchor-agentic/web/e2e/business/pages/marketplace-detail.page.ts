import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';
import type { ItemType } from '../support/test-data';

/** `/marketplace/[itemType]/[id]` — published item detail with rating, clone and report. */
export class MarketplaceDetailPage extends AnchorBasePage {
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

	/** Arrives as if following a link from `fromPath` on this site (Referer / `document.referrer`). */
	async openFrom(itemType: ItemType, id: string, fromPath: string) {
		return this.goto(`/marketplace/${itemType}/${id}`, {
			referer: new URL(fromPath, this.baseUrl).href
		});
	}

	private get baseUrl(): string {
		return new URL(this.page.url() === 'about:blank' ? 'http://localhost:5173' : this.page.url())
			.origin;
	}

	async rate(score: number) {
		await this.actions.select(this.scoreSelect, String(score), 'Score');
		await this.actions.clickAndWaitForAction(this.rateButton, 'rate', 'Rate');
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
		await this.actions.clickAndWaitForAction(this.cloneButton, 'clone', 'Clone into My Sandbox');
		await this.actions.waitForUrl(new RegExp(`/${routeSegment}/[0-9a-f-]+$`), 'the cloned Draft');
	}

	// --- Anonymous log-in prompt (US-055 Part B) ---
	get anonymousNotice(): Locator {
		return this.page
			.getByRole('status')
			.filter({ hasText: 'Log in or register to clone this item into your Sandbox and rate it' });
	}

	async expectAnonymousNotice() {
		await expect(this.anonymousNotice).toBeVisible();
		await expect(this.anonymousNotice.getByRole('link', { name: 'Log in' })).toHaveAttribute(
			'href',
			'/login'
		);
		await expect(this.anonymousNotice.getByRole('link', { name: 'Register' })).toHaveAttribute(
			'href',
			'/register'
		);
	}

	async expectNoAnonymousNotice() {
		await expect(this.anonymousNotice).toHaveCount(0);
	}

	async followNoticeLogInLink() {
		await this.actions.clickAndWaitForUrl(
			this.anonymousNotice.getByRole('link', { name: 'Log in' }),
			/\/login$/,
			'Log in (notice)'
		);
	}

	async followNoticeRegisterLink() {
		await this.actions.clickAndWaitForUrl(
			this.anonymousNotice.getByRole('link', { name: 'Register' }),
			/\/register$/,
			'Register (notice)'
		);
	}

	async expectRateAndCloneControls() {
		await expect(this.rateForm).toBeVisible();
		await expect(this.cloneButton).toBeVisible();
	}

	// --- Type badge ---
	/** The badge reads e.g. `SKILL`, never `[SKILL]`. */
	async expectPlainTypeBadge(type: ItemType) {
		await expect(this.page.getByText(type, { exact: true })).toBeVisible();
		await expect(this.page.getByText(`[${type}]`)).toHaveCount(0);
	}

	// --- Report block ---
	get reportBlock(): Locator {
		return this.page.locator('details').filter({ hasText: 'Report this item' });
	}
	get reportSummary(): Locator {
		return this.reportBlock.locator('summary');
	}
	get reportReason(): Locator {
		return this.reportBlock.locator('select[name="reason"]');
	}

	/** `contentHeading` is the h2 that opens the item's content (Skill Files / Task Assignments / Steps). */
	async expectReportCollapsedBelowContent(contentHeading: string) {
		await expect(this.reportSummary).toBeVisible();
		await expect(this.reportBlock).not.toHaveAttribute('open', /.*/);
		await expect(this.reportReason).toBeHidden();
		const content = await this.page.getByRole('heading', { name: contentHeading }).boundingBox();
		const report = await this.reportSummary.boundingBox();
		expect(content, `"${contentHeading}" heading is rendered`).not.toBeNull();
		expect(report!.y, 'Report this item sits below the item content').toBeGreaterThan(content!.y);
	}

	async expandReport() {
		await this.waitForHydration();
		await this.actions.click(this.reportSummary, 'Report this item');
		await expect(this.reportReason).toBeVisible();
	}

	/** Keyboard operability: Enter on the focused summary toggles the block. */
	async collapseReportWithKeyboard() {
		await this.reportSummary.focus();
		await this.page.keyboard.press('Enter');
		await expect(this.reportReason).toBeHidden();
	}

	// --- Back to Marketplace ---
	get backLink(): Locator {
		return this.page.getByRole('link', { name: /Back to Marketplace/ });
	}

	/** The link is rebuilt after hydration, so wait for the expected href before clicking it. */
	async followBackLinkTo(pathAndQuery: string) {
		await expect(this.backLink).toHaveAttribute('href', pathAndQuery);
		await this.actions.clickAndWaitForUrl(
			this.backLink,
			(url) => `${url.pathname}${url.search}` === pathAndQuery,
			'Back to Marketplace'
		);
	}

	// --- Rating feedback (US-030 / US-055 Part C) ---
	get ratingPlaceholder(): Locator {
		return this.scoreSelect.locator('option', { hasText: 'Choose a rating…' });
	}

	async expectRatingPlaceholderSelected() {
		await expect(this.ratingPlaceholder).toHaveAttribute('disabled', '');
		await expect(this.scoreSelect.locator('option').first()).toHaveText('Choose a rating…');
		await expect(this.scoreSelect).toHaveValue('');
	}

	async expectRatingPreselected(score: number) {
		await expect(this.scoreSelect).toHaveValue(String(score));
		await expect(this.ratingPlaceholder).toHaveCount(0);
	}

	async expectRatingSavedMessage() {
		await expect(
			this.page.getByRole('status').filter({ hasText: 'Thanks, your rating is saved.' })
		).toBeVisible();
	}

	// --- Clone button ---
	async expectCloneButtonIdleName() {
		await expect(this.cloneButton).toBeEnabled();
		await expect(this.cloneButton).toHaveAccessibleName('Clone into My Sandbox');
	}

	/** Double-clicks Clone; resolves on the one new Draft the (disabled-while-busy) button produced. */
	async doubleClickClone(routeSegment: 'agents' | 'skills' | 'workflows') {
		await this.waitForHydration();
		await this.cloneButton.dblclick();
		await this.actions.waitForUrl(new RegExp(`/${routeSegment}/[0-9a-f-]+$`), 'the cloned Draft');
	}
}
