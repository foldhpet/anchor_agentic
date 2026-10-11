/** Matches the requirement / user-story IDs of this project, e.g. US-012. Override via reporter options. */
export const DEFAULT_REQUIREMENT_PATTERN = /\bUS-\d{3}\b/g;

/**
 * Finds requirement IDs in the given texts (test title path, tags).
 * A range such as "US-005–US-013" in a describe title is ignored on purpose: it names a
 * group of stories the spec relates to, not which test covers which. Tag the test instead:
 *   test('...', { tag: '@US-012' }, async () => { ... })
 */
export function extractRequirements(
	texts: string[],
	pattern: RegExp = DEFAULT_REQUIREMENT_PATTERN
): string[] {
	const id = pattern.source;
	const range = new RegExp(`(?:${id})\\s*[–—-]\\s*(?:${id})`, 'g');
	const found = new Set<string>();
	for (const text of texts) {
		for (const match of text.replace(range, ' ').matchAll(new RegExp(id, 'g'))) found.add(match[0]);
	}
	return [...found].sort();
}

export interface RequirementSummary {
	id: string;
	tests: number;
	passed: number;
	failed: number;
	flaky: number;
	/** failing beats flaky beats passing. */
	status: 'passing' | 'flaky' | 'failing';
}

export function summarizeRequirements(
	records: { status: 'passed' | 'failed' | 'flaky' | 'skipped'; requirements?: string[] }[]
): RequirementSummary[] {
	const byId = new Map<string, RequirementSummary>();
	for (const record of records) {
		if (record.status === 'skipped') continue;
		for (const id of record.requirements ?? []) {
			const entry = byId.get(id) ?? {
				id,
				tests: 0,
				passed: 0,
				failed: 0,
				flaky: 0,
				status: 'passing'
			};
			entry.tests++;
			entry[record.status]++;
			entry.status = entry.failed > 0 ? 'failing' : entry.flaky > 0 ? 'flaky' : 'passing';
			byId.set(id, entry);
		}
	}
	return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
