import { test } from '@playwright/test';
import { AuthFlow } from './business/flows/auth.flow';
import { AuthoringFlow } from './business/flows/authoring.flow';
import { PublishFlow } from './business/flows/publish.flow';
import { SandboxFlow } from './business/flows/sandbox.flow';
import { SessionFlow } from './business/flows/session.flow';
import { requireLiveSupabase } from './business/support/live-supabase';

test.describe('Sandbox & Version Control (US-014–US-019)', () => {
	requireLiveSupabase();

	test('My Library groups owned items by type, Publishing keeps an item visible, and Archiving hides it by default', async ({
		page
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);
		const sandbox = new SandboxFlow(page);

		// One of each entity type.
		const roleName = `Librarian ${stamp}`;
		const taskName = `Catalog items ${stamp}`;
		const role = await authoring.createRoleWithTasks(roleName, [{ name: taskName }]);
		await role.openTask(taskName);
		const taskUrl = page.url();

		await authoring.createAgentForRole(roleName);
		const skillName = `Shelver ${stamp}`;
		const skill = await authoring.createSkill(skillName);
		const workflowName = `Cataloging Flow ${stamp}`;
		await authoring.createWorkflow(workflowName);

		// (1) My Library shows all five, grouped by type, with Draft badges.
		await sandbox.expectLibraryGroupedWithDrafts([
			roleName,
			taskName,
			`Agent for ${roleName}`,
			skillName,
			workflowName
		]);

		// Publish the Skill (Role/Task are never independently publishable — US-023) —
		// it stays visible in My Library, just with a new badge.
		await sandbox.mine.openItem(skillName);
		await skill.expectOnDetailPage();
		await new PublishFlow(page).publishItem(skill);
		await sandbox.expectItemStatusInLibrary(skillName, 'Published');

		// (4) Archive the (still-Draft) Task — it disappears from the default view.
		await sandbox.archiveTaskAndVerifyHidden(taskUrl, taskName);
	});

	test('Version History records every save and viewing an older version does not change the current state', async ({
		page
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const role = await new AuthoringFlow(page).createRole(`Historian ${stamp}`);
		await role.waitForHydration();

		await new SandboxFlow(page).saveRevisionsAndInspectHistory(role, [
			'First revision',
			'Second revision'
		]);
	});

	test('All Library is searchable across users and never renders edit controls', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const skillName = `Findable Skill ${stamp}`;
		const skill = await new AuthoringFlow(page).createSkill(skillName, '# Findable\nBe found.');

		const viewer = await new SessionFlow(browser).startRegistered('viewer');
		await new SandboxFlow(viewer.page).expectReadOnlyAcrossUsers(viewer, skillName, skill.url);
		await viewer.close();
	});
});
