import { test } from '@playwright/test';
import { AuthFlow } from '../business/flows/auth.flow';
import { PublishFlow } from '../business/flows/publish.flow';
import { ReturnToFlow } from '../business/flows/return-to.flow';
import { SessionFlow } from '../business/flows/session.flow';
import { SortFlow } from '../business/flows/sort.flow';
import { requireLiveSupabase } from '../business/support/live-supabase';

// Row order itself is proven at API level (api/test/integration/marketplace.test.ts); the live
// Marketplace accumulates items across runs, so these specs assert the control, not the ranking.
test.describe('Sort the Marketplace list (US-058)', () => {
	requireLiveSupabase();

	test(
		'the default is Most cloned with no sort in the URL; Highest rated and Newest are applied, shown and reflected in the URL',
		{ tag: '@US-058' },
		async ({ browser }) => {
			const visitor = await new SessionFlow(browser).startAnonymous();
			const sort = new SortFlow(visitor.page);
			await sort.expectDefaultOrder();
			await sort.chooseEachOrder();
			await visitor.close();
		}
	);

	test(
		'an unknown sort value falls back to Most cloned without an error',
		{ tag: '@US-058' },
		async ({ browser }) => {
			const visitor = await new SessionFlow(browser).startAnonymous();
			await new SortFlow(visitor.page).expectInvalidSortFallsBack('bogus');
			await visitor.close();
		}
	);

	test(
		'a new search keeps the sort and resets to page 1, and Clear filters keeps the sort',
		{ tag: '@US-058' },
		async ({ browser }) => {
			const visitor = await new SessionFlow(browser).startAnonymous();
			const sort = new SortFlow(visitor.page);
			await sort.expectSortSurvivesFiltering('rating', `sort-filter-${Date.now()}`);
			await sort.expectClearFiltersKeepsSort('rating', `no-such-item-${Date.now()}`);
			await visitor.close();
		}
	);

	test('pagination links keep the chosen sort', { tag: '@US-058' }, async ({ browser }) => {
		const visitor = await new SessionFlow(browser).startAnonymous();
		const checked = await new SortFlow(visitor.page).expectPagerKeepsSort('newest');
		test.info().annotations.push({
			type: 'note',
			description: checked
				? 'pager links checked'
				: 'only one page of live data; pager links not checked'
		});
		await visitor.close();
	});

	test(
		'the sort can be applied with the keyboard alone: focus the select, ArrowDown, Tab to Sort, Enter',
		{ tag: '@US-058' },
		async ({ browser }) => {
			const visitor = await new SessionFlow(browser).startAnonymous();
			await new SortFlow(visitor.page).sortWithKeyboardOnly();
			await visitor.close();
		}
	);

	test(
		'a sorted, filtered list -> nav Log in -> the same URL with the sort still chosen',
		{ tag: '@US-058' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Sort Return Skill ${stamp}`);

			const visitor = await new SessionFlow(browser).startAnonymous();
			await new ReturnToFlow(visitor.page).logInFromSortedListAndLandBack(
				{ sort: 'rating', q: skill.name },
				skill.name,
				'viewer',
				'Highest rated'
			);
			await visitor.close();
		}
	);
});
