import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';

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
