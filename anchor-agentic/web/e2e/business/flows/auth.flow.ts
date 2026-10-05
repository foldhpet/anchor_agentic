import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import { log } from '../support/log';
import { readPersonas, storageStatePath, trackCreatedEmail, type Persona } from '../support/personas';
import { newIdentity, type UserIdentity } from '../support/test-data';

const FLOW = 'AuthFlow';

/** Register / log out / log in journeys (US-001, US-002). */
export class AuthFlow {
	private readonly register: RegisterPage;
	private readonly login: LoginPage;

	constructor(private readonly page: Page) {
		this.register = new RegisterPage(page);
		this.login = new LoginPage(page);
	}

	/**
	 * Signs this page's context in as a shared persona (created once in globalSetup), avoiding a
	 * signup per test. Returns the persona's identity with a fresh `stamp` for unique item names.
	 */
	async signInAs(persona: Persona): Promise<UserIdentity> {
		const identity = readPersonas()[persona];
		log.step(FLOW, `Signing in as shared persona "${persona}"`);
		const state = JSON.parse(readFileSync(storageStatePath(persona), 'utf-8'));
		await this.page.context().addCookies(state.cookies);
		await this.page.goto('/');
		await this.register.expectLoggedIn();
		log.ok(FLOW, `Signed in as ${identity.email}`);
		return { ...identity, stamp: Date.now() };
	}

	/** Registers a brand-new user through the UI and lands on the Marketplace, logged in. */
	async registerNewUser(tag: string): Promise<UserIdentity> {
		const identity = newIdentity(tag);
		log.step(FLOW, `Registering ${identity.username}`);
		await this.register.open();
		trackCreatedEmail(identity.email);
		await this.register.fillAndSubmit(identity.username, identity.email, identity.password);
		try {
			await expect(this.page).toHaveURL('/');
		} catch (e) {
			// Hosted Supabase throttles signups; surface that instead of a bare URL mismatch.
			if (await this.page.getByText(/rate limit/i).isVisible()) {
				throw new Error(
					'Supabase Auth signup rate limit reached — wait for it to reset (or raise [auth.rate_limit] / use fewer signups) and rerun.',
					{ cause: e }
				);
			}
			throw e;
		}
		log.ok(FLOW, `Registered ${identity.email}`);
		return identity;
	}

	/** Attempts to register with an existing email and asserts the duplicate error. */
	async registerDuplicateEmail(email: string, password: string, tag: string) {
		log.step(FLOW, `Re-registering ${email} (expecting rejection)`);
		await this.register.open();
		await this.register.fillAndSubmit(`${tag}${Date.now()}`, email, password);
		await this.register.expectDuplicateEmailError();
		log.ok(FLOW, 'Duplicate email rejected');
	}

	async logOut() {
		log.step(FLOW, 'Logging out');
		await this.register.expectLoggedIn();
		await this.register.logOut();
		await expect(this.page).toHaveURL('/');
		await this.register.expectLoggedOut();
		log.ok(FLOW, 'Logged out');
	}

	async logIn(email: string, password: string) {
		log.step(FLOW, `Logging in as ${email}`);
		await this.login.open();
		await this.login.fillAndSubmit(email, password);
		await expect(this.page).toHaveURL('/');
		await this.login.expectLoggedIn();
		log.ok(FLOW, 'Logged in');
	}

	/** US-002: a bad login gives a deliberately vague error. */
	async logInWithInvalidCredentials(email: string, password: string) {
		log.step(FLOW, `Logging in with invalid credentials for ${email}`);
		await this.login.open();
		await this.login.fillAndSubmit(email, password);
		await this.login.expectInvalidCredentialsError();
		log.ok(FLOW, 'Vague invalid-credentials error shown');
	}

	/** Register → log out → log back in. */
	async registerLogOutAndLogBackIn(tag: string): Promise<UserIdentity> {
		const identity = await this.registerNewUser(tag);
		await this.register.expectLoggedIn();
		await this.logOut();
		await this.logIn(identity.email, identity.password);
		return identity;
	}
}
