import { expect, test } from '@playwright/test';
import { SandboxFlow } from './business/flows/sandbox.flow';
import { SessionFlow } from './business/flows/session.flow';
import { LoginPage } from './business/pages/login.page';
import { MarketplacePage } from './business/pages/marketplace.page';
import { hasLiveSupabase } from './business/support/test-data';
import { requireLiveSupabase } from './business/support/live-supabase';

test.describe('Anonymous browsing (US-003)', () => {
	// The Marketplace list is server-rendered via a call to the api/ Worker,
	// which needs real Supabase credentials to answer — the Sandbox redirect
	// guard below runs in hooks.server.ts before any API call, so it doesn't.
	test('anonymous visitors can view the Marketplace without logging in', async ({ page }) => {
		test.skip(!hasLiveSupabase, 'Marketplace SSR calls the api/ Worker — see web/.env');
		const marketplace = new MarketplacePage(page);
		await marketplace.open();
		await expect(marketplace.heading).toBeVisible();
		await marketplace.expectLoggedOut();
	});

	test('anonymous direct navigation to /sandbox redirects to login with a reason banner', async ({
		page
	}) => {
		await page.goto('/sandbox');
		await expect(page).toHaveURL(/\/login\?reason=sandbox/);
		await new LoginPage(page).expectSandboxReasonBanner();
	});

	test('anonymous direct navigation to /sandbox/all redirects to login', async ({ page }) => {
		await page.goto('/sandbox/all');
		await expect(page).toHaveURL(/\/login\?reason=sandbox/);
	});
});

test.describe('Permission boundary enforcement (US-004)', () => {
	requireLiveSupabase();

	test("a registered user cannot edit another user's sandbox item", async ({ browser }) => {
		const sessions = new SessionFlow(browser);
		const owner = await sessions.startRegistered('owner');
		const viewer = await sessions.startRegistered('viewer');

		await new SandboxFlow(owner.page).nonOwnerCannotEdit(
			owner,
			viewer,
			`Owned by A ${owner.identity!.stamp}`
		);

		await owner.close();
		await viewer.close();
	});
});
