import { test } from '@playwright/test';
import { AuthFlow } from '../business/flows/auth.flow';
import { PublishFlow } from '../business/flows/publish.flow';
import { SessionFlow } from '../business/flows/session.flow';
import { MarketplaceDetailPage } from '../business/pages/marketplace-detail.page';
import { SkillDetailPage } from '../business/pages/skill.page';

// Clickable controls show the hand cursor: Tailwind v4 stopped setting it on buttons, so layout.css does.
test.describe('Control cursor', () => {
	test('the Clone and Export to .claude buttons show the pointer cursor', async ({
		page,
		browser
	}) => {
		const { stamp } = await new AuthFlow(page).signInAs('owner');
		const skill = await new PublishFlow(page).publishNewSkill(`Cursor Skill ${stamp}`);

		const owned = new SkillDetailPage(page);
		await owned.open(skill.id);
		await owned.expectPointerCursor(owned.exportButton);

		const viewer = await new SessionFlow(browser).startRegistered('viewer');
		const listing = new MarketplaceDetailPage(viewer.page);
		await listing.open('SKILL', skill.id);
		await listing.expectPointerCursor(listing.cloneButton);
		await viewer.close();
	});
});
