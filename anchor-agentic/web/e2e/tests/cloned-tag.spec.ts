import { test } from '@playwright/test';
import { AuthFlow } from '../business/flows/auth.flow';
import { CloneFlow } from '../business/flows/clone.flow';
import { PublishFlow } from '../business/flows/publish.flow';
import { SessionFlow } from '../business/flows/session.flow';

test.describe('Cloned tag (US-056)', () => {
	test(
		'a cloned item is tagged in My Sandbox and All Sandbox; the original is not',
		{ tag: '@US-056' },
		async ({ page, browser }) => {
			const { stamp } = await new AuthFlow(page).signInAs('owner');
			const skill = await new PublishFlow(page).publishNewSkill(`Tag Skill ${stamp}`);

			const cloner = await new SessionFlow(browser).startRegistered('viewer');
			const clone = new CloneFlow();
			await clone.cloneFromMarketplace(cloner, 'SKILL', skill.id, 'skills');
			await clone.expectClonedTagOnlyOnTheCopy(page, cloner.page, skill.name);
			await cloner.close();
		}
	);
});
