import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { formatReport } from './format.ts';
import { historyStats } from './history.ts';
import { renderHtml } from './html.ts';
import { GLYPH, ICON_NAMES, ICONS, iconSvg } from './icons.ts';
import { renderMarkdown } from './markdown.ts';
import { warningText } from './quarantine-prompt.ts';
import { summarizeRun, type TestRecord } from './summary.ts';
import { log } from '../log.ts';

const coreDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Emoji presentation, the variation selector that forces it, and the joiner used in emoji sequences.
const EMOJI = new RegExp(
	[String.fromCharCode(92) + 'p{Emoji_Presentation}', '️', '‍'].join('|'),
	'u'
);

const rec = (title: string, over: Partial<TestRecord> = {}): TestRecord => ({
	key: `a.spec.ts > ${title}`,
	title,
	suite: 'a.spec.ts',
	status: 'passed',
	durationMs: 1000,
	...over
});

/** A run containing every outcome, including a quarantined failure and a failing requirement. */
const everyOutcome = () =>
	summarizeRun(
		[
			rec('good', { requirements: ['US-001'] }),
			rec('wobbly', { status: 'flaky', requirements: ['US-002'], error: 'x' }),
			rec('broken', { status: 'failed', requirements: ['US-003'], error: 'Received: 500' }),
			rec('parked', { status: 'failed', error: 'x' }),
			rec('later', { status: 'skipped' })
		],
		{ id: 'r1', startedAt: '2026-01-01T00:00:00.000Z', durationMs: 5000 },
		{
			serverErrors: { count: 1, samples: [{ method: 'GET', path: '/api/x', error: 'boom' }] },
			quarantinedKeys: new Set(['a.spec.ts > parked'])
		}
	);

describe('Reporter icons', () => {
	it('every icon is a stroked, currentColor, round 24px SVG with no hard-coded colour', () => {
		for (const name of ICON_NAMES) {
			const svg = iconSvg(name);
			for (const attr of [
				'viewBox="0 0 24 24"',
				'fill="none"',
				'stroke="currentColor"',
				'stroke-width="1.5"',
				'stroke-linecap="round"',
				'stroke-linejoin="round"',
				'aria-hidden="true"',
				'focusable="false"'
			])
				expect(svg, name).toContain(attr);
			expect(svg, name).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|https?:/i);
			expect(ICONS[name].paths.length, name).toBeGreaterThan(0);
		}
	});

	it('every outcome has its own glyph and its own shape', () => {
		const outcomes = ['passed', 'failed', 'flaky', 'skipped', 'quarantined'] as const;
		expect(new Set(outcomes.map((o) => GLYPH[o])).size).toBe(outcomes.length);
		expect(new Set(outcomes.map((o) => ICONS[o].paths.join('|'))).size).toBe(outcomes.length);
		expect(Object.keys(GLYPH).sort()).toEqual([...ICON_NAMES].sort());
	});

	it('no emoji and no U+FE0F in the glyph tier, the HTML, the Markdown or the terminal output', () => {
		for (const glyph of Object.values(GLYPH)) expect(glyph).not.toMatch(EMOJI);

		const run = everyOutcome();
		const history = historyStats([run]);
		const pending = [{ key: 'k', title: 'wobbly', flakyRuns: 3, window: 10 }];
		const outputs = {
			html: renderHtml([run], { tests: [], pending, decisions: [] }),
			markdown: renderMarkdown(run, history, pending),
			terminal: formatReport(run, history),
			prompt: warningText(pending[0])
		};
		for (const [name, text] of Object.entries(outputs)) expect(text, name).not.toMatch(EMOJI);
		// every outcome is visible in each text surface as glyph plus word
		for (const name of ['markdown', 'terminal'] as const)
			for (const o of ['passed', 'failed', 'flaky', 'skipped'] as const)
				expect(outputs[name], `${name} ${o}`).toContain(GLYPH[o]);
		expect(outputs.html).toContain('<svg class="icon');
	});

	it('the HTML report is self-contained: inline SVG, no external request', () => {
		const run = everyOutcome();
		const html = renderHtml([run], { tests: [], pending: [], decisions: [] });
		expect(html).toMatch(/<svg class="icon/);
		expect(html).not.toMatch(/https?:\/\/(?!localhost)|<link|<img|@font-face|@import|url\(/);
	});

	it('the console logger uses glyphs, not emoji, for step, ok, warn and fail', () => {
		const lines: string[] = [];
		const spies = (['log', 'warn', 'error'] as const).map((m) =>
			vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.join(' ')))
		);
		try {
			log.step('F', 'a');
			log.ok('F', 'b');
			log.warn('F', 'c');
			log.fail('F', 'd');
		} finally {
			spies.forEach((s) => s.mockRestore());
		}
		expect(lines).toHaveLength(4);
		for (const line of lines) expect(line).not.toMatch(EMOJI);
	});
});

describe('core import boundary', () => {
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((entry) => {
			const path = join(dir, entry);
			return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
		});

	it('nothing in e2e/core imports from src/ or e2e/business', () => {
		const specifier = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
		for (const file of files(coreDir)) {
			const source = readFileSync(file, 'utf-8');
			for (const [, spec] of source.matchAll(specifier)) {
				if (spec.startsWith('.')) {
					const target = resolve(dirname(file), spec);
					expect(target.startsWith(coreDir), `${file} imports ${spec}`).toBe(true);
				} else {
					expect(spec, file).not.toMatch(/^(\$lib|src\/|\$app|\$env)/);
				}
			}
		}
	});
});
