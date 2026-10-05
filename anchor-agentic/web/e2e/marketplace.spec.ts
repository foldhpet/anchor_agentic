import { test } from '@playwright/test';
import { AuthFlow } from './business/flows/auth.flow';
import { AuthoringFlow } from './business/flows/authoring.flow';
import { CloneFlow } from './business/flows/clone.flow';
import { MarketplaceFlow } from './business/flows/marketplace.flow';
import { PublishFlow } from './business/flows/publish.flow';
import { SessionFlow } from './business/flows/session.flow';
import { AgentDetailPage } from './business/pages/agent.page';
import { requireLiveSupabase } from './business/support/live-supabase';
import { PUBLISHABLE } from './business/support/test-data';

test.describe('Marketplace Browse & Search (US-026–US-028)', () => {
	requireLiveSupabase();

	test('anonymous visitor browses the listing and opens a detail page with no Clone/Rate/edit controls', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const roleName = `Test Analyst ${stamp}`;
		const { agent } = await new AuthoringFlow(page).createPublishableAgent(roleName, [
			`Check items ${stamp}`
		]);
		await new PublishFlow(page).publishItem(agent);

		const anon = await new SessionFlow(browser).startAnonymous();
		const marketplace = new MarketplaceFlow(anon.page);
		await marketplace.browseAndOpenDetail(
			`Agent for ${roleName}`,
			'AGENT',
			agent.currentId,
			roleName
		);
		await marketplace.detail.expectNoOwnerControls();
		await anon.close();
	});

	test('a registered user can rate a Published item; resubmitting updates the rating instead of duplicating it; anonymous visitors see the live aggregate with no rating control', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const { agent } = await new AuthoringFlow(page).createPublishableAgent(`Rated Role ${stamp}`, [
			`Check items ${stamp}`
		]);
		await new PublishFlow(page).publishItem(agent);

		await new MarketplaceFlow(page).rateTwiceAndVerifyUpsert('AGENT', agent.currentId, 4, 2);

		// A second, anonymous visitor immediately sees the same aggregate and
		// gets no rating control at all (US-031 AC1/AC2, US-032 AC2/AC3).
		const anon = await new SessionFlow(browser).startAnonymous();
		await new MarketplaceFlow(anon.page).expectAggregateWithoutRatingControl(
			anon.page,
			'AGENT',
			agent.currentId,
			'2.0/5 (1 rating)'
		);
		await anon.close();
	});

	test('published items are searchable by name, type, and role, and a registered user can Clone from the detail page', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const authoring = new AuthoringFlow(page);
		const publish = new PublishFlow(page);

		const roleName = `Librarian ${stamp}`;
		const { agent } = await authoring.createPublishableAgent(roleName, [`Check items ${stamp}`]);
		await publish.publishItem(agent);
		const agentId = agent.currentId;

		const workflowName = `Cataloging Flow ${stamp}`;
		const workflow = await authoring.createWorkflowWithSteps(
			workflowName,
			[{ type: 'AGENT', label: `Agent for ${roleName}` }],
			PUBLISHABLE.workflowDescription
		);
		await workflow.expectStepLabel('AGENT', `Agent for ${roleName}`);
		await publish.publishItem(workflow);

		const marketplace = new MarketplaceFlow(page);
		const agentListing = `Agent for ${roleName}`;
		await marketplace.expectFound({ q: roleName }, agentListing);
		await marketplace.expectFound({ type: 'WORKFLOW' }, workflowName);
		await marketplace.expectFilteredOut({ type: 'WORKFLOW' }, agentListing);
		await marketplace.expectFound({ role: roleName }, agentListing);

		// A second registered user clones the Agent from its Marketplace detail page.
		const cloner = await new SessionFlow(browser).startRegistered('viewer');
		await new CloneFlow().cloneFromMarketplace(cloner, 'AGENT', agentId, 'agents');
		const cloned = new AgentDetailPage(cloner.page);
		await cloned.expectStatus('Draft');
		await cloned.expectClonedFrom();
		await cloner.close();
	});

	test("a Draft item's Marketplace detail URL 404s for both anonymous and non-owner registered visitors", async ({
		page,
		browser
	}) => {
		await new AuthFlow(page).signInAs('owner');
		const draft = await new AuthoringFlow(page).createSkill(
			'Never Published',
			'# Draft\nStays a draft.'
		);
		const draftId = draft.currentId;

		const sessions = new SessionFlow(browser);
		const anon = await sessions.startAnonymous();
		await new MarketplaceFlow(anon.page).expectDraftNotFound(anon.page, 'SKILL', draftId);
		await anon.close();

		const viewer = await sessions.startRegistered('viewer');
		await new MarketplaceFlow(viewer.page).expectDraftNotFound(viewer.page, 'SKILL', draftId);
		await viewer.close();
	});
});
