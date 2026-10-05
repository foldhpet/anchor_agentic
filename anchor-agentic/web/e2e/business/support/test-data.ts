// Shared constants and data builders for the e2e suite.

export const hasLiveSupabase =
	!!process.env.PUBLIC_SUPABASE_URL && !process.env.PUBLIC_SUPABASE_URL.includes('placeholder');

export const PASSWORD = 'correct-horse-battery-staple';

/** Content that satisfies the Epic J publish-time quality gates (US-042/043). */
export const PUBLISHABLE = {
	agentPrompt:
		'You are a diligent Test Analyst who plans, runs and reports on test cycles with clear results.',
	skillContent:
		'# Shelver\nShelve things carefully: list each item, check it against the catalog, and file it in the right place.',
	workflowDescription: 'Catalogs every item that enters the library.'
} as const;

export type ItemType = 'ROLE' | 'TASK' | 'AGENT' | 'SKILL' | 'WORKFLOW';

export interface UserIdentity {
	stamp: number;
	username: string;
	email: string;
	password: string;
}

/** Builds a unique, MX-valid identity (Supabase Auth rejects @example.com). */
export function newIdentity(tag: string): UserIdentity {
	const stamp = Date.now();
	return {
		stamp,
		username: `${tag}${stamp}`,
		email: `e2e-${tag}-${stamp}@mailinator.com`,
		password: PASSWORD
	};
}
