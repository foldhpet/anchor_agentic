import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
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
		await this.emailInput.fill(email);
		await this.passwordInput.fill(password);
		await this.submitButton.click();
	}

	async expectInvalidCredentialsError() {
		await expect(this.page.getByText('Invalid email or password.')).toBeVisible();
	}

	async expectSandboxReasonBanner() {
		await expect(this.page.getByText('Register or log in to continue to the Sandbox.')).toBeVisible();
	}
}
