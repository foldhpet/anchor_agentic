import { test } from '@playwright/test';
import { AuthFlow } from '../business/flows/auth.flow';
import { PublishFlow } from '../business/flows/publish.flow';
import { ReturnToFlow } from '../business/flows/return-to.flow';
import { SessionFlow } from '../business/flows/session.flow';
import { requireLiveSupabase } from '../business/support/live-supabase';

test.describe('Return to the page I was on after logging in or registering (US-057)', () => {
	requireLiveSupabase();

	test(
		'item page -> notice Log in -> back on that item page, and nothing was cloned',
		{ tag: '@US-057' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Return Login Skill ${stamp}`);

			const visitor = await new SessionFlow(browser).startAnonymous();
			await new ReturnToFlow(visitor.page).logInFromItemNoticeAndLandBack(
				'SKILL',
				skill.id,
				skill.name,
				'viewer'
			);
			await visitor.close();
		}
	);

	test(
		'item page -> notice Register -> a new account lands back on that item page',
		{ tag: '@US-057' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Return Register Skill ${stamp}`);

			const visitor = await new SessionFlow(browser).startAnonymous();
			await new ReturnToFlow(visitor.page).registerFromItemNoticeAndLandBack(
				'SKILL',
				skill.id,
				'e2ereturn'
			);
			await visitor.close();
		}
	);

	test(
		'a filtered Marketplace list -> nav Log in -> the same list with every parameter kept',
		{ tag: '@US-057' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Return & List #${stamp}`);

			const visitor = await new SessionFlow(browser).startAnonymous();
			await new ReturnToFlow(visitor.page).logInFromFilteredListAndLandBack(
				{ q: skill.name, type: 'SKILL', page: 1 },
				skill.name,
				'viewer'
			);
			await visitor.close();
		}
	);

	test(
		'a guarded URL sends an anonymous visitor to Log in with a reason banner and back to it afterwards',
		{ tag: '@US-057' },
		async ({ browser }) => {
			const visitor = await new SessionFlow(browser).startAnonymous();
			await new ReturnToFlow(visitor.page).logInAfterGuardRedirectAndLandBack(
				'/library?x=1',
				'viewer'
			);
			await visitor.close();
		}
	);

	test(
		'a failed login keeps the return target, and the next attempt lands on it',
		{ tag: '@US-057' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Return Retry Skill ${stamp}`);

			const visitor = await new SessionFlow(browser).startAnonymous();
			await new ReturnToFlow(visitor.page).failedLogInKeepsTarget(
				`/marketplace/SKILL/${skill.id}`,
				'viewer'
			);
			await visitor.close();
		}
	);

	test(
		'the Log in and Register forms link to each other with the same target, and the nav adds none',
		{ tag: '@US-057' },
		async ({ browser }) => {
			const visitor = await new SessionFlow(browser).startAnonymous();
			await new ReturnToFlow(visitor.page).switchingFormsKeepsTarget(
				'/marketplace/AGENT/0a1b2c?x=1'
			);
			await visitor.close();
		}
	);

	test(
		'a signed-in user opening Log in or Register is sent to a valid target, and to "/" for every rejected one',
		{ tag: '@US-057' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Return Matrix Skill ${stamp}`);

			const member = await new SessionFlow(browser).startRegistered('viewer');
			await new ReturnToFlow(member.page).expectLoggedInRedirectsFollowTheValidator(
				`/marketplace/SKILL/${skill.id}`
			);
			await member.close();
		}
	);
});
