import { test } from '@playwright/test';
import { LoginPage } from '../business/pages/login.page';
import { MarketplacePage } from '../business/pages/marketplace.page';

// WCAG 2.4.1 Bypass Blocks (US-050): the repeated header nav can be skipped from the keyboard.
test.describe('Skip to content (US-050)', () => {
	test(
		'the first Tab stop skips the navigation and lands on the main content',
		{ tag: '@US-050' },
		async ({ page }) => {
			const marketplace = new MarketplacePage(page);
			await marketplace.open();
			await marketplace.expectSkipLinkBypassesNav();
		}
	);

	test(
		'the skip link is on a page outside the Marketplace too',
		{ tag: '@US-050' },
		async ({ page }) => {
			const login = new LoginPage(page);
			await login.open();
			await login.expectSkipLinkBypassesNav();
		}
	);
});
