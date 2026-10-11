import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { copyAttemptArtifacts, pruneArtifacts, slug } from './artifacts.ts';
import { historyStats, testStats } from './history.ts';
import { renderHtml } from './html.ts';
import { renderMarkdown, writeStepSummary } from './markdown.ts';
import {
	applyAnswers,
	findCandidates,
	loadDecisions,
	quarantinedKeys,
	recordDecision,
	releaseDecision,
	saveDecisions,
	type Decision
} from './quarantine.ts';
import { askDecisions, canAsk, warningText } from './quarantine-prompt.ts';
import { extractRequirements, summarizeRequirements } from './requirements.ts';
import { parseServerErrors, ServerErrorCollector } from './server-log.ts';
import { summarizeRun, type RunSummary, type TestRecord } from './summary.ts';

const dirs: string[] = [];
const tempDir = () => {
	const dir = mkdtempSync(join(tmpdir(), 'reporter-feat-'));
	dirs.push(dir);
	return dir;
};
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const rec = (title: string, over: Partial<TestRecord> = {}): TestRecord => ({
	key: `a.spec.ts › ${title}`,
	title,
	suite: 'a.spec.ts',
	status: 'passed',
	durationMs: 1000,
	...over
});

const run = (n: number, records: TestRecord[]): RunSummary =>
	summarizeRun(records, {
		id: `2026-01-${String(n).padStart(2, '0')}T00:00:00.000Z`,
		startedAt: 'x',
		durationMs: 1000
	});

describe('requirements', () => {
	it('finds IDs in titles and tags, once each, sorted', () => {
		expect(
			extractRequirements(['Sandbox (US-014)', 'covers US-002 and US-014', '@US-009'])
		).toEqual(['US-002', 'US-009', 'US-014']);
	});

	it('ignores a range in a describe title: it names a group, not what a test covers', () => {
		expect(
			extractRequirements(['Domain authoring (US-005–US-013)', 'US-012: edit a step'])
		).toEqual(['US-012']);
		expect(extractRequirements(['Epic (US-005-US-013)'])).toEqual([]);
	});

	it('supports another ID pattern', () => {
		expect(extractRequirements(['checks JIRA-42'], /\bJIRA-\d+\b/g)).toEqual(['JIRA-42']);
	});

	it('rolls tests up per requirement: failing beats flaky beats passing; skipped is ignored', () => {
		const rows = summarizeRequirements([
			{ status: 'passed', requirements: ['US-001', 'US-002'] },
			{ status: 'flaky', requirements: ['US-002'] },
			{ status: 'failed', requirements: ['US-003'] },
			{ status: 'passed', requirements: ['US-003'] },
			{ status: 'skipped', requirements: ['US-004'] }
		]);
		expect(rows.map((r) => [r.id, r.status, r.tests])).toEqual([
			['US-001', 'passing', 1],
			['US-002', 'flaky', 2],
			['US-003', 'failing', 2]
		]);
	});
});

describe('server-side error capture', () => {
	const line = (over: Record<string, unknown> = {}) =>
		`[WebServer] ${JSON.stringify({ requestId: 'r1', path: '/api/v1/roles/x', method: 'GET', error: 'invalid input syntax', ...over })}`;

	it('finds the API error line, ignoring request logs and rejections', () => {
		const text = [
			'[WebServer] starting',
			JSON.stringify({
				requestId: 'a',
				path: '/p',
				method: 'GET',
				userId: null,
				status: 403,
				reason: 'not_owner'
			}),
			line(),
			'not json {oops}'
		].join('\n');
		expect(parseServerErrors(text)).toEqual([
			{ path: '/api/v1/roles/x', method: 'GET', error: 'invalid input syntax', requestId: 'r1' }
		]);
	});

	it('copes with ANSI colours, partial chunks and a last line without a newline', () => {
		const collector = new ServerErrorCollector();
		const whole = `\u001b[31m${line()}\u001b[0m`;
		collector.add(whole.slice(0, 20));
		collector.add(whole.slice(20));
		expect(collector.report().count).toBe(1);
	});

	it('counts a request once, even if it is logged twice, and keeps only a few samples', () => {
		const collector = new ServerErrorCollector();
		collector.add(`${line()}\n${line()}\n`);
		for (let i = 0; i < 30; i++) collector.add(`${line({ requestId: `id-${i}` })}\n`);
		const report = collector.report();
		expect(report.count).toBe(31);
		expect(report.samples).toHaveLength(10);
	});
});

describe('per-test statistics', () => {
	it('computes flake rate, average, last duration and slowdown per test across runs', () => {
		const runs = [
			run(1, [rec('t', { durationMs: 100 })]),
			run(2, [rec('t', { status: 'flaky', durationMs: 100 })]),
			run(3, [rec('t', { durationMs: 100 })]),
			run(4, [rec('t', { durationMs: 400 }), rec('only here', { status: 'skipped' })])
		];
		const [t, ...others] = testStats(runs);
		expect(others).toEqual([]);
		expect(t).toMatchObject({
			runs: 4,
			passed: 3,
			flaky: 1,
			failed: 0,
			flakeRate: 0.25,
			lastMs: 400,
			avgMs: 175
		});
		expect(t.slowdown).toBeCloseTo(4);
	});

	it('does not report a slowdown before there are three earlier runs', () => {
		const runs = [run(1, [rec('t', { durationMs: 100 })]), run(2, [rec('t', { durationMs: 900 })])];
		expect(testStats(runs)[0].slowdown).toBe(0);
	});

	it('tolerates history written before per-test data existed', () => {
		const old = { ...run(1, []), tests: undefined } as unknown as RunSummary;
		expect(testStats([old])).toEqual([]);
	});
});

describe('quarantine', () => {
	const flakyRuns = (flags: boolean[]) =>
		flags.map((flaky, i) => run(i + 1, [rec('wobbly', { status: flaky ? 'flaky' : 'passed' })]));

	it('proposes a test that was flaky at least 3 times in its last 10 runs', () => {
		const candidates = findCandidates(flakyRuns([true, false, true, false, false, true]), []);
		expect(candidates).toEqual([
			{ key: 'a.spec.ts › wobbly', title: 'wobbly', flakyRuns: 3, window: 6 }
		]);
	});

	it('does not propose a test that flaked only long ago, or only twice', () => {
		const old = [true, true, true, ...Array(10).fill(false)];
		expect(findCandidates(flakyRuns(old), [])).toEqual([]);
		expect(findCandidates(flakyRuns([true, true, false]), [])).toEqual([]);
	});

	it('does not ask again about a test a human already decided on', () => {
		const runs = flakyRuns([true, true, true, true]);
		const decided = recordDecision(
			[],
			{ key: 'a.spec.ts › wobbly', title: 'wobbly' },
			'keep-blocking'
		);
		expect(findCandidates(runs, decided)).toEqual([]);
		expect(findCandidates(runs, releaseDecision(decided, 'a.spec.ts › wobbly'))).toHaveLength(1);
	});

	it('only a quarantined decision makes failures non-blocking, and only for that test', () => {
		const decisions: Decision[] = recordDecision(
			recordDecision([], { key: 'k1', title: 't1' }, 'quarantined'),
			{ key: 'k2', title: 't2' },
			'keep-blocking'
		);
		expect([...quarantinedKeys(decisions)]).toEqual(['k1']);

		const summary = summarizeRun(
			[
				rec('t1', { key: 'k1', status: 'failed', error: 'x' }),
				rec('t2', { key: 'k2', status: 'failed', error: 'x' })
			],
			{ id: 'r', startedAt: 'x', durationMs: 1 },
			{ quarantinedKeys: quarantinedKeys(decisions) }
		);
		expect(summary.failed).toBe(2);
		expect(summary.blockingFailed).toBe(1);
		expect(summary.failedTests.map((f) => f.quarantined)).toEqual([true, false]);
	});

	it('round-trips decisions through the committed file; a bad file means no decisions', () => {
		const dir = tempDir();
		const file = join(dir, 'quarantine.json');
		expect(loadDecisions(file)).toEqual([]);
		const decisions = recordDecision(
			[],
			{ key: 'k', title: 't' },
			'quarantined',
			new Date('2026-01-01T00:00:00Z'),
			'flaky login'
		);
		saveDecisions(file, decisions);
		expect(loadDecisions(file)).toEqual(decisions);
		writeFileSync(file, 'not json');
		expect(loadDecisions(file)).toEqual([]);
	});

	describe('asking a human', () => {
		const candidates = [
			{ key: 'k1', title: 'first', flakyRuns: 4, window: 10 },
			{ key: 'k2', title: 'second', flakyRuns: 3, window: 8 },
			{ key: 'k3', title: 'third', flakyRuns: 3, window: 8 }
		];

		it('warns about the risk, then records exactly what the person answered', async () => {
			const input = new PassThrough();
			const output = new PassThrough();
			let shown = '';
			output.on('data', (d) => (shown += d.toString()));
			input.write('q\nk\nsomething else\n');

			const answers = await askDecisions(candidates, { input, output });
			expect(answers.get('k1')).toBe('quarantined');
			expect(answers.get('k2')).toBe('keep-blocking');
			expect(answers.get('k3')).toBe('later');
			expect(shown).toContain('QUARANTINE DECISION NEEDED: "first"');
			expect(shown).toContain('a real regression in it could slip through');

			const saved = applyAnswers([], candidates, answers, new Date('2026-01-01T00:00:00Z'));
			expect(saved.map((d) => [d.key, d.decision])).toEqual([
				['k1', 'quarantined'],
				['k2', 'keep-blocking']
			]);
		});

		it('only asks when a person is there: both ends are a terminal and it is not CI', () => {
			expect(canAsk({ isTTY: true }, { isTTY: true }, {})).toBe(true);
			expect(canAsk({ isTTY: true }, { isTTY: false }, {})).toBe(false);
			expect(canAsk({ isTTY: false }, { isTTY: true }, {})).toBe(false);
			expect(canAsk({ isTTY: true }, { isTTY: true }, { CI: 'true' })).toBe(false);
		});

		it('states the numbers in the warning', () => {
			expect(warningText(candidates[0])).toContain('flaky in 4 of its last 10 runs');
		});
	});
});

describe('failure artifacts', () => {
	it('copies a failed attempt’s files out of test-results and returns report-relative paths', () => {
		const dir = tempDir();
		const source = join(dir, 'test-results');
		mkdirSync(source);
		writeFileSync(join(source, 'shot.png'), 'png');
		writeFileSync(join(source, 'trace.zip'), 'zip');
		writeFileSync(join(source, 'clip.webm'), 'video');

		const copied = copyAttemptArtifacts(
			[
				{ name: 'screenshot', path: join(source, 'shot.png') },
				{ name: 'trace', path: join(source, 'trace.zip') },
				{ name: 'video', path: join(source, 'clip.webm') },
				{ name: 'inline-body' },
				{ name: 'missing', path: join(source, 'gone.png') }
			],
			{
				reportsDir: join(dir, 'reports'),
				runId: '2026-01-01T00:00:00.000Z',
				testKey: 'a.spec.ts › my test',
				attempt: 1
			}
		);

		expect(copied).toEqual([
			'artifacts/2026-01-01T00_00_00.000Z/a.spec.ts_my_test/attempt1-screenshot.png',
			'artifacts/2026-01-01T00_00_00.000Z/a.spec.ts_my_test/attempt1-trace.zip'
		]);
		for (const rel of copied) expect(existsSync(join(dir, 'reports', rel))).toBe(true);
	});

	it('prunes the artifact folders of runs that are no longer kept', () => {
		const dir = tempDir();
		for (const id of ['old', 'keep'])
			mkdirSync(join(dir, 'artifacts', slug(id)), { recursive: true });
		pruneArtifacts(dir, ['keep']);
		expect(existsSync(join(dir, 'artifacts', 'old'))).toBe(false);
		expect(existsSync(join(dir, 'artifacts', 'keep'))).toBe(true);
		pruneArtifacts(join(dir, 'nothing-here'), []);
	});
});

describe('Markdown and HTML reports', () => {
	const failing = summarizeRun(
		[
			rec('good', { requirements: ['US-001'] }),
			rec('wobbly | `tick`', { status: 'flaky', requirements: ['US-002'], error: 'x' }),
			rec('broken <script>', {
				status: 'failed',
				error: 'Received: 500',
				requirements: ['US-003'],
				artifacts: ['artifacts/r/k/attempt0-trace.zip']
			})
		],
		{ id: 'r1', startedAt: '2026-01-01T00:00:00.000Z', durationMs: 5000 },
		{ serverErrors: { count: 1, samples: [{ method: 'GET', path: '/api/x', error: 'boom' }] } }
	);
	const pending = [{ key: 'k', title: 'wobbly', flakyRuns: 3, window: 10 }];

	it('Markdown gives the verdict, failures, flaky tests, server errors, requirements and pending decisions', () => {
		const text = renderMarkdown(failing, historyStats([failing]), pending);
		expect(text).toContain('E2E test run: ✗ Failed');
		expect(text).toContain('`server-error` broken <script>');
		expect(text).toContain('### Flaky tests');
		expect(text).toContain('`GET /api/x`: boom');
		expect(text).toContain('| US-003 | ✗ failing | 1 |');
		expect(text).toContain('waiting for a quarantine decision');
		expect(text).not.toContain('wobbly | `tick`'); // table/list characters are neutralised
	});

	it('Markdown says Passed only when nothing blocks, and writes the GitHub job summary when asked', () => {
		const ok = summarizeRun([rec('good')], { id: 'r', startedAt: 'x', durationMs: 1 });
		expect(renderMarkdown(ok, historyStats([ok]))).toContain('✓ Passed');

		const dir = tempDir();
		const file = join(dir, 'step-summary.md');
		writeStepSummary('hello', { GITHUB_STEP_SUMMARY: file });
		writeStepSummary('again', {});
		expect(readFileSync(file, 'utf-8')).toBe('hello\n');
	});

	it('HTML is self-contained, escapes test titles, links failure artifacts and shows the pending decision', () => {
		const runs = [run(1, [rec('t')]), failing];
		const html = renderHtml(runs, { tests: testStats(runs), pending, decisions: [] });
		expect(html).toContain('<!doctype html>');
		expect(html).not.toContain('<script>');
		expect(html).toContain('broken &#60;script&#62;');
		expect(html).toContain('href="artifacts/r/k/attempt0-trace.zip"');
		expect(html).toContain('waiting for a quarantine decision');
		expect(html).not.toMatch(/https?:\/\/(?!localhost)/); // no external resources
	});

	it('HTML charts keep a bounded aspect ratio however few runs there are', () => {
		for (const runs of [[run(1, [rec('t')])], [run(1, [rec('t')]), failing]]) {
			const html = renderHtml(runs, { tests: testStats(runs), pending: [], decisions: [] });
			const boxes = [...html.matchAll(/<svg viewBox="0 0 (\d+) (\d+)"/g)];
			expect(boxes).toHaveLength(2);
			for (const [, w, h] of boxes) expect(Number(w) / Number(h)).toBeGreaterThan(2); // 10x84 rendered ~8000px tall
		}
		const html = renderHtml([run(1, [rec('t')])], { tests: [], pending: [], decisions: [] });
		expect(html).toMatch(/svg \{[^}]*height:120px/);
		expect(html).toMatch(/<path d="M[\d.]+ [\d.]+h0"/); // a lone run still draws a visible point
	});

	it('HTML copes with no runs', () => {
		expect(renderHtml([], { tests: [], pending: [], decisions: [] })).toContain(
			'No test runs recorded yet'
		);
	});
});
