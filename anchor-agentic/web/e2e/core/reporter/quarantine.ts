import { existsSync, readFileSync } from 'node:fs';
import { writeJson } from './history.ts';
import type { RunSummary } from './summary.ts';

/**
 * Quarantine: a test that keeps flaking can be moved out of the way of the build, but ONLY by a
 * human decision. The reporter detects candidates and asks; it never quarantines on its own.
 * Decisions live in a small committed JSON file so the whole team shares them.
 *
 * - `quarantined`   the test still runs and is still reported, but its failures do not fail the run.
 * - `keep-blocking` a human looked and wants it to keep blocking; it is not proposed again.
 * Delete an entry to release a test or to be asked about it again.
 */
export type DecisionKind = 'quarantined' | 'keep-blocking';

export interface Decision {
	key: string;
	title: string;
	decision: DecisionKind;
	decidedAt: string;
	reason?: string;
}

interface QuarantineFile {
	version: 1;
	decisions: Decision[];
}

export function loadDecisions(file: string): Decision[] {
	if (!existsSync(file)) return [];
	try {
		const parsed = JSON.parse(readFileSync(file, 'utf-8')) as QuarantineFile;
		return parsed.version === 1 && Array.isArray(parsed.decisions) ? parsed.decisions : [];
	} catch {
		return [];
	}
}

export function saveDecisions(file: string, decisions: Decision[]) {
	writeJson(file, { version: 1, decisions } satisfies QuarantineFile);
}

export function quarantinedKeys(decisions: Decision[]): Set<string> {
	return new Set(decisions.filter((d) => d.decision === 'quarantined').map((d) => d.key));
}

export interface Candidate {
	key: string;
	title: string;
	flakyRuns: number;
	/** How many of the test's most recent executions were looked at. */
	window: number;
}

export interface CandidateRules {
	/** Look at this many of a test's most recent executions. */
	window: number;
	/** Propose quarantine when it was flaky at least this often within the window. */
	minFlaky: number;
}

export const DEFAULT_RULES: CandidateRules = { window: 10, minFlaky: 3 };

/** Tests that flake often enough to ask about, excluding ones a human already decided on. */
export function findCandidates(
	runs: RunSummary[],
	decisions: Decision[],
	rules: CandidateRules = DEFAULT_RULES
): Candidate[] {
	const decided = new Set(decisions.map((d) => d.key));
	const executions = new Map<string, { title: string; flaky: boolean[] }>();

	for (const run of runs) {
		for (const test of run.tests ?? []) {
			if (test.status === 'skipped') continue;
			const entry = executions.get(test.key) ?? { title: test.title, flaky: [] };
			entry.title = test.title;
			entry.flaky.push(test.status === 'flaky');
			executions.set(test.key, entry);
		}
	}

	const candidates: Candidate[] = [];
	for (const [key, { title, flaky }] of executions) {
		if (decided.has(key)) continue;
		const recent = flaky.slice(-rules.window);
		const flakyRuns = recent.filter(Boolean).length;
		if (flakyRuns >= rules.minFlaky)
			candidates.push({ key, title, flakyRuns, window: recent.length });
	}
	return candidates.sort((a, b) => b.flakyRuns - a.flakyRuns || a.title.localeCompare(b.title));
}

export function recordDecision(
	decisions: Decision[],
	candidate: Pick<Candidate, 'key' | 'title'>,
	decision: DecisionKind,
	now: Date = new Date(),
	reason?: string
): Decision[] {
	const rest = decisions.filter((d) => d.key !== candidate.key);
	return [
		...rest,
		{ key: candidate.key, title: candidate.title, decision, decidedAt: now.toISOString(), reason }
	];
}

/** Removes a decision, releasing the test (or making it eligible to be proposed again). */
export function releaseDecision(decisions: Decision[], key: string): Decision[] {
	return decisions.filter((d) => d.key !== key);
}

/** Applies the answers of a prompt: records quarantine / keep-blocking, leaves "later" undecided. */
export function applyAnswers(
	decisions: Decision[],
	candidates: Candidate[],
	answers: Map<string, 'quarantined' | 'keep-blocking' | 'later'>,
	now: Date = new Date()
): Decision[] {
	let updated = decisions;
	for (const candidate of candidates) {
		const answer = answers.get(candidate.key);
		if (answer && answer !== 'later') updated = recordDecision(updated, candidate, answer, now);
	}
	return updated;
}
