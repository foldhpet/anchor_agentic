import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { ItemDetailPage } from './item-detail.page';

/** `/agents/new` */
export class NewAgentPage extends BasePage {
	get roleSelect(): Locator {
		return this.page.getByLabel('Role');
	}
	get systemPromptInput(): Locator {
		return this.page.getByLabel('System prompt');
	}

	async open() {
		await this.goto('/agents/new');
	}

	/** Creates the Agent for a Role (one Agent per Role); redirects to its detail page. */
	async create(roleName: string, systemPrompt?: string): Promise<AgentDetailPage> {
		await this.roleSelect.selectOption({ label: roleName });
		if (systemPrompt) await this.systemPromptInput.fill(systemPrompt);
		await this.page.getByRole('button', { name: 'Create Agent' }).click();
		await this.page.waitForURL(/\/agents\/[0-9a-f-]+$/);
		return new AgentDetailPage(this.page);
	}

	/**
	 * US-007 AC3: a Role that already has an Agent is no longer offered. Checks the specific Role
	 * (not "no Roles at all") because the shared owner persona may own other Roles without Agents.
	 */
	async expectRoleNotOffered(roleName: string) {
		await expect(this.page.getByRole('heading', { name: 'New Agent' })).toBeVisible();
		await expect(this.roleSelect.locator('option', { hasText: roleName })).toHaveCount(0);
	}
}

/** `/agents/[id]` — Agent editor with Task assignment. */
export class AgentDetailPage extends ItemDetailPage {
	protected readonly routeSegment = 'agents';

	heading(roleName: string): Locator {
		return this.page.getByRole('heading', { name: `Agent for ${roleName}` });
	}

	private taskRow(taskName?: string): Locator {
		return taskName ? this.page.locator('li', { hasText: taskName }) : this.page.locator('body');
	}

	async assignTask(taskName?: string) {
		await this.taskRow(taskName).getByRole('button', { name: 'Assign' }).click();
		await this.expectTaskAssigned(taskName);
	}

	async expectTaskAssigned(taskName?: string) {
		await expect(this.taskRow(taskName).getByRole('button', { name: 'Unassign' })).toBeVisible();
	}

	async expectHeading(roleName: string) {
		await expect(this.heading(roleName)).toBeVisible();
	}
}
