import { expect, test } from '@playwright/test';
import { AuthFlow } from './business/flows/auth.flow';
import { AuthoringFlow } from './business/flows/authoring.flow';
import { SessionFlow } from './business/flows/session.flow';
import { AgentDetailPage, NewAgentPage } from './business/pages/agent.page';
import { WorkflowDetailPage } from './business/pages/workflow.page';
import { requireLiveSupabase } from './business/support/live-supabase';

test.describe('Domain authoring (US-005–US-013)', () => {
	requireLiveSupabase();

	test('create a Role, Agent, Task assignment, Skill, and a Workflow mixing all three step types, then reorder', async ({
		page
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		// Role with a Task, then the Agent for that Role.
		const roleName = `Reviewer ${stamp}`;
		const taskName = `Review PR ${stamp}`;
		await authoring.createRoleWithTasks(roleName, [
			{ name: taskName, instructions: 'Check the diff for regressions.' }
		]);
		const agent = await authoring.createAgentForRole(roleName, 'You review pull requests.');
		const agentUrl = agent.url;

		// A second Agent for the same Role must be rejected (US-007 AC3).
		const newAgent = new NewAgentPage(page);
		await newAgent.open();
		await newAgent.expectRoleNotOffered(roleName);
		await page.goto(agentUrl);

		await agent.assignTask(taskName);

		// Skill (Role-independent), then a Workflow mixing Task + Agent + Skill steps.
		const skillName = `Lint Runner ${stamp}`;
		await authoring.createSkill(skillName, '# Lint Runner\nRun the linter.');

		const workflow = await authoring.createWorkflowWithSteps(`Release Flow ${stamp}`, [
			{ type: 'TASK', label: taskName },
			{ type: 'AGENT', label: `Agent for ${roleName}` },
			{ type: 'SKILL', label: skillName }
		]);
		await workflow.expectStepTypes('TASK', 'AGENT', 'SKILL');

		await authoring.reorderAndRemoveSteps(workflow);
	});

	test('US-012: owner edits a step reference and type, removes a middle step; a non-owner gets no step controls', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		const roleName = `Editor ${stamp}`;
		const task1 = `Draft ${stamp}`;
		const task2 = `Polish ${stamp}`;
		await authoring.createRoleWithTasks(roleName, [{ name: task1 }, { name: task2 }]);
		await authoring.createAgentForRole(roleName, 'You edit documents.');
		const skillName = `Spellcheck ${stamp}`;
		await authoring.createSkill(skillName);

		const workflow = await authoring.createWorkflowWithSteps(`Edit Flow ${stamp}`, [
			{ type: 'TASK', label: task1 },
			{ type: 'TASK', label: task1 },
			{ type: 'SKILL', label: skillName }
		]);

		// TC-13b: change the reference (Task -> another Task), then the type (Task -> Agent).
		await authoring.editStep(workflow, 0, 'TASK', task2);
		await authoring.editStep(workflow, 1, 'AGENT', `Agent for ${roleName}`);
		await workflow.expectStepAt(2, 'SKILL', skillName);

		// TC-24: removing the middle step leaves no gap.
		await authoring.removeStepAndExpectRemaining(workflow, 1, [
			{ type: 'TASK', label: task2 },
			{ type: 'SKILL', label: skillName }
		]);

		const viewer = await new SessionFlow(browser).startRegistered('viewer');
		await viewer.page.goto(workflow.url);
		const viewerWorkflow = new WorkflowDetailPage(viewer.page);
		await viewerWorkflow.expectStepCount(2);
		await viewerWorkflow.expectNoStepControls();
		await viewer.close();
	});

	test('a non-owner sees a read-only Agent page rather than an edit form', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		const roleName = `Support ${stamp}`;
		await authoring.createRole(roleName);
		const agent = await authoring.createAgentForRole(roleName);

		const viewer = await new SessionFlow(browser).startRegistered('viewer');
		await viewer.page.goto(agent.url);
		const viewerAgentPage = new AgentDetailPage(viewer.page);
		await viewerAgentPage.expectHeading(roleName);
		await viewerAgentPage.expectReadOnly();
		await expect(viewerAgentPage.saveButton).toHaveCount(0);

		await viewer.close();
	});
});
