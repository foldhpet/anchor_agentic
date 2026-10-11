import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { copyAttemptArtifacts, pruneArtifacts } from './artifacts.ts';
import { formatReport } from './format.ts';
import {
	appendRun,
	historyStats,
	HISTORY_LIMIT,
	loadHistory,
	saveReports,
	testStats
} from './history.ts';
import { renderHtml } from './html.ts';
import { renderMarkdown, writeStepSummary } from './markdown.ts';
import {
	applyAnswers,
	DEFAULT_RULES,
	findCandidates,
	loadDecisions,
	quarantinedKeys,
	saveDecisions,
	type CandidateRules
} from './quarantine.ts';
import { askDecisions, canAsk, warningText } from './quarantine-prompt.ts';
import { DEFAULT_REQUIREMENT_PATTERN, extractRequirements } from './requirements.ts';
import { ServerErrorCollector } from './server-log.ts';
import { summarizeRun, type TestRecord } from './summary.ts';

interface Options {
	/** Where reports, history and failure artifacts go. */
	outputDir?: string;
	historyLimit?: number;
	/** Committed file with the human quarantine decisions. */
	quarantineFile?: string;
	quarantineRules?: Partial<CandidateRules>;
	/** Pattern for requirement / user-story IDs found in test titles and tags. */
	requirementPattern?: RegExp;
	/** Failure artifacts are kept for this many of the latest runs. */
	artifactRuns?: number;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const FAILED = new Set(['failed', 'timedOut', 'interrupted']);

/**
 * Playwright adapter for the core reporter: collects finished tests, server-side error lines and
 * failure artifacts, turns them into framework-neutral records, and delegates every calculation to
 * the other modules in this folder. Enable it next to a console reporter in playwright.config.ts:
 *   reporter: [['list'], ['./e2e/core/reporter/playwright-reporter.ts', { outputDir: 'e2e/reports' }]]
 */
export default class SummaryReporter implements Reporter {
	private readonly outputDir: string;
	private readonly historyLimit: number;
	private readonly quarantineFile: string;
	private readonly rules: CandidateRules;
	private readonly requirementPattern: RegExp;
	private readonly artifactRuns: number;
	private readonly tests: TestCase[] = [];
	private readonly artifacts = new Map<string, string[]>();
	private readonly serverErrors = new ServerErrorCollector();
	private startedAt = new Date();

	constructor(options: Options = {}) {
		this.outputDir = options.outputDir ?? 'e2e/reports';
		this.historyLimit = options.historyLimit ?? HISTORY_LIMIT;
		this.quarantineFile = options.quarantineFile ?? 'e2e/quarantine.json';
		this.rules = { ...DEFAULT_RULES, ...options.quarantineRules };
		this.requirementPattern = options.requirementPattern ?? DEFAULT_REQUIREMENT_PATTERN;
		this.artifactRuns = options.artifactRuns ?? 20;
	}

	onBegin() {
		this.startedAt = new Date();
	}

	onStdOut(chunk: string | Buffer) {
		this.serverErrors.add(chunk);
	}

	onStdErr(chunk: string | Buffer) {
		this.serverErrors.add(chunk);
	}

	onTestEnd(test: TestCase, result: TestResult) {
		if (!this.tests.includes(test)) this.tests.push(test);
		// Playwright wipes test-results on the next run, so keep what explains a failure.
		if (FAILED.has(result.status)) {
			const saved = copyAttemptArtifacts(result.attachments, {
				reportsDir: this.outputDir,
				runId: this.startedAt.toISOString(),
				testKey: testKey(test),
				attempt: result.retry
			});
			this.artifacts.set(test.id, [...(this.artifacts.get(test.id) ?? []), ...saved]);
		}
	}

	async onEnd(result: FullResult) {
		const decisions = loadDecisions(this.quarantineFile);
		const records = this.tests.map((t) => this.toRecord(t));
		const runId = this.startedAt.toISOString();
		const run = summarizeRun(
			records,
			{ id: runId, startedAt: runId, durationMs: Date.now() - this.startedAt.getTime() },
			{ serverErrors: this.serverErrors.report(), quarantinedKeys: quarantinedKeys(decisions) }
		);
		const runs = appendRun(loadHistory(this.outputDir), run, this.historyLimit);
		saveReports(this.outputDir, run, runs);
		pruneArtifacts(
			this.outputDir,
			runs.slice(-this.artifactRuns).map((r) => r.id)
		);

		console.log(formatReport(run, historyStats(runs)));
		const finalDecisions = await this.decideQuarantine(runs, decisions);
		const pending = findCandidates(runs, finalDecisions, this.rules);

		const markdown = renderMarkdown(run, historyStats(runs), pending);
		writeFileSync(join(this.outputDir, 'summary.md'), markdown);
		writeStepSummary(markdown);
		writeFileSync(
			join(this.outputDir, 'report.html'),
			renderHtml(runs, { tests: testStats(runs), pending, decisions: finalDecisions })
		);
		console.log(
			`Reports: ${join(this.outputDir, 'report.html')} · ${join(this.outputDir, 'summary.md')}`
		);

		// Only quarantined tests failed: report them, but do not fail the build.
		if (result.status === 'failed' && run.failed > 0 && run.blockingFailed === 0) {
			console.log('All failures are quarantined (human decision); not failing the run.');
			return { status: 'passed' as const };
		}
	}

	/**
	 * Warns about tests that flake often and asks a person what to do. With no terminal (CI, piped
	 * output) it only warns and points to the CLI, so nothing is ever quarantined unattended.
	 */
	private async decideQuarantine(
		runs: ReturnType<typeof loadHistory>,
		decisions: ReturnType<typeof loadDecisions>
	) {
		const candidates = findCandidates(runs, decisions, this.rules);
		if (candidates.length === 0) return decisions;

		if (!canAsk()) {
			for (const candidate of candidates) console.warn(warningText(candidate));
			console.warn('\n   Decide with: node e2e/core/reporter/quarantine-cli.ts decide\n');
			return decisions;
		}
		const updated = applyAnswers(decisions, candidates, await askDecisions(candidates));
		if (updated !== decisions) saveDecisions(this.quarantineFile, updated);
		return updated;
	}

	private toRecord(test: TestCase): TestRecord {
		const outcome = test.outcome();
		const status: TestRecord['status'] =
			outcome === 'expected' ? 'passed' : outcome === 'unexpected' ? 'failed' : outcome;
		// For a flaky test the interesting error is the first attempt; for a failure, the last.
		const failing = test.results.filter((r) => r.status === 'failed' || r.status === 'timedOut');
		const errorResult = status === 'flaky' ? failing[0] : failing[failing.length - 1];
		const last = test.results[test.results.length - 1];

		return {
			key: testKey(test),
			title: test.title,
			suite: basename(test.location.file),
			status,
			durationMs: last?.duration ?? 0,
			error: errorResult?.error?.message?.replace(ANSI, ''),
			annotations: test.annotations,
			requirements: extractRequirements(
				[...test.titlePath(), ...test.tags],
				this.requirementPattern
			),
			artifacts: this.artifacts.get(test.id)
		};
	}
}

/** Same on every run: spec file plus the title path below it. */
function testKey(test: TestCase): string {
	const [, , file, ...titles] = test.titlePath();
	return `${file ?? basename(test.location.file)} › ${titles.join(' › ')}`;
}
