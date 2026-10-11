import { classifyFailure, type Annotation, type FailureCategory } from './classify.ts';
import { summarizeRequirements, type RequirementSummary } from './requirements.ts';
import type { ServerErrorReport } from './server-log.ts';

/** Framework-neutral result of one test, after retries. The Playwright adapter builds these. */
export interface TestRecord {
	/** Stable identity across runs: spec file plus the full title path. */
	key: string;
	title: string;
	/** Suite the test belongs to; the spec file name. */
	suite: string;
	/** `flaky` = failed at least once but passed on a retry. */
	status: 'passed' | 'failed' | 'flaky' | 'skipped';
	durationMs: number;
	/** Error text of the failure (also set for flaky tests). */
	error?: string;
	annotations?: Annotation[];
	/** Requirement / user-story IDs this test covers. */
	requirements?: string[];
	/** Saved screenshots, traces and snapshots of failed attempts, relative to the reports dir. */
	artifacts?: string[];
}

export interface SuiteSummary {
	name: string;
	total: number;
	passed: number;
	failed: number;
	flaky: number;
	skipped: number;
	durationMs: number;
}

/** One test in one run; the history keeps these to compute per-test trends. */
export interface TestEntry {
	key: string;
	title: string;
	suite: string;
	status: TestRecord['status'];
	durationMs: number;
	requirements: string[];
}

export interface FailedTest {
	key: string;
	title: string;
	category: FailureCategory;
	artifacts: string[];
	/** A human decided this test must not block the run; it is still reported. */
	quarantined: boolean;
}

export interface RunSummary {
	id: string;
	startedAt: string;
	/** Wall-clock time of the whole run. */
	durationMs: number;
	total: number;
	passed: number;
	failed: number;
	flaky: number;
	skipped: number;
	/** Failed tests that are not quarantined, i.e. the ones that fail the build. */
	blockingFailed: number;
	/** (passed + flaky) / executed, 0..1. Skipped tests are not executed. */
	passRate: number;
	timing: {
		minMs: number;
		maxMs: number;
		avgMs: number;
		fastest: string;
		slowest: string;
	};
	failuresByCategory: Record<FailureCategory, number>;
	suites: SuiteSummary[];
	tests: TestEntry[];
	flakyTests: string[];
	failedTests: FailedTest[];
	requirements: RequirementSummary[];
	serverErrors: ServerErrorReport;
}

export function summarizeRun(
	records: TestRecord[],
	meta: { id: string; startedAt: string; durationMs: number },
	extras: { serverErrors?: ServerErrorReport; quarantinedKeys?: ReadonlySet<string> } = {}
): RunSummary {
	const count = (status: TestRecord['status']) => records.filter((r) => r.status === status).length;
	const passed = count('passed');
	const failed = count('failed');
	const flaky = count('flaky');
	const skipped = count('skipped');
	const executed = passed + failed + flaky;

	const timed = records.filter((r) => r.status !== 'skipped');
	const byDuration = [...timed].sort((a, b) => a.durationMs - b.durationMs);
	const fastest = byDuration[0];
	const slowest = byDuration[byDuration.length - 1];
	const totalMs = timed.reduce((sum, r) => sum + r.durationMs, 0);

	const failuresByCategory: Record<FailureCategory, number> = {
		'product-bug': 0,
		'test-automation-bug': 0,
		'server-error': 0
	};
	const failedTests: FailedTest[] = records
		.filter((r) => r.status === 'failed')
		.map((r) => ({
			key: r.key,
			title: r.title,
			category: classifyFailure(r.error ?? '', r.annotations),
			artifacts: r.artifacts ?? [],
			quarantined: extras.quarantinedKeys?.has(r.key) ?? false
		}));
	for (const f of failedTests) failuresByCategory[f.category]++;

	const suites = new Map<string, SuiteSummary>();
	for (const r of records) {
		const suite = suites.get(r.suite) ?? {
			name: r.suite,
			total: 0,
			passed: 0,
			failed: 0,
			flaky: 0,
			skipped: 0,
			durationMs: 0
		};
		suite.total++;
		suite[r.status]++;
		suite.durationMs += r.durationMs;
		suites.set(r.suite, suite);
	}

	return {
		...meta,
		total: records.length,
		passed,
		failed,
		flaky,
		skipped,
		blockingFailed: failedTests.filter((f) => !f.quarantined).length,
		passRate: executed === 0 ? 0 : (passed + flaky) / executed,
		timing: {
			minMs: fastest?.durationMs ?? 0,
			maxMs: slowest?.durationMs ?? 0,
			avgMs: timed.length === 0 ? 0 : Math.round(totalMs / timed.length),
			fastest: fastest?.title ?? '',
			slowest: slowest?.title ?? ''
		},
		failuresByCategory,
		suites: [...suites.values()],
		tests: records.map((r) => ({
			key: r.key,
			title: r.title,
			suite: r.suite,
			status: r.status,
			durationMs: r.durationMs,
			requirements: r.requirements ?? []
		})),
		flakyTests: records.filter((r) => r.status === 'flaky').map((r) => r.title),
		failedTests,
		requirements: summarizeRequirements(records),
		serverErrors: extras.serverErrors ?? { count: 0, samples: [] }
	};
}
