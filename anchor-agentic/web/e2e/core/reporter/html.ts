import { formatDuration } from './format.ts';
import { iconSvg } from './icons.ts';
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

/*
 * Mirrors the design tokens in src/routes/layout.css (same names and values) so the report matches the
 * web app. core/ must not import from src/, so the values are copied (docs/STYLE-GUIDE.md section 7).
 * Light only. Secondary text stays full ink: ink at 70% is only 4.46:1 on white, below AA for small text.
 * Icons (docs/STYLE-GUIDE.md section 5) are inline SVG in currentColor. Only passed (primary) and failed
 * (attention) are coloured, and only on bg: attention is 2.71:1 on surface, so the banner uses ink.
 */
const STYLE = `
:root { color-scheme: light; --color-bg:#ffffff; --color-surface:#f2f2f2; --color-ink:#413c3e; --color-primary:#367051; --color-caution:#ffbf00; --color-attention:#ff6000; --font-sans:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; --line:color-mix(in srgb, var(--color-ink) 10%, transparent); }
* { box-sizing: border-box; }
body { margin:0; padding:1.5rem 1rem; background:var(--color-bg); color:var(--color-ink); font-family:var(--font-sans); font-size:1rem; line-height:1.6; }
main { max-width:56rem; margin:0 auto; }
h1, h2 { font-weight:600; line-height:1.25; }
h1 { font-size:1.5rem; margin:0 0 .5rem; } h2 { font-size:1.125rem; margin:2rem 0 .5rem; }
p, li { max-width:70ch; }
a { color:var(--color-primary); text-decoration:underline; text-decoration-thickness:1px; } a:hover { text-decoration-thickness:2px; }
:focus-visible { outline:2px solid var(--color-primary); outline-offset:2px; }
.muted { font-size:.875rem; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(8rem,1fr)); gap:.5rem; margin:1rem 0; }
.card { border:1px solid var(--line); border-radius:.375rem; padding:.75rem; }
.card b { display:block; font-size:1.5rem; line-height:1.25; } .card span { font-size:.75rem; }
.card.passed { border-left:4px solid var(--color-primary); } .card.flaky { border-left:4px solid var(--color-caution); } .card.failed { border-left:4px solid var(--color-attention); }
.badge { display:inline-block; border-radius:9999px; padding:.125rem .5rem; font-size:.75rem; line-height:1.5; }
.badge.passed { background:var(--color-primary); color:var(--color-bg); } .badge.flaky { background:var(--color-caution); } .badge.failed { border:1px solid var(--color-attention); }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; padding:.375rem .625rem; border-bottom:1px solid var(--line); font-size:.875rem; vertical-align:top; }
th { font-weight:600; } td.n, th.n { text-align:right; font-variant-numeric:tabular-nums; }
.scroll { overflow-x:auto; }
svg { display:block; width:100%; height:72px; background:var(--color-bg); border:1px solid var(--line); border-radius:.375rem; }
.banner { border-left:4px solid var(--color-attention); background:var(--color-surface); border-radius:.375rem; padding:.75rem 1rem; margin:1rem 0; }
svg.icon { display:inline-block; width:1em; height:1em; margin:0 .25em 0 0; vertical-align:-.125em; flex:none; border:0; border-radius:0; background:none; }
.i-passed { color:var(--color-primary); } .i-failed { color:var(--color-attention); }
.legend { display:flex; flex-wrap:wrap; gap:.25rem 1rem; margin:.5rem 0 0; }
@media print { svg, tr, .card, .banner { break-inside:avoid; } h2 { break-after:avoid; } }
`;

type Outcome = 'passed' | 'flaky' | 'failed';

/** Icon beside an outcome word, drawn straight on bg (badges and the banner use plain iconSvg: currentColor). */
type OutcomeIcon = Outcome | 'skipped' | 'quarantined';

const outcomeIcon = (name: OutcomeIcon) =>
	iconSvg(name, name === 'passed' || name === 'failed' ? `i-${name}` : '');

const requirementOutcome = (status: string): Outcome =>
	status === 'passing' ? 'passed' : status === 'flaky' ? 'flaky' : 'failed';

function statusClass(run: RunSummary): Outcome {
	return run.blockingFailed > 0 ? 'failed' : run.flaky > 0 ? 'flaky' : 'passed';
}

/**
 * Charts have a fixed rendered height and at least this many slots. Sizing the viewBox to the run
 * count alone made a young history (one run = 10x84) scale to thousands of blank pixels tall.
 */
const MIN_SLOTS = 30;
const STEP = 10;
const slots = (runs: RunSummary[]) => Math.max(runs.length, MIN_SLOTS);

/** A trend needs two points; with one run the charts would be an empty box around a stub. */
const MIN_TREND_RUNS = 2;

/** Bars: one per run, height = pass ratio, colour = outcome. Newest on the right. */
function legend(): string {
	return `<p class="legend muted">${(['passed', 'flaky', 'failed'] as const).map((o) => `<span>${outcomeIcon(o)}${o}</span>`).join('')}</p>`;
}

function passRateChart(runs: RunSummary[]): string {
	const step = STEP;
	const bars = runs
		.map((run, i) => {
			const h = Math.max(2, run.passRate * 70);
			const outcome = statusClass(run);
			const color = {
				failed: 'var(--color-attention)',
				flaky: 'var(--color-caution)',
				passed: 'var(--color-primary)'
			}[outcome];
			// Caution on white is too pale for a graphic; an ink outline keeps flaky bars visible.
			const edge =
				outcome === 'flaky'
					? ' stroke="var(--color-ink)" stroke-width="1" vector-effect="non-scaling-stroke"'
					: '';
			const label = `${run.startedAt.slice(0, 16).replace('T', ' ')}: ${outcome}, ${pct(run.passRate)} passed, ${run.failed} failed, ${run.flaky} flaky`;
			return `<rect x="${i * step}" y="${80 - h}" width="8" height="${h}" fill="${color}"${edge}><title>${esc(label)}</title></rect>`;
		})
		.join('');
	const last = runs[runs.length - 1];
	const latest = last ? `; latest ${statusClass(last)}, ${pct(last.passRate)} passed` : '';
	return `<svg viewBox="0 0 ${slots(runs) * step} 84" preserveAspectRatio="none" role="img" aria-label="Pass ratio of the last ${runs.length} runs${latest}">${bars}</svg>`;
}

/** Line of the wall-clock time of each run. */
function durationChart(runs: RunSummary[]): string {
	const max = Math.max(...runs.map((r) => r.durationMs), 1);
	const coords = runs.map((r, i) => [i * STEP + 4, 80 - (r.durationMs / max) * 70] as const);
	const points = coords.map(([x, y]) => `${x},${y}`).join(' ');
	// A single run has nothing to connect, so mark every point as well.
	const dots = coords
		.map(
			([x, y], i) =>
				`<path d="M${x} ${y}h0" stroke="var(--color-primary)" stroke-width="6" stroke-linecap="round" vector-effect="non-scaling-stroke"><title>${esc(`${runs[i].startedAt.slice(0, 16).replace('T', ' ')}: ${formatDuration(runs[i].durationMs)}`)}</title></path>`
		)
		.join('');
	return `<svg viewBox="0 0 ${slots(runs) * STEP} 84" preserveAspectRatio="none" role="img" aria-label="Run time of the last ${runs.length} runs${runs.length ? `; latest ${formatDuration(runs[runs.length - 1].durationMs)}` : ''}"><polyline points="${points}" fill="none" stroke="var(--color-primary)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${dots}</svg>`;
}

function table(
	headers: { text: string; num?: boolean; icon?: OutcomeIcon }[],
	rows: string[][]
): string {
	if (rows.length === 0) return '<p class="muted">Nothing to show.</p>';
	const head = headers
		.map(
			(h) =>
				`<th${h.num ? ' class="n"' : ''}>${h.icon ? outcomeIcon(h.icon) : ''}${esc(h.text)}</th>`
		)
		.join('');
	const body = rows
		.map(
			(cells) =>
				`<tr>${cells.map((c, i) => `<td${headers[i].num ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`
		)
		.join('');
	return `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function trends(runs: RunSummary[]): string {
	if (runs.length < MIN_TREND_RUNS)
		return `<h2>Trends</h2><p class="muted">Trend charts appear once there are at least ${MIN_TREND_RUNS} runs in the history; this is run ${runs.length}.</p>`;
	return `<h2>Pass ratio, last ${runs.length} runs</h2>${passRateChart(runs)}${legend()}
<h2>Run time, last ${runs.length} runs</h2>${durationChart(runs)}`;
}

export function renderHtml(runs: RunSummary[], ctx: Context): string {
	const run = runs[runs.length - 1];
	if (!run) return '<!doctype html><title>No runs yet</title><p>No test runs recorded yet.</p>';
	const c = run.failuresByCategory;
	const card = (value: string, label: string, cls: Outcome | '' = '', icon?: OutcomeIcon) =>
		`<div class="card${cls ? ` ${cls}` : ''}"><b>${esc(value)}</b><span>${icon ? outcomeIcon(icon) : ''}${esc(label)}</span></div>`;

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
		esc(f.category) +
			(f.quarantined ? ` <span class="muted">${iconSvg('quarantined')}(quarantined)</span>` : ''),
		f.artifacts
			.map((a) => `<a href="${esc(a)}">${esc(a.split('/').pop() ?? a)}</a>`)
			.join('<br>') || '—'
	]);
	const requirementRows = run.requirements.map((r) => [
		esc(r.id),
		`<span class="badge ${requirementOutcome(r.status)}">${iconSvg(requirementOutcome(r.status))}${r.status}</span>`,
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
			? `<div class="banner" role="status"><b>${iconSvg('quarantined')}${ctx.pending.length} test(s) waiting for a quarantine decision</b><br>${ctx.pending
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
${card(pct(run.passRate), `pass ratio (${statusClass(run)})`, statusClass(run), statusClass(run))}
${card(`${run.passed}/${run.total}`, 'passed', '', 'passed')}
${card(String(run.failed), 'failed', run.failed ? 'failed' : '', 'failed')}
${card(String(run.flaky), 'flaky', run.flaky ? 'flaky' : '', 'flaky')}
${card(String(run.skipped), 'skipped', '', 'skipped')}
${card(String(run.serverErrors.count), 'server-side errors', run.serverErrors.count ? 'failed' : '')}
${card(formatDuration(run.timing.avgMs), `avg test (min ${formatDuration(run.timing.minMs)}, max ${formatDuration(run.timing.maxMs)})`)}
</div>
${trends(runs)}
<h2>${outcomeIcon('failed')}Failures: ${c['product-bug']} product bug · ${c['test-automation-bug']} test automation bug · ${c['server-error']} server-side error</h2>
${table([{ text: 'Test' }, { text: 'Category' }, { text: 'Failure artifacts' }], failedRows)}
<h2>Suites</h2>
${table([{ text: 'Suite' }, { text: 'Passed', num: true, icon: 'passed' }, { text: 'Failed', num: true, icon: 'failed' }, { text: 'Flaky', num: true, icon: 'flaky' }, { text: 'Time', num: true }], suiteRows)}
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
