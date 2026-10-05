import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { ItemDetailPage } from './item-detail.page';

/** `/skills/new` */
export class NewSkillPage extends BasePage {
	async open() {
		await this.goto('/skills/new');
	}

	/** Creates a Skill with one file; redirects to its detail page. */
	async create(name: string, content: string, path = 'SKILL.md'): Promise<SkillDetailPage> {
		await this.page.getByLabel('Name').fill(name);
		await this.page.getByLabel('Path').fill(path);
		await this.page.getByLabel('Content').fill(content);
		await this.page.getByRole('button', { name: 'Create Skill' }).click();
		await this.page.waitForURL(/\/skills\/[0-9a-f-]+$/);
		return new SkillDetailPage(this.page);
	}
}

/** `/skills/[id]` — Skill editor (name, description, skill files). */
export class SkillDetailPage extends ItemDetailPage {
	protected readonly routeSegment = 'skills';

	get nameInput(): Locator {
		return this.page.locator('input[name="name"]');
	}

	async expectName(name: string) {
		await expect(this.nameInput).toHaveValue(name);
	}
}
