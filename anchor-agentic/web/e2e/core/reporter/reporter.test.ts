import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyFailure } from './classify.ts';
import { formatReport } from './format.ts';
import { appendRun, historyStats, HISTORY_LIMIT, loadHistory, saveReports } from './history.ts';
import { summarizeRun, type RunSummary, type TestRecord } from './summary.ts';

const record = (over: Partial<TestRecord> = {}): TestRecord => ({
	key: `a.spec.ts › ${over.title ?? 'a test'}`,
	title: 'a test',
	suite: 'a.spec.ts',
	status: 'passed',
	durationMs: 1000,
	...over
});

const META = { id: 'run-1', startedAt: '2026-10-11T00:00:00.000Z', durationMs: 60_000 };

describe('classifyFailure', () => {
	it.each([
		[
			'an API 500 in an assertion',
			'Error: expect(received).toBe(expected)\nExpected: 201\nReceived: 500'
		],
		['a vitest style status mismatch', 'AssertionError: expected 500 to be 201'],
		['an internal_error body', '{"error":"internal_error","requestId":"x"}'],
		['a refused connection', 'page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8787'],
		['fetch failed', 'TypeError: fetch failed']
	])('calls %s a server-error', (_name, error) => {
		expect(classifyFailure(error)).toBe('server-error');
	});

	it.each([
		[
			'a strict mode violation',
			'Error: strict mode violation: getByRole("button") resolved to 2 elements'
		],
		['a failed wait inside an action', 'locator.click: Timeout 15000ms exceeded.'],
		['a code error', "TypeError: Cannot read properties of undefined (reading 'url')"],
		['a whole-test timeout', 'Test timeout of 90000ms exceeded.']
	])('calls %s a test-automation-bug', (_name, error) => {
		expect(classifyFailure(error)).toBe('test-automation-bug');
	});

	it('calls an assertion that did not hold a product-bug', () => {
		const error =
			'Error: expect(locator).toBeVisible() failed\n\nLocator: getByText(/Published at v\\d+\\./)\nExpected: visible\nTimeout: 15000ms';
		expect(classifyFailure(error)).toBe('product-bug');
	});

	it('does not mistake timings or ids for a 5xx status', () => {
		expect(
			classifyFailure('expect(locator).toHaveCount(2) failed after 15000ms for 1791680780484')
		).toBe('product-bug');
	});

	it('lets a failure-category annotation override the heuristics', () => {
		const annotations = [{ type: 'failure-category', description: 'product-bug' }];
		expect(classifyFailure('locator.click: Timeout 15000ms exceeded.', annotations)).toBe(
			'product-bug'
		);
	});

	it('ignores an annotation with an unknown category', () => {
		const annotations = [{ type: 'failure-category', description: 'nonsense' }];
		expect(classifyFailure('locator.click: Timeout 15000ms exceeded.', annotations)).toBe(
			'test-automation-bug'
		);
	});
});

describe('summarizeRun', () => {
	const records: TestRecord[] = [
		record({ title: 'fast', durationMs: 100 }),
		record({ title: 'slow', durationMs: 5000, suite: 'b.spec.ts' }),
		record({
			title: 'flaky one',
			status: 'flaky',
			durationMs: 900,
			error: 'locator.click: Timeout'
		}),
		record({
			title: 'broken ui',
			status: 'failed',
			durationMs: 2000,
			error: 'expect(locator).toBeVisible() failed'
		}),
		record({
			title: 'broken api',
			status: 'failed',
			durationMs: 3000,
			suite: 'b.spec.ts',
			error: 'Received: 503'
		}),
		record({ title: 'skipped', status: 'skipped', durationMs: 0 })
	];
	const run = summarizeRun(records, META);

	it('counts every status', () => {
		expect(run).toMatchObject({ total: 6, passed: 2, failed: 2, flaky: 1, skipped: 1 });
	});

	it('computes the pass ratio over executed tests, counting flaky ones as passed and ignoring skipped', () => {
		expect(run.passRate).toBeCloseTo(3 / 5);
	});

	it('computes min, max and average duration over executed tests', () => {
		expect(run.timing).toEqual({
			minMs: 100,
			maxMs: 5000,
			avgMs: 2200,
			fastest: 'fast',
			slowest: 'slow'
		});
	});

	it('buckets failures by category and lists the flaky tests', () => {
		expect(run.failuresByCategory).toEqual({
			'product-bug': 1,
			'test-automation-bug': 0,
			'server-error': 1
		});
		expect(run.flakyTests).toEqual(['flaky one']);
		expect(run.failedTests).toMatchObject([
			{ title: 'broken ui', category: 'product-bug', quarantined: false },
			{ title: 'broken api', category: 'server-error', quarantined: false }
		]);
	});

	it('gives a per-suite overview', () => {
		expect(run.suites).toEqual([
			{ name: 'a.spec.ts', total: 4, passed: 1, failed: 1, flaky: 1, skipped: 1, durationMs: 3000 },
			{ name: 'b.spec.ts', total: 2, passed: 1, failed: 1, flaky: 0, skipped: 0, durationMs: 8000 }
		]);
	});

	it('handles an empty run without dividing by zero', () => {
		const empty = summarizeRun([], META);
		expect(empty.passRate).toBe(0);
		expect(empty.timing).toMatchObject({ minMs: 0, maxMs: 0, avgMs: 0 });
	});
});

describe('history', () => {
	const dirs: string[] = [];
	const tempDir = () => {
		const dir = mkdtempSync(join(tmpdir(), 'reporter-'));
		dirs.push(dir);
		return dir;
	};
	afterEach(() => {
		for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	});

	const runWith = (n: number, over: Partial<RunSummary> = {}): RunSummary => ({
		...summarizeRun([record()], { ...META, id: `run-${n}` }),
		...over
	});

	it('keeps only the newest 100 runs', () => {
		let runs: RunSummary[] = [];
		for (let i = 1; i <= HISTORY_LIMIT + 5; i++) runs = appendRun(runs, runWith(i));

		expect(runs).toHaveLength(HISTORY_LIMIT);
		expect(runs[0].id).toBe('run-6');
		expect(runs[runs.length - 1].id).toBe(`run-${HISTORY_LIMIT + 5}`);
	});

	it('round-trips through disk and writes latest.json', () => {
		const dir = tempDir();
		const first = runWith(1);
		saveReports(dir, first, appendRun(loadHistory(dir), first));
		const second = runWith(2);
		saveReports(dir, second, appendRun(loadHistory(dir), second));

		expect(loadHistory(dir).map((r) => r.id)).toEqual(['run-1', 'run-2']);
		expect(JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf-8')).id).toBe('run-2');
	});

	it('starts over instead of throwing when the history file is missing or corrupt', () => {
		const dir = tempDir();
		expect(loadHistory(dir)).toEqual([]);
		writeFileSync(join(dir, 'history.json'), '{not json');
		expect(loadHistory(dir)).toEqual([]);
		writeFileSync(join(dir, 'history.json'), JSON.stringify({ version: 99, runs: [1] }));
		expect(loadHistory(dir)).toEqual([]);
	});

	it('computes average pass rate and duration and ranks the most often flaky tests', () => {
		const runs = [
			runWith(1, { passRate: 1, durationMs: 100, flakyTests: ['x', 'y'] }),
			runWith(2, { passRate: 0.5, durationMs: 300, flakyTests: ['x'] }),
			runWith(3, { passRate: 0.75, durationMs: 200, flakyTests: ['x', 'z'] })
		];
		const stats = historyStats(runs, 2);

		expect(stats.runs).toBe(3);
		expect(stats.avgPassRate).toBeCloseTo(0.75);
		expect(stats.avgDurationMs).toBe(200);
		expect(stats.mostFlaky[0]).toEqual({ title: 'x', runs: 3 });
		expect(stats.mostFlaky).toHaveLength(2);
	});
});

describe('formatReport', () => {
	it('prints the overview, ratio, timings, failure categories, flaky tests and suites', () => {
		const run = summarizeRun(
			[
				record({ title: 'ok' }),
				record({ title: 'wobbly', status: 'flaky', durationMs: 4000, error: 'x' }),
				record({ title: 'bad', status: 'failed', error: 'Received: 500' })
			],
			META
		);
		const text = formatReport(run, historyStats([run]));

		expect(text).toContain('Tests: 3');
		expect(text).toContain('1 passed');
		expect(text).toContain('1 failed');
		expect(text).toContain('1 flaky');
		expect(text).toContain('Pass ratio: 66.7%');
		expect(text).toContain('min 1.0s · avg 2.0s · max 4.0s');
		expect(text).toContain('0 product bug');
		expect(text).toContain('1 server-side error');
		expect(text).toContain('[server-error] bad');
		expect(text).toContain('wobbly');
		expect(text).toContain('a.spec.ts');
	});
});
