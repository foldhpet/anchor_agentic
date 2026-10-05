import { test } from '@playwright/test';
import { AuthFlow } from './business/flows/auth.flow';
import { requireLiveSupabase } from './business/support/live-supabase';

test.describe('Authentication (US-001, US-002)', () => {
	requireLiveSupabase();

	test('register, log out, then log back in', async ({ page }) => {
		await new AuthFlow(page).registerLogOutAndLogBackIn('e2euser');
	});

	test('registering with an already-used email shows an error', async ({ page }) => {
		const auth = new AuthFlow(page);
		const user = await auth.registerNewUser('dup1');
		await auth.logOut();

		await auth.registerDuplicateEmail(user.email, user.password, 'dup2');
	});

	test('logging in with a wrong password shows a vague error', async ({ page }) => {
		await new AuthFlow(page).logInWithInvalidCredentials(
			`nonexistent-${Date.now()}@mailinator.com`,
			'whatever-wrong-password'
		);
	});
});
