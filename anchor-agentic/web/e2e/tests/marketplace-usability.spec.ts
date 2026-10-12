import { randomUUID } from 'node:crypto';
import { test } from '@playwright/test';
import { AuthFlow } from '../business/flows/auth.flow';
import { CloneFlow } from '../business/flows/clone.flow';
import { MarketplaceFlow } from '../business/flows/marketplace.flow';
import { PageTitleFlow } from '../business/flows/page-title.flow';
import { PublishFlow } from '../business/flows/publish.flow';
import { SessionFlow } from '../business/flows/session.flow';
import { SkillDetailPage } from '../business/pages/skill.page';
import { requireLiveSupabase } from '../business/support/live-supabase';

test.describe('Marketplace journey usability (US-055)', () => {
	requireLiveSupabase();

	// ---------- Part A: page titles and the friendly error page ----------

	test(
		'every representative page is titled "<h1> - AnchorAgentic", with search and page in the Marketplace title',
		{ tag: '@US-055' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Titled Skill ${stamp}`);

			const visitor = await new SessionFlow(browser).startAnonymous();
			await new PageTitleFlow().expectUniqueTitles(visitor.page, page, {
				type: 'SKILL',
				id: skill.id
			});
			await visitor.close();
		}
	);

	test(
		'an unknown route and a missing item show the friendly error page instead of the default screen',
		{ tag: '@US-055' },
		async ({ browser }) => {
			const visitor = await new SessionFlow(browser).startAnonymous();
			await new PageTitleFlow().expectFriendly404s(visitor.page, {
				type: 'SKILL',
				id: randomUUID()
			});
			await visitor.close();
		}
	);

	// ---------- Part B: the Marketplace item page ----------

	test(
		'an anonymous visitor gets a log-in notice instead of Rate/Clone, Report is collapsed below the content, and Back returns to the list they came from',
		{ tag: '@US-055' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Guided Skill ${stamp}`);

			const visitor = await new SessionFlow(browser).startAnonymous();
			const marketplace = new MarketplaceFlow(visitor.page);

			await marketplace.expectBackLinkReturnsToFilteredList(skill.name, 'SKILL', skill.id, {
				q: skill.name,
				type: 'SKILL'
			});
			await marketplace.expectBackLinkKeepsAllListParameters('SKILL', skill.id, {
				q: skill.name,
				type: 'SKILL',
				role: 'Some Role',
				page: 2
			});
			await marketplace.expectBackLinkGoesHomeOnDirectArrival('SKILL', skill.id);

			await marketplace.expectAnonymousItemPage('SKILL', skill.id, 'Skill Files');
			await visitor.close();
		}
	);

	// ---------- Part C: list, rating and clone feedback ----------

	test(
		'a search with special characters round-trips; the count line, plain type labels, no-match message and Clear filters work',
		{ tag: '@US-055' },
		async ({ page }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Fish & Chips + Peas #${stamp}`);
			await new MarketplaceFlow(page).searchAndClearFilters(skill.name, `no-such-item-${stamp}`);
		}
	);

	test(
		'a registered user sees Rate and Clone instead of the notice, rates with a placeholder and confirmation, and sees a one-time clone confirmation',
		{ tag: '@US-055' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Feedback Skill ${stamp}`);

			const viewer = await new SessionFlow(browser).startRegistered('viewer');
			const marketplace = new MarketplaceFlow(viewer.page);
			await marketplace.expectRegisteredItemControls('SKILL', skill.id);
			await marketplace.rateAndExpectFeedback('SKILL', skill.id, 4);

			await new CloneFlow().cloneAndExpectConfirmationOnce(
				viewer,
				'SKILL',
				skill.id,
				'skills',
				(p) => new SkillDetailPage(p)
			);
			await viewer.close();
		}
	);

	// DEFECT (implementation, not the test): web/src/routes/marketplace/[itemType]/[id]/+page.server.ts
	// calls the detail endpoint without the user's access token, so the API (which reads the rater's
	// own score only from an Authorization header) always answers myRating: null and the select shows
	// "Choose a rating…" even after rating. Remove test.fixme once the load passes the token.
	test.fixme(
		'US-055 AC: a user who already rated sees their score preselected and no placeholder',
		{ tag: '@US-055' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Preselect Skill ${stamp}`);

			const viewer = await new SessionFlow(browser).startRegistered('viewer');
			const marketplace = new MarketplaceFlow(viewer.page);
			await marketplace.rateAndExpectFeedback('SKILL', skill.id, 4);
			await marketplace.expectOwnRatingPreselected('SKILL', skill.id, 4);
			await viewer.close();
		}
	);

	test(
		'two rapid clicks on Clone create exactly one copy in My Sandbox',
		{ tag: '@US-055' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Double Click Skill ${stamp}`);

			const viewer = await new SessionFlow(browser).startRegistered('viewer');
			await new CloneFlow().doubleClickCreatesOneCopy(
				viewer,
				'SKILL',
				skill.id,
				'skills',
				(p) => new SkillDetailPage(p),
				skill.name
			);
			await viewer.close();
		}
	);
});
