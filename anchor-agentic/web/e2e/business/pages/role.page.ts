import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { ItemDetailPage } from './item-detail.page';

/** `/roles/new` */
export class NewRolePage extends BasePage {
	get form(): Locator {
		return this.page.locator('form[action="?/create"]');
	}

	async open() {
		await this.goto('/roles/new');
	}

	/** Creates the Role; the app redirects straight to its detail page. */
	async create(name: string, description?: string): Promise<RoleDetailPage> {
		await this.form.getByLabel('Name').fill(name);
		if (description) await this.form.getByLabel('Description').fill(description);
		await this.page.getByRole('button', { name: 'Create Role' }).click();
		await this.page.waitForURL(/\/roles\/[0-9a-f-]+$/);
		return new RoleDetailPage(this.page);
	}
}

/** `/roles/[id]` — Role editor with the inline "create Task" form. */
export class RoleDetailPage extends ItemDetailPage {
	protected readonly routeSegment = 'roles';

	get updateForm(): Locator {
		return this.page.locator('form[action="?/update"]');
	}
	get descriptionInput(): Locator {
		return this.updateForm.locator('input[name="description"]');
	}
	get taskForm(): Locator {
		return this.page.locator('form[action="?/createTask"]');
	}

	taskLink(name: string): Locator {
		return this.page.getByRole('link', { name });
	}

	async createTask(name: string, instructions?: string) {
		await this.taskForm.getByLabel('Name').fill(name);
		if (instructions) await this.taskForm.getByLabel('Instructions').fill(instructions);
		await this.page.getByRole('button', { name: 'Create Task' }).click();
		await expect(this.taskLink(name)).toBeVisible();
	}

	async openTask(name: string) {
		await this.taskLink(name).click();
		await this.page.waitForURL(/\/tasks\/[0-9a-f-]+$/);
	}

	/** Saves a new description and waits for the saved value to be reflected. */
	async saveDescription(text: string) {
		await this.descriptionInput.fill(text);
		await Promise.all([
			this.waitForAction('update'),
			this.updateForm.getByRole('button', { name: 'Save' }).click()
		]);
		await expect(this.descriptionInput).toHaveValue(text);
	}

	async expectDescription(text: string) {
		await expect(this.descriptionInput).toHaveValue(text);
	}
}
