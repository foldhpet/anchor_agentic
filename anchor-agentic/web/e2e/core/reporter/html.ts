import { formatDuration } from './format.ts';
import type { TestStats } from './history.ts';
import type { Candidate, Decision } from './quarantine.ts';
import type { RunSummary } from './summary.ts';

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

interface Context {
	tests: TestStats[];
	pending: Candidate[];
	decisions: Decision[];
}

const STYLE = `
:root { --bg:#fafaf9; --card:#fff; --ink:#1c1917; --muted:#78716c; --line:#e7e5e4; --ok:#15803d; --warn:#b45309; --bad:#b91c1c; --accent:#1d4ed8; }
@media (prefers-color-scheme: dark) { :root { --bg:#141210; --card:#1d1a17; --ink:#f5f5f4; --muted:#a8a29e; --line:#33302c; --ok:#4ade80; --warn:#fbbf24; --bad:#f87171; --accent:#60a5fa; } }
* { box-sizing: border-box; }
body { margin:0; padding:24px 16px; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui, sans-serif; }
main { max-width:1000px; margin:0 auto; }
h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:16px; margin:28px 0 8px; }
.muted { color:var(--muted); font-size:13px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin:16px 0; }
.card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:10px 12px; }
.card b { display:block; font-size:22px; } .card span { color:var(--muted); font-size:12px; }
.ok { color:var(--ok); } .warn { color:var(--warn); } .bad { color:var(--bad); }
table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:8px; }
th, td { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); font-size:13px; vertical-align:top; }
th { color:var(--muted); font-weight:600; } td.n, th.n { text-align:right; font-variant-numeric:tabular-nums; }
.scroll { overflow-x:auto; }
svg { width:100%; height:auto; background:var(--card); border:1px solid var(--line); border-radius:8px; }
a { color:var(--accent); }
.banner { border:1px solid var(--warn); background:var(--card); border-radius:8px; padding:10px 12px; margin:16px 0; }
`;

function statusClass(run: RunSummary): string {
	return run.blockingFailed > 0 ? 'bad' : run.flaky > 0 ? 'warn' : 'ok';
}

/** Bars: one per run, height = pass ratio, colour = outcome. Newest on the right. */
function passRateChart(runs: RunSummary[]): string {
	const step = 10;
	const bars = runs
		.map((run, i) => {
			const h = Math.max(2, run.passRate * 70);
			const color =
				run.blockingFailed > 0 ? 'var(--bad)' : run.flaky > 0 ? 'var(--warn)' : 'var(--ok)';
			const label = `${run.startedAt.slice(0, 16).replace('T', ' ')}: ${pct(run.passRate)} passed, ${run.failed} failed, ${run.flaky} flaky`;
			return `<rect x="${i * step}" y="${80 - h}" width="8" height="${h}" fill="${color}"><title>${esc(label)}</title></rect>`;
		})
		.join('');
	return `<svg viewBox="0 0 ${Math.max(runs.length, 1) * step} 84" role="img" aria-label="Pass ratio of the last ${runs.length} runs">${bars}</svg>`;
}

/** Line of the wall-clock time of each run. */
function durationChart(runs: RunSummary[]): string {
	const max = Math.max(...runs.map((r) => r.durationMs), 1);
	const points = runs.map((r, i) => `${i * 10 + 4},${80 - (r.durationMs / max) * 70}`).join(' ');
	return `<svg viewBox="0 0 ${Math.max(runs.length, 1) * 10} 84" role="img" aria-label="Run time of the last ${runs.length} runs"><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="1.5"/></svg>`;
}

function table(headers: { text: string; num?: boolean }[], rows: string[][]): string {
	if (rows.length === 0) return '<p class="muted">Nothing to show.</p>';
	const head = headers.map((h) => `<th${h.num ? ' class="n"' : ''}>${esc(h.text)}</th>`).join('');
	const body = rows
		.map(
			(cells) =>
				`<tr>${cells.map((c, i) => `<td${headers[i].num ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`
		)
		.join('');
	return `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderHtml(runs: RunSummary[], ctx: Context): string {
	const run = runs[runs.length - 1];
	if (!run) return '<!doctype html><title>No runs yet</title><p>No test runs recorded yet.</p>';
	const c = run.failuresByCategory;
	const card = (value: string, label: string, cls = '') =>
		`<div class="card"><b class="${cls}">${esc(value)}</b><span>${esc(label)}</span></div>`;

	const flakyRows = [...ctx.tests]
		.filter((t) => t.flaky > 0)
		.sort((a, b) => b.flakeRate - a.flakeRate)
		.slice(0, 10)
		.map((t) => [esc(t.title), esc(t.suite), `${t.flaky}/${t.runs}`, pct(t.flakeRate)]);
	const slowRows = [...ctx.tests]
		.filter((t) => t.slowdown >= 1.5)
		.sort((a, b) => b.slowdown - a.slowdown)
		.slice(0, 10)
		.map((t) => [
			esc(t.title),
			formatDuration(t.avgMs),
			formatDuration(t.lastMs),
			`${t.slowdown.toFixed(1)}x`
		]);
	const slowest = [...run.tests]
		.filter((t) => t.status !== 'skipped')
		.sort((a, b) => b.durationMs - a.durationMs)
		.slice(0, 10)
		.map((t) => [esc(t.title), esc(t.suite), formatDuration(t.durationMs)]);
	const failedRows = run.failedTests.map((f) => [
		esc(f.title),
		esc(f.category) + (f.quarantined ? ' <span class="muted">(quarantined)</span>' : ''),
		f.artifacts
			.map((a) => `<a href="${esc(a)}">${esc(a.split('/').pop() ?? a)}</a>`)
			.join('<br>') || '—'
	]);
	const requirementRows = run.requirements.map((r) => [
		esc(r.id),
		`<span class="${r.status === 'passing' ? 'ok' : r.status === 'flaky' ? 'warn' : 'bad'}">${r.status}</span>`,
		String(r.tests)
	]);
	const suiteRows = run.suites.map((s) => [
		esc(s.name),
		`${s.passed}/${s.total}`,
		String(s.failed),
		String(s.flaky),
		formatDuration(s.durationMs)
	]);
	const pendingBanner =
		ctx.pending.length > 0
			? `<div class="banner"><b class="warn">⚠️ ${ctx.pending.length} test(s) waiting for a quarantine decision</b><br>${ctx.pending
					.map((p) => `${esc(p.title)} — flaky in ${p.flakyRuns} of its last ${p.window} runs`)
					.join(
						'<br>'
					)}<br><span class="muted">Decide with <code>node e2e/core/reporter/quarantine-cli.ts decide</code>. Quarantine stops a test from failing the build, so a person has to choose.</span></div>`
			: '';

	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>E2E Test Report</title><style>${STYLE}</style></head><body><main>
<h1>E2E Test Report</h1>
<p class="muted">Latest run ${esc(run.startedAt)} · ${runs.length} run(s) in history</p>
${pendingBanner}
<div class="cards">
${card(pct(run.passRate), 'pass ratio', statusClass(run))}
${card(`${run.passed}/${run.total}`, 'passed')}
${card(String(run.failed), 'failed', run.failed ? 'bad' : '')}
${card(String(run.flaky), 'flaky', run.flaky ? 'warn' : '')}
${card(String(run.serverErrors.count), 'server-side errors', run.serverErrors.count ? 'bad' : '')}
${card(formatDuration(run.timing.avgMs), `avg test (min ${formatDuration(run.timing.minMs)}, max ${formatDuration(run.timing.maxMs)})`)}
</div>
<h2>Pass ratio, last ${runs.length} runs</h2>${passRateChart(runs)}
<h2>Run time, last ${runs.length} runs</h2>${durationChart(runs)}
<h2>Failures: ${c['product-bug']} product bug · ${c['test-automation-bug']} test automation bug · ${c['server-error']} server-side error</h2>
${table([{ text: 'Test' }, { text: 'Category' }, { text: 'Failure artifacts' }], failedRows)}
<h2>Suites</h2>
${table([{ text: 'Suite' }, { text: 'Passed', num: true }, { text: 'Failed', num: true }, { text: 'Flaky', num: true }, { text: 'Time', num: true }], suiteRows)}
<h2>Requirements</h2>
${table([{ text: 'Requirement' }, { text: 'Status' }, { text: 'Tests', num: true }], requirementRows)}
<h2>Flakiest tests (all history)</h2>
${table([{ text: 'Test' }, { text: 'Suite' }, { text: 'Flaky runs', num: true }, { text: 'Rate', num: true }], flakyRows)}
<h2>Tests getting slower</h2>
${table([{ text: 'Test' }, { text: 'Earlier avg', num: true }, { text: 'Latest', num: true }, { text: 'Change', num: true }], slowRows)}
<h2>Slowest tests (latest run)</h2>
${table([{ text: 'Test' }, { text: 'Suite' }, { text: 'Time', num: true }], slowest)}
<h2>Quarantine decisions</h2>
${table(
	[{ text: 'Test' }, { text: 'Decision' }, { text: 'Decided' }],
	ctx.decisions.map((d) => [esc(d.title), esc(d.decision), esc(d.decidedAt.slice(0, 10))])
)}
<h2>Server-side errors (latest run)</h2>
${table(
	[{ text: 'Request' }, { text: 'Error' }],
	run.serverErrors.samples.map((e) => [esc(`${e.method} ${e.path}`), esc(e.error)])
)}
</main></body></html>
`;
}
