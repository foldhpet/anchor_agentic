import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium, type FullConfig } from '@playwright/test';
import { AuthFlow } from './business/flows/auth.flow';
import {
	AUTH_DIR,
	PERSONAS,
	PERSONAS_FILE,
	createConfirmedUser,
	storageStatePath,
	trackCreatedEmail,
	type PersonaRecord
} from './business/support/personas';
import { hasLiveSupabase, newIdentity } from './business/support/test-data';

/**
 * Creates the shared personas once per run. With SUPABASE_SERVICE_ROLE_KEY they are created
 * through the admin API (no signup rate limit) and logged in; without it they fall back to
 * UI registration (still only one signup per persona).
 */
export default async function globalSetup(config: FullConfig) {
	rmSync(AUTH_DIR, { recursive: true, force: true });
	mkdirSync(AUTH_DIR, { recursive: true });
	if (!hasLiveSupabase) return;

	const baseURL = config.projects[0].use.baseURL;
	const browser = await chromium.launch();
	const records: Record<string, PersonaRecord> = {};
	try {
		for (const persona of PERSONAS) {
			const context = await browser.newContext({ baseURL });
			const page = await context.newPage();
			const auth = new AuthFlow(page);

			let identity;
			const preset = newIdentity(persona);
			if (await createConfirmedUser(preset)) {
				trackCreatedEmail(preset.email);
				await auth.logIn(preset.email, preset.password);
				identity = preset;
			} else {
				identity = await auth.registerNewUser(persona);
			}

			await context.storageState({ path: storageStatePath(persona) });
			records[persona] = { ...identity, persona };
			await context.close();
		}
	} finally {
		await browser.close();
	}
	writeFileSync(PERSONAS_FILE, JSON.stringify(records, null, 2));
}
