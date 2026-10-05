import type { Browser, BrowserContext, Page } from '@playwright/test';
import { log } from '../support/log';
import { readPersonas, storageStatePath, type Persona } from '../support/personas';
import type { UserIdentity } from '../support/test-data';

const FLOW = 'SessionFlow';

/** An isolated browser context acting as one user (or an anonymous visitor). */
export interface UserSession {
	context: BrowserContext;
	page: Page;
	identity?: UserIdentity;
	close(): Promise<void>;
}

/** Spins up extra, isolated "other user" sessions for multi-actor scenarios. */
export class SessionFlow {
	constructor(private readonly browser: Browser) {}

	async startAnonymous(): Promise<UserSession> {
		log.step(FLOW, 'Starting anonymous visitor session');
		const context = await this.browser.newContext();
		const page = await context.newPage();
		return { context, page, close: () => context.close() };
	}

	/** A context already signed in as a shared persona (see globalSetup). */
	async startRegistered(persona: Persona): Promise<UserSession> {
		log.step(FLOW, `Starting registered user session (${persona})`);
		const context = await this.browser.newContext({ storageState: storageStatePath(persona) });
		const page = await context.newPage();
		const identity = { ...readPersonas()[persona], stamp: Date.now() };
		return { context, page, identity, close: () => context.close() };
	}
}
