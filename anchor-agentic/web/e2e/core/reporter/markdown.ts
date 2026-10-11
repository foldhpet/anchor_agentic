import { appendFileSync } from 'node:fs';
import { formatDuration } from './format.ts';
import type { HistoryStats } from './history.ts';
import type { Candidate } from './quarantine.ts';
import type { RunSummary } from './summary.ts';

const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
// Test titles are free text; keep them from breaking a Markdown table or list.
const md = (text: string) => text.replace(/[|`\r\n]+/g, ' ');

/** Markdown for a CI job summary or a pull-request comment. */
export function renderMarkdown(
	run: RunSummary,
	history: HistoryStats,
	pending: Candidate[] = []
): string {
	const lines: string[] = [];
	const verdict =
		run.blockingFailed > 0 ? '❌ Failed' : run.flaky > 0 ? 'Passed with flaky tests' : '✅ Passed';
	lines.push(`## E2E test run: ${verdict}`, '');
	lines.push('| Total | Passed | Failed | Flaky | Skipped | Pass ratio | Wall time |');
	lines.push('|---:|---:|---:|---:|---:|---:|---:|');
	const vs = history.runs > 1 ? ` (avg ${pct(history.avgPassRate)} over ${history.runs} runs)` : '';
	lines.push(
		`| ${run.total} | ${run.passed} | ${run.failed} | ${run.flaky} | ${run.skipped} | ${pct(run.passRate)}${vs} | ${formatDuration(run.durationMs)} |`
	);
	lines.push(
		'',
		`Test time: min ${formatDuration(run.timing.minMs)} · avg ${formatDuration(run.timing.avgMs)} · max ${formatDuration(run.timing.maxMs)}`
	);

	if (pending.length > 0) {
		lines.push('', `### ${pending.length} test(s) waiting for a quarantine decision`, '');
		for (const c of pending)
			lines.push(`- ${md(c.title)}: flaky in ${c.flakyRuns} of its last ${c.window} runs`);
		lines.push(
			'',
			'Decide with `node e2e/core/reporter/quarantine-cli.ts decide` (a person has to choose).'
		);
	}
	if (run.failed > 0) {
		const c = run.failuresByCategory;
		lines.push(
			'',
			`### Failures (${c['product-bug']} product bug · ${c['test-automation-bug']} test automation bug · ${c['server-error']} server-side error)`,
			''
		);
		for (const f of run.failedTests) {
			const tag = f.quarantined ? ' _(quarantined, non-blocking)_' : '';
			lines.push(`- \`${f.category}\` ${md(f.title)}${tag}`);
		}
	}
	const attention = run.requirements.filter((r) => r.status !== 'passing');
	if (attention.length > 0) {
		lines.push(
			'',
			'### Requirements needing attention',
			'',
			'| Requirement | Status | Tests |',
			'|---|---|---:|'
		);
		for (const r of attention) lines.push(`| ${r.id} | ${r.status} | ${r.tests} |`);
	}
	if (run.flaky > 0) {
		lines.push('', '### Flaky tests', '');
		for (const title of run.flakyTests) lines.push(`- ${md(title)}`);
	}
	if (run.serverErrors.count > 0) {
		lines.push('', `### Server-side errors (${run.serverErrors.count})`, '');
		for (const e of run.serverErrors.samples)
			lines.push(`- \`${e.method} ${md(e.path)}\`: ${md(e.error)}`);
	}
	lines.push('');
	return lines.join('\n');
}

/** Appends to the GitHub Actions job summary when running there; does nothing elsewhere. */
export function writeStepSummary(markdown: string, env: NodeJS.ProcessEnv = process.env) {
	if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
