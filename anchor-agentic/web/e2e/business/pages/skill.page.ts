import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';
import { ItemDetailPage } from './item-detail.page';

/** `/skills/new` */
export class NewSkillPage extends AnchorBasePage {
	async open() {
		await this.goto('/skills/new');
		await this.waitForHydration();
	}

	/** Creates a Skill with one file; redirects to its detail page. */
	async create(name: string, content: string, path = 'SKILL.md'): Promise<SkillDetailPage> {
		await this.actions.fill(this.page.getByLabel('Name'), name, 'Name');
		await this.actions.fill(this.page.getByLabel('Path'), path, 'Path');
		await this.actions.fill(this.page.getByLabel('Content'), content, 'Content');
		await this.actions.clickAndWaitForUrl(
			this.page.getByRole('button', { name: 'Create Skill' }),
			/\/skills\/[0-9a-f-]+$/,
			'Create Skill'
		);
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
