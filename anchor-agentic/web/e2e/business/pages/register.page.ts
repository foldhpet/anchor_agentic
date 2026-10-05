import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class RegisterPage extends BasePage {
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
		await this.usernameInput.fill(username);
		await this.emailInput.fill(email);
		await this.passwordInput.fill(password);
		await this.submitButton.click();
	}

	async expectDuplicateEmailError() {
		await expect(this.page.getByText(/already exists|already registered/i)).toBeVisible();
	}
}
