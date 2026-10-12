import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';
import { authHrefFor } from '../support/return-to-data';

export class LoginPage extends AnchorBasePage {
	get emailInput(): Locator {
		return this.page.getByLabel('Email');
	}
	get passwordInput(): Locator {
		return this.page.getByLabel('Password');
	}
	get submitButton(): Locator {
		return this.page.getByRole('button', { name: 'Log in' });
	}

	async open() {
		await this.goto('/login');
	}

	/** Opens /login the way a Log in link with a return target does (US-057). */
	async openWithTarget(target: string) {
		await this.goto(authHrefFor('/login', target));
		await this.waitForHydration();
	}

	get registerLink(): Locator {
		return this.mainLandmark.getByRole('link', { name: 'Register' });
	}

	/** The link to the Register form carries the same return target (or none when `target` is null). */
	async expectRegisterLinkCarries(target: string | null) {
		await expect(this.registerLink).toHaveAttribute(
			'href',
			target ? authHrefFor('/register', target) : '/register'
		);
	}

	async followRegisterLink(target: string) {
		await this.actions.clickAndWaitForUrl(
			this.registerLink,
			(url) => url.pathname === '/register' && url.searchParams.get('next') === target,
			'Register (switch form)'
		);
	}

	/** Requests /login?next=<payload> as a signed-in user; returns where the redirect ended up. */
	async finalUrlWhenLoggedIn(rawQuery: string): Promise<URL> {
		return this.finalUrlOf(`/login?${rawQuery}`);
	}

	async fillAndSubmit(email: string, password: string) {
		await this.actions.fill(this.emailInput, email, 'Email');
		await this.actions.fillSecret(this.passwordInput, password, 'Password');
		await this.actions.click(this.submitButton, 'Log in');
	}

	async expectInvalidCredentialsError() {
		await expect(this.page.getByText('Invalid email or password.')).toBeVisible();
	}

	async expectSandboxReasonBanner() {
		await expect(
			this.page.getByText('Register or log in to continue to the Sandbox.')
		).toBeVisible();
	}
}
