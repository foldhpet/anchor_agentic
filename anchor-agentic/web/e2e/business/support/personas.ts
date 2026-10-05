import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { log } from './log';
import { PASSWORD, type UserIdentity } from './test-data';

const FLOW = 'Personas';

/** Shared, long-lived users for the run. Each is registered/created once and reused via storageState. */
export const PERSONAS = ['owner', 'viewer'] as const;
export type Persona = (typeof PERSONAS)[number];

export const AUTH_DIR = join(process.cwd(), 'e2e', '.auth');
export const PERSONAS_FILE = join(AUTH_DIR, 'personas.json');
export const CREATED_EMAILS_FILE = join(AUTH_DIR, 'created-emails.log');
export const storageStatePath = (persona: Persona) => join(AUTH_DIR, `${persona}.json`);

export interface PersonaRecord extends UserIdentity {
	persona: Persona;
}

export function readPersonas(): Record<Persona, PersonaRecord> {
	if (!existsSync(PERSONAS_FILE)) {
		throw new Error('Persona state missing — Playwright globalSetup did not run.');
	}
	return JSON.parse(readFileSync(PERSONAS_FILE, 'utf-8'));
}

/** Remember an e2e user (any worker) so globalTeardown can delete it. */
export function trackCreatedEmail(email: string) {
	mkdirSync(AUTH_DIR, { recursive: true });
	appendFileSync(CREATED_EMAILS_FILE, `${email}\n`);
}

/**
 * Service-role client for creating/deleting test users. The signup rate limit applies to
 * public sign-ups only; admin calls bypass it. Returns null when no key is configured.
 */
export function adminClient() {
	const url = process.env.PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) return null;
	return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createConfirmedUser(identity: UserIdentity): Promise<boolean> {
	const admin = adminClient();
	if (!admin) return false;
	const { error } = await admin.auth.admin.createUser({
		email: identity.email,
		password: PASSWORD,
		email_confirm: true,
		user_metadata: { username: identity.username }
	});
	if (error) throw new Error(`Admin createUser failed for ${identity.email}: ${error.message}`);
	return true;
}

/** Deletes every user whose email was tracked during this run (profiles cascade). */
export async function deleteTrackedUsers() {
	const admin = adminClient();
	if (!admin) {
		log.warn(FLOW, 'SUPABASE_SERVICE_ROLE_KEY not set — skipping cleanup of e2e users');
		return;
	}
	if (!existsSync(CREATED_EMAILS_FILE)) return;
	const emails = new Set(
		readFileSync(CREATED_EMAILS_FILE, 'utf-8').split('\n').map((e) => e.trim()).filter(Boolean)
	);
	let deleted = 0;
	for (let page = 1; emails.size > 0; page++) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
		if (error) throw new Error(`Admin listUsers failed: ${error.message}`);
		for (const user of data.users) {
			if (user.email && emails.delete(user.email)) {
				const { error: delError } = await admin.auth.admin.deleteUser(user.id);
				if (delError) log.warn(FLOW, `Could not delete ${user.email}: ${delError.message}`);
				else deleted++;
			}
		}
		if (data.users.length < 200) break;
	}
	log.ok(FLOW, `Deleted ${deleted} e2e user(s)`);
}
