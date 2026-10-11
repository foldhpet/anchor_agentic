import type { Locator, Page, Response } from '@playwright/test';
import { log } from './log';

/** Anything `page.waitForURL` accepts. */
type UrlMatcher = string | RegExp | ((url: URL) => boolean);

const MAX_LOGGED_VALUE = 40;

/** Quotes a value for the log line, shortening long text (e.g. a Skill's file content). */
function show(value: string): string {
	const flat = value.replace(/\s+/g, ' ').trim();
	const shown = flat.length > MAX_LOGGED_VALUE ? `${flat.slice(0, MAX_LOGGED_VALUE)}…` : flat;
	return `"${shown}"`;
}

/**
 * Core User Actions: the application-independent interactions a user performs in a browser
 * (navigate, type, choose, click, submit). They are shared by many page models, flows and
 * tests, so each one lives here once and writes a single log line saying what it did.
 *
 * Rules for this file:
 * - No knowledge of AnchorAgentic.io: no routes, labels or locators. Callers pass the
 *   Locator and a human-readable `label` for it.
 * - Only interactions used in more than one place belong here. One-off interactions stay in
 *   the page model that needs them.
 * - Assertions are not user actions; they stay in page models.
 */
export class UserActions {
	constructor(private readonly page: Page) {}

	/** Opens a path or URL. Returns the navigation response so callers can assert on status. */
	async goTo(path: string): Promise<Response | null> {
		const response = await this.page.goto(path);
		log.action(`Opened ${path}`);
		return response;
	}

	/** Types a value into a field. */
	async fill(target: Locator, value: string, label: string): Promise<void> {
		await target.fill(value);
		log.action(`Filled ${show(label)} with ${show(value)}`);
	}

	/** Types a secret into a field; the value is never written to the log. */
	async fillSecret(target: Locator, value: string, label: string): Promise<void> {
		await target.fill(value);
		log.action(`Filled ${show(label)} with ******`);
	}

	/** Chooses an option of a <select>, by value or by visible label. */
	async select(target: Locator, option: string | { label: string }, label: string): Promise<void> {
		await target.selectOption(option);
		const chosen = typeof option === 'string' ? option : option.label;
		log.action(`Selected ${show(chosen)} in ${show(label)}`);
	}

	/** Clicks a control. */
	async click(target: Locator, label: string): Promise<void> {
		await target.click();
		log.action(`Clicked ${show(label)}`);
	}

	/**
	 * Clicks a control that submits a SvelteKit form action (e.g. 'publish' for `?/publish`)
	 * and waits for the action's POST response, so the next step sees the saved state.
	 */
	async clickAndWaitForAction(target: Locator, action: string, label: string): Promise<void> {
		await Promise.all([
			this.page.waitForResponse(
				(resp) => resp.url().includes(`?/${action}`) && resp.request().method() === 'POST'
			),
			target.click()
		]);
		log.action(`Clicked ${show(label)} and the "${action}" action completed`);
	}

	/** Clicks a control that navigates and waits until the browser reaches the expected URL. */
	async clickAndWaitForUrl(target: Locator, url: UrlMatcher, label: string): Promise<void> {
		await target.click();
		await this.page.waitForURL(url);
		log.action(`Clicked ${show(label)} and navigated to ${this.page.url()}`);
	}

	/** Waits until the browser reaches the expected URL (e.g. after a redirecting action). */
	async waitForUrl(url: UrlMatcher, label: string): Promise<void> {
		await this.page.waitForURL(url);
		log.action(`Reached ${show(label)} at ${this.page.url()}`);
	}
}
