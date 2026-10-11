import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';

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
