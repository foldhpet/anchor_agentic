import type { HistoryStats } from './history.ts';
import { GLYPH } from './icons.ts';
import type { RunSummary } from './summary.ts';

const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = ms / 1000;
	return seconds < 60
		? `${seconds.toFixed(1)}s`
		: `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** Console report for one run. `history` includes this run. */
export function formatReport(run: RunSummary, history: HistoryStats): string {
	const lines: string[] = [];
	const { failuresByCategory: byCategory, timing } = run;
	const time = formatDuration;

	lines.push('', '═══════════ Test Run Report ═══════════');
	lines.push(`Run ${run.id} · wall time ${time(run.durationMs)}`);
	lines.push(
		`Tests: ${run.total} · ${GLYPH.passed} ${run.passed} passed · ${GLYPH.failed} ${run.failed} failed · ${GLYPH.flaky} ${run.flaky} flaky · ${GLYPH.skipped} ${run.skipped} skipped`
	);
	const vsHistory =
		history.runs > 1 ? ` (average of last ${history.runs} runs: ${pct(history.avgPassRate)})` : '';
	lines.push(`Pass ratio: ${pct(run.passRate)}${vsHistory}`);
	lines.push(
		`Execution time per test: min ${time(timing.minMs)} · avg ${time(timing.avgMs)} · max ${time(timing.maxMs)}`
	);
	if (timing.slowest) lines.push(`  slowest: ${timing.slowest}`);

	lines.push(
		`Failures: ${byCategory['product-bug']} product bug · ${byCategory['test-automation-bug']} test automation bug · ${byCategory['server-error']} server-side error`
	);
	for (const f of run.failedTests) {
		const note = f.quarantined ? ` (${GLYPH.quarantined} quarantined: does not fail the run)` : '';
		lines.push(`  ${GLYPH.failed} [${f.category}] ${f.title}${note}`);
		for (const artifact of f.artifacts) lines.push(`       ↳ ${artifact}`);
	}

	lines.push(`Flaky tests: ${run.flaky}`);
	for (const title of run.flakyTests) lines.push(`  ${GLYPH.flaky} ${title}`);
	if (history.mostFlaky.length > 0) {
		const top = history.mostFlaky.map((t) => `${t.title} (${t.runs}x)`).join('; ');
		lines.push(`Most often flaky in the last ${history.runs} runs: ${top}`);
	}

	if (run.serverErrors.count > 0) {
		lines.push(`Server-side errors logged during the run: ${run.serverErrors.count}`);
		for (const e of run.serverErrors.samples)
			lines.push(`  ${GLYPH.failed} ${e.method} ${e.path}: ${e.error}`);
	}

	const attention = run.requirements.filter((r) => r.status !== 'passing');
	if (run.requirements.length > 0) {
		const passing = run.requirements.length - attention.length;
		lines.push(`Requirements covered: ${run.requirements.length} (${passing} passing)`);
		for (const r of attention)
			lines.push(`  ${r.status === 'failing' ? GLYPH.failed : GLYPH.flaky} ${r.id} ${r.status}`);
	}

	lines.push('Suites:');
	for (const s of run.suites) {
		const detail = [`${s.passed}/${s.total} passed`];
		if (s.failed) detail.push(`${s.failed} failed`);
		if (s.flaky) detail.push(`${s.flaky} flaky`);
		if (s.skipped) detail.push(`${s.skipped} skipped`);
		lines.push(`  ${s.name.padEnd(34)} ${detail.join(', ').padEnd(34)} ${time(s.durationMs)}`);
	}
	lines.push('═══════════════════════════════════════', '');
	return lines.join('\n');
}
