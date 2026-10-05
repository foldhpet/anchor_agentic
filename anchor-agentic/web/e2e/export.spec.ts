import { expect, test } from '@playwright/test';
import { AuthFlow } from './business/flows/auth.flow';
import { AuthoringFlow } from './business/flows/authoring.flow';
import { ExportFlow } from './business/flows/export.flow';
import { SessionFlow } from './business/flows/session.flow';
import { TaskDetailPage } from './business/pages/task.page';
import { requireLiveSupabase } from './business/support/live-supabase';

// US-039: the proxy route (web/src/routes/export/[itemType]/[id]/+server.ts)
// is the same manifest a direct API caller gets from POST /api/v1/export
// with target: "zip" — asserting against it directly is the API-parity
// check, without relying on headless zip/download interception.
test.describe('Export & API Parity (US-033–US-035, US-037, US-039)', () => {
	requireLiveSupabase();

	test('owner exports a Draft Agent to .claude/agents/<slug>.md', async ({ page }) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		const roleName = `Export Reviewer ${stamp}`;
		const prompt = 'You review release notes for accuracy.';
		await authoring.createRole(roleName);
		const agent = await authoring.createAgentForRole(roleName, prompt);

		// Never published — proves export is not gated behind Published status
		// for the owner (unlike clone.ts's rule).
		await agent.expectStatus('Draft');

		const file = await new ExportFlow(page).exportSingleFile(
			'AGENT',
			agent.currentId,
			/^\.claude\/agents\/.+\.md$/
		);
		expect(file.content).toContain(roleName);
		expect(file.content).toContain(prompt);
	});

	test('owner exports a Skill to .claude/skills/<slug>/, preserving file content byte-for-byte', async ({
		page
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');

		const skillContent = '# Lint Runner\nRun the linter before every commit.';
		const skill = await new AuthoringFlow(page).createSkill(
			`Export Lint Runner ${stamp}`,
			skillContent
		);

		const file = await new ExportFlow(page).exportSingleFile(
			'SKILL',
			skill.currentId,
			/^\.claude\/skills\/.+\/SKILL\.md$/
		);
		expect(file.content).toBe(skillContent);
	});

	test("owner exports a Workflow to .claude/commands/<slug>.md, inlining a Task step's instructions", async ({
		page
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		const taskName = `Draft Release Notes ${stamp}`;
		const instructions = 'Summarize every merged PR since the last tag.';
		await authoring.createRoleWithTasks(`Export Flow Role ${stamp}`, [
			{ name: taskName, instructions }
		]);
		const workflow = await authoring.createWorkflowWithSteps(`Export Release Flow ${stamp}`, [
			{ type: 'TASK', label: taskName }
		]);

		const file = await new ExportFlow(page).exportSingleFile(
			'WORKFLOW',
			workflow.currentId,
			/^\.claude\/commands\/.+\.md$/
		);
		expect(file.content).toContain(taskName);
		expect(file.content).toContain(instructions);
	});

	test('owner exports a Workflow with an Agent step: bundles the Agent file alongside the command file', async ({
		page
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		const roleName = `Export Agent Role ${stamp}`;
		const prompt = 'Organize files into categories.';
		await authoring.createRole(roleName);
		await authoring.createAgentForRole(roleName, prompt);
		const workflow = await authoring.createWorkflowWithSteps(`Export Flow with Agent ${stamp}`, [
			{ type: 'AGENT', label: `Agent for ${roleName}` }
		]);

		const { commandFile, agentFile } = await new ExportFlow(page).exportWorkflowBundle(
			workflow.currentId
		);
		expect(commandFile.content).toContain(`Agent for ${roleName}`);
		expect(agentFile.content).toContain(prompt);
	});

	test("a non-owner cannot export another user's Draft item", async ({ page, browser }) => {
		await new AuthFlow(page).signInAs('owner');
		const skill = await new AuthoringFlow(page).createSkill(
			'Owner-only skill',
			'# Private\nNot published.'
		);

		const viewer = await new SessionFlow(browser).startRegistered('viewer');
		await new ExportFlow(viewer.page).expectForbidden('SKILL', skill.currentId);
		await viewer.close();
	});

	test('exporting a Workflow with an Archived step reference is rejected with dangling_step_reference', async ({
		page
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		const taskName = `Soon Archived Task ${stamp}`;
		const role = await authoring.createRoleWithTasks(`Dangling Role ${stamp}`, [{ name: taskName }]);
		await role.openTask(taskName);
		const task = new TaskDetailPage(page);
		const taskUrl = task.url;

		const workflow = await authoring.createWorkflowWithSteps(`Dangling Flow ${stamp}`, [
			{ type: 'TASK', label: taskName }
		]);
		// Capture now: currentId reads the live URL, and we navigate away below.
		const workflowId = workflow.currentId;

		// Archiving does not check for existing Workflow-step references, so
		// this is how a dangling reference actually arises (US-035 AC4).
		await task.goto(taskUrl);
		await task.archive();

		await new ExportFlow(page).expectDanglingStepRejection(workflowId);
	});
});
