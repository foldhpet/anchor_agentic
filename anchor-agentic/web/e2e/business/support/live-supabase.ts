import { test } from '@playwright/test';
import { hasLiveSupabase } from './test-data';

/** Call inside a describe block: skips every test unless a real Supabase project is linked. */
export function requireLiveSupabase() {
	test.beforeEach(() => {
		test.skip(!hasLiveSupabase, 'requires a linked Supabase project — see web/.env');
	});
}
