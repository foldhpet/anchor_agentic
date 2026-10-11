import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunSummary } from './summary.ts';

/** How many past runs are kept; older ones are dropped. */
export const HISTORY_LIMIT = 100;

interface HistoryFile {
	version: 1;
	runs: RunSummary[];
}

export function loadHistory(dir: string): RunSummary[] {
	const file = join(dir, 'history.json');
	if (!existsSync(file)) return [];
	try {
		const parsed = JSON.parse(readFileSync(file, 'utf-8')) as HistoryFile;
		return parsed.version === 1 && Array.isArray(parsed.runs) ? parsed.runs : [];
	} catch {
		// A corrupt history file must never break a test run; start over.
		return [];
	}
}

/** Adds `run` to the end and keeps only the newest `limit` runs. Pure; does not touch disk. */
export function appendRun(
	runs: RunSummary[],
	run: RunSummary,
	limit = HISTORY_LIMIT
): RunSummary[] {
	return [...runs, run].slice(-limit);
}

/** Writes `name` as JSON (write-then-rename, so a crash cannot leave half a file). */
export function writeJson(file: string, data: unknown) {
	mkdirSync(join(file, '..'), { recursive: true });
	const temp = `${file}.tmp`;
	writeFileSync(temp, JSON.stringify(data, null, '\t'));
	renameSync(temp, file);
}

export function saveReports(dir: string, run: RunSummary, runs: RunSummary[]) {
	writeJson(join(dir, 'latest.json'), run);
	writeJson(join(dir, 'history.json'), { version: 1, runs } satisfies HistoryFile);
}

export interface HistoryStats {
	runs: number;
	avgPassRate: number;
	avgDurationMs: number;
	/** Tests that were flaky most often across the history, most frequent first. */
	mostFlaky: { title: string; runs: number }[];
}

export function historyStats(runs: RunSummary[], topFlaky = 3): HistoryStats {
	const flakyCounts = new Map<string, number>();
	for (const run of runs) {
		for (const title of run.flakyTests) flakyCounts.set(title, (flakyCounts.get(title) ?? 0) + 1);
	}
	const avg = (pick: (r: RunSummary) => number) =>
		runs.length === 0 ? 0 : runs.reduce((sum, r) => sum + pick(r), 0) / runs.length;

	return {
		runs: runs.length,
		avgPassRate: avg((r) => r.passRate),
		avgDurationMs: Math.round(avg((r) => r.durationMs)),
		mostFlaky: [...flakyCounts.entries()]
			.map(([title, count]) => ({ title, runs: count }))
			.sort((a, b) => b.runs - a.runs)
			.slice(0, topFlaky)
	};
}

export interface TestStats {
	key: string;
	title: string;
	suite: string;
	/** Runs the test was executed in (skipped runs are not counted). */
	runs: number;
	passed: number;
	failed: number;
	flaky: number;
	flakeRate: number;
	avgMs: number;
	lastMs: number;
	/** lastMs divided by the average of the earlier runs; 0 until there are 3 earlier runs. */
	slowdown: number;
}

const MIN_RUNS_FOR_SLOWDOWN = 3;

/** Per-test trends over the history, from the `tests` list every run stores. */
export function testStats(runs: RunSummary[]): TestStats[] {
	const byKey = new Map<string, { entry: RunSummary['tests'][number]; durations: number[] }>();
	const stats = new Map<string, TestStats>();

	for (const run of runs) {
		for (const entry of run.tests ?? []) {
			if (entry.status === 'skipped') continue;
			const s = stats.get(entry.key) ?? {
				key: entry.key,
				title: entry.title,
				suite: entry.suite,
				runs: 0,
				passed: 0,
				failed: 0,
				flaky: 0,
				flakeRate: 0,
				avgMs: 0,
				lastMs: 0,
				slowdown: 0
			};
			const tracked = byKey.get(entry.key) ?? { entry, durations: [] };
			tracked.entry = entry;
			tracked.durations.push(entry.durationMs);
			byKey.set(entry.key, tracked);

			s.title = entry.title;
			s.runs++;
			s[entry.status]++;
			stats.set(entry.key, s);
		}
	}

	for (const [key, s] of stats) {
		const { durations } = byKey.get(key)!;
		const earlier = durations.slice(0, -1);
		s.flakeRate = s.runs === 0 ? 0 : s.flaky / s.runs;
		s.avgMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
		s.lastMs = durations[durations.length - 1];
		if (earlier.length >= MIN_RUNS_FOR_SLOWDOWN) {
			const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
			s.slowdown = earlierAvg === 0 ? 0 : s.lastMs / earlierAvg;
		}
	}
	return [...stats.values()];
}
