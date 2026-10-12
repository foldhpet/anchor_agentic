import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';
import { ItemDetailPage } from './item-detail.page';

/** `/roles/new` */
export class NewRolePage extends AnchorBasePage {
	get form(): Locator {
		return this.page.locator('form[action="?/create"]');
	}

	async open() {
		await this.goto('/roles/new');
		await this.waitForHydration();
	}

	/** Creates the Role; the app redirects straight to its detail page. */
	async create(name: string, description?: string): Promise<RoleDetailPage> {
		await this.actions.fill(this.form.getByLabel('Name'), name, 'Name');
		if (description) {
			await this.actions.fill(this.form.getByLabel('Description'), description, 'Description');
		}
		await this.actions.clickAndWaitForUrl(
			this.page.getByRole('button', { name: 'Create Role' }),
			/\/roles\/[0-9a-f-]+$/,
			'Create Role'
		);
		return new RoleDetailPage(this.page);
	}
}

/** `/roles/[id]` — Role editor with the inline "create Task" form. */
export class RoleDetailPage extends ItemDetailPage {
	protected readonly routeSegment = 'roles';

	/** A non-owner's hand-built request to the update action; returns what the server answered. */
	async submitRenameDirectly(roleId: string, name: string) {
		return this.postFormAction(`/roles/${roleId}?/update`, { name, description: '' });
	}

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
		await this.waitForHydration();
		await this.actions.fill(this.taskForm.getByLabel('Name'), name, 'Task name');
		if (instructions) {
			await this.actions.fill(
				this.taskForm.getByLabel('Instructions'),
				instructions,
				'Instructions'
			);
		}
		await this.actions.click(this.page.getByRole('button', { name: 'Create Task' }), 'Create Task');
		await expect(this.taskLink(name)).toBeVisible();
	}

	async openTask(name: string) {
		await this.actions.clickAndWaitForUrl(this.taskLink(name), /\/tasks\/[0-9a-f-]+$/, name);
	}

	/** Saves a new description and waits for the saved value to be reflected. */
	async saveDescription(text: string) {
		await this.actions.fill(this.descriptionInput, text, 'Description');
		await this.actions.clickAndWaitForAction(
			this.updateForm.getByRole('button', { name: 'Save' }),
			'update',
			'Save'
		);
		await expect(this.descriptionInput).toHaveValue(text);
	}

	async expectDescription(text: string) {
		await expect(this.descriptionInput).toHaveValue(text);
	}
}
