import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { ItemDetailPage } from './item-detail.page';

export type StepType = 'TASK' | 'AGENT' | 'SKILL';

/** `/workflows/new` */
export class NewWorkflowPage extends BasePage {
	async open() {
		await this.goto('/workflows/new');
	}

	/** Creates a Workflow; redirects to its detail page. A description is needed to publish later. */
	async create(name: string, description?: string): Promise<WorkflowDetailPage> {
		await this.page.getByLabel('Name').fill(name);
		if (description) await this.page.getByLabel('Description').fill(description);
		await this.page.getByRole('button', { name: 'Create Workflow' }).click();
		await this.page.waitForURL(/\/workflows\/[0-9a-f-]+$/);
		return new WorkflowDetailPage(this.page);
	}
}

/** `/workflows/[id]` — Workflow editor with an ordered step list. */
export class WorkflowDetailPage extends ItemDetailPage {
	protected readonly routeSegment = 'workflows';

	get steps(): Locator {
		return this.page.locator('ol > li');
	}
	get addStepForm(): Locator {
		return this.page.locator('form[action="?/addStep"]');
	}

	/**
	 * Adds a step. `referenceLabel` picks a specific option; omit it to take the
	 * first one. Waits for the step count to advance because use:enhance resets
	 * the form after a successful submit, which races with re-selecting.
	 */
	async addStep(type: StepType, referenceLabel?: string) {
		const before = await this.steps.count();
		await this.addStepForm.locator('select[name="step_type"]').selectOption(type);
		if (referenceLabel) {
			await this.addStepForm
				.locator('select[name="reference_id"]')
				.selectOption({ label: referenceLabel });
		}
		await this.page.getByRole('button', { name: 'Add Step' }).click();
		await expect(this.steps).toHaveCount(before + 1);
	}

	async moveStepUp(index: number) {
		await this.steps.nth(index).getByRole('button', { name: '↑' }).click();
	}

	async removeStep(index: number) {
		await this.steps.nth(index).getByRole('button', { name: 'Remove' }).click();
	}

	async expectStepCount(count: number) {
		await expect(this.steps).toHaveCount(count);
	}

	async expectStepTypes(...types: StepType[]) {
		for (const [index, type] of types.entries()) {
			await expect(this.steps.nth(index)).toContainText(type);
		}
	}

	async expectStepLabel(type: StepType, label: string) {
		await expect(this.page.getByText(`${type}: ${label}`)).toBeVisible();
	}
}
