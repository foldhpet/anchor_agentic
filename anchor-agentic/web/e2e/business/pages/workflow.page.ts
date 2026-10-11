import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';
import { ItemDetailPage } from './item-detail.page';

export type StepType = 'TASK' | 'AGENT' | 'SKILL';

/** `/workflows/new` */
export class NewWorkflowPage extends AnchorBasePage {
	async open() {
		await this.goto('/workflows/new');
		await this.waitForHydration();
	}

	/** Creates a Workflow; redirects to its detail page. A description is needed to publish later. */
	async create(name: string, description?: string): Promise<WorkflowDetailPage> {
		await this.actions.fill(this.page.getByLabel('Name'), name, 'Name');
		if (description) {
			await this.actions.fill(this.page.getByLabel('Description'), description, 'Description');
		}
		await this.actions.clickAndWaitForUrl(
			this.page.getByRole('button', { name: 'Create Workflow' }),
			/\/workflows\/[0-9a-f-]+$/,
			'Create Workflow'
		);
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
	get editStepForms(): Locator {
		return this.page.locator('form[action="?/editStep"]');
	}
	get removeStepForms(): Locator {
		return this.page.locator('form[action="?/removeStep"]');
	}

	/**
	 * Adds a step. `referenceLabel` picks a specific option; omit it to take the
	 * first one. Waits for the step count to advance because use:enhance resets
	 * the form after a successful submit, which races with re-selecting.
	 */
	async addStep(type: StepType, referenceLabel?: string) {
		const before = await this.steps.count();
		await this.actions.select(
			this.addStepForm.locator('select[name="step_type"]'),
			type,
			'Step type'
		);
		if (referenceLabel) {
			await this.actions.select(
				this.addStepForm.locator('select[name="reference_id"]'),
				{ label: referenceLabel },
				'Step reference'
			);
		}
		await this.actions.click(this.page.getByRole('button', { name: 'Add Step' }), 'Add Step');
		await expect(this.steps).toHaveCount(before + 1);
	}

	async moveStepUp(index: number) {
		await this.actions.click(
			this.steps.nth(index).getByRole('button', { name: '↑' }),
			`Move step ${index + 1} up`
		);
	}

	async removeStep(index: number) {
		await this.actions.click(
			this.steps.nth(index).getByRole('button', { name: 'Remove', exact: true }),
			`Remove step ${index + 1}`
		);
	}

	/**
	 * US-012: edits a step in place — opens the inline form, picks the type and the
	 * referenced item by label, saves and waits for the `editStep` action.
	 */
	async editStep(index: number, type: StepType, referenceLabel: string) {
		const step = this.steps.nth(index);
		await this.actions.click(
			step.getByRole('button', { name: 'Edit', exact: true }),
			`Edit step ${index + 1}`
		);
		const form = this.editStepForms.and(step.locator('form'));
		await this.actions.select(form.locator('select[name="step_type"]'), type, 'Step type');
		await this.actions.select(
			form.locator('select[name="reference_id"]'),
			{ label: referenceLabel },
			'Step reference'
		);
		await this.actions.clickAndWaitForAction(
			form.getByRole('button', { name: 'Save' }),
			'editStep',
			'Save step'
		);
		await expect(step).toContainText(`${type}: ${referenceLabel}`);
	}

	/** Asserts the step at `index` shows `TYPE: label`. */
	async expectStepAt(index: number, type: StepType, label: string) {
		await expect(this.steps.nth(index)).toContainText(`${type}: ${label}`);
	}

	/** A non-owner / read-only viewer gets no per-step controls. */
	async expectNoStepControls() {
		await expect(this.page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
		await expect(this.page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0);
		await expect(this.editStepForms).toHaveCount(0);
		await expect(this.removeStepForms).toHaveCount(0);
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
