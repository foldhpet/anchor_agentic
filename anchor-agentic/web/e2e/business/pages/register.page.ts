import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';
import { authHrefFor } from '../support/return-to-data';

export class RegisterPage extends AnchorBasePage {
	get usernameInput(): Locator {
		return this.page.getByLabel('Username');
	}
	get emailInput(): Locator {
		return this.page.getByLabel('Email');
	}
	get passwordInput(): Locator {
		return this.page.getByLabel('Password');
	}
	get submitButton(): Locator {
		return this.page.getByRole('button', { name: 'Create account' });
	}

	async open() {
		await this.goto('/register');
		await this.waitForHydration();
	}

	/** Opens /register the way a Register link with a return target does (US-057). */
	async openWithTarget(target: string) {
		await this.goto(authHrefFor('/register', target));
		await this.waitForHydration();
	}

	async followLogInLink(target: string) {
		await this.actions.clickAndWaitForUrl(
			this.logInSwitchLink,
			(url) => url.pathname === '/login' && url.searchParams.get('next') === target,
			'Log in (switch form)'
		);
	}

	/** The link to the Log in form carries the same return target (or none when `target` is null). */
	get logInSwitchLink(): Locator {
		return this.mainLandmark.getByRole('link', { name: 'Log in' });
	}

	async expectLogInLinkCarries(target: string | null) {
		await expect(this.logInSwitchLink).toHaveAttribute(
			'href',
			target ? authHrefFor('/login', target) : '/login'
		);
	}

	/** Requests /register?next=<payload> as a signed-in user; returns where the redirect ended up. */
	async finalUrlWhenLoggedIn(rawQuery: string): Promise<URL> {
		return this.finalUrlOf(`/register?${rawQuery}`);
	}

	async fillAndSubmit(username: string, email: string, password: string) {
		await this.actions.fill(this.usernameInput, username, 'Username');
		await this.actions.fill(this.emailInput, email, 'Email');
		await this.actions.fillSecret(this.passwordInput, password, 'Password');
		await this.actions.click(this.submitButton, 'Create account');
	}

	async expectDuplicateEmailError() {
		await expect(this.page.getByText(/already exists|already registered/i)).toBeVisible();
	}
}
