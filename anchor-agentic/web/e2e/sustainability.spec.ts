import { expect, test } from '@playwright/test';
import { MarketplacePage } from './business/pages/marketplace.page';
import { requireLiveSupabase } from './business/support/live-supabase';

const DONATION_URL = 'https://github.com/sponsors/foldhpet';

test.describe('Donation link-out (US-041)', () => {
	requireLiveSupabase();

	test('anonymous visitor sees a non-intrusive donation link on the Marketplace that opens externally', async ({
		page
	}) => {
		const marketplace = new MarketplacePage(page);
		await marketplace.open();

		await marketplace.expectDonationLinkOpensExternally(DONATION_URL);

		// No feature is gated behind it: Marketplace browsing and item listing still work normally.
		await expect(marketplace.heading).toBeVisible();
	});

	test('donation link is present without logging in and without any account', async ({ page }) => {
		const marketplace = new MarketplacePage(page);
		await marketplace.open();

		await expect(marketplace.donationLink).toBeVisible();
		await marketplace.expectLoggedOut();
	});
});
