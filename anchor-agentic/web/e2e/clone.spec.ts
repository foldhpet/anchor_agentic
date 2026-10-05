import { expect, test } from '@playwright/test';
import { AuthFlow } from './business/flows/auth.flow';
import { AuthoringFlow } from './business/flows/authoring.flow';
import { CloneFlow } from './business/flows/clone.flow';
import { PublishFlow } from './business/flows/publish.flow';
import { SessionFlow } from './business/flows/session.flow';
import { AgentDetailPage } from './business/pages/agent.page';
import { MySandboxPage } from './business/pages/my-sandbox.page';
import { SkillDetailPage } from './business/pages/skill.page';
import { requireLiveSupabase } from './business/support/live-supabase';

test.describe('Clone (US-020–US-022)', () => {
	requireLiveSupabase();

	test("cloning a Published Agent duplicates its Role and every assigned Task into the cloning user's own Library", async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);

		const roleName = `Test Analyst ${stamp}`;
		const taskNames = [`Plan tests ${stamp}`, `Run tests ${stamp}`, `Report results ${stamp}`];
		const { agent } = await authoring.createPublishableAgent(roleName, taskNames);
		const sourceAgentUrl = await new PublishFlow(page).publishItem(agent);

		const cloner = await new SessionFlow(browser).startRegistered('viewer');
		await cloner.page.goto(sourceAgentUrl);
		await expect(new AgentDetailPage(cloner.page).saveButton).toHaveCount(0);

		const cloned = await new CloneFlow().cloneFromSandboxUrl(
			cloner,
			sourceAgentUrl,
			(p) => new AgentDetailPage(p)
		);
		for (const taskName of taskNames) await cloned.expectTaskAssigned(taskName);

		const library = new MySandboxPage(cloner.page);
		await library.open();
		await library.expectGroups('Roles');
		await library.expectItemVisible(roleName);
		for (const taskName of taskNames) await library.expectItemVisible(taskName);
		await cloner.close();

		await new CloneFlow().expectCloneCount(agent, sourceAgentUrl, 1);
	});

	test('cloning a Published Skill creates one new owned copy and shows provenance back to the source', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');

		const skillName = `Shelver ${stamp}`;
		const skill = await new AuthoringFlow(page).createSkill(skillName);
		const sourceSkillUrl = await new PublishFlow(page).publishItem(skill);

		const cloner = await new SessionFlow(browser).startRegistered('viewer');
		const cloned = await new CloneFlow().cloneFromSandboxUrl(
			cloner,
			sourceSkillUrl,
			(p) => new SkillDetailPage(p)
		);
		await cloned.expectName(skillName);
		await cloner.close();

		await new CloneFlow().expectCloneCount(skill, sourceSkillUrl, 1);
	});
});
