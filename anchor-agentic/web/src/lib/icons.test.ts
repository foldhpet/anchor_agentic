import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	GLYPH,
	ICON_NAMES as REPORTER_NAMES,
	ICONS as REPORTER_ICONS
} from '../../e2e/core/reporter/icons.ts';
import { ICON_NAMES, ICONS } from './icons';

// The Reporter keeps a copy of the path data because core/ must not import from src/. This test (which
// may point downward into e2e/core) is what keeps the two copies identical.
describe('icon vocabulary', () => {
	it('has the fixed US-054 vocabulary in both the web app and the Reporter', () => {
		const vocabulary = [
			'passed',
			'failed',
			'flaky',
			'skipped',
			'quarantined',
			'connected',
			'new',
			'next',
			'previous',
			'external-link',
			'support'
		];
		expect([...ICON_NAMES].sort()).toEqual([...vocabulary].sort());
		expect([...REPORTER_NAMES].sort()).toEqual([...vocabulary].sort());
		expect(Object.keys(ICONS).sort()).toEqual([...vocabulary].sort());
		expect(Object.keys(GLYPH).sort()).toEqual([...vocabulary].sort());
	});

	it('draws every icon identically in the web app and the Reporter', () => {
		for (const name of ICON_NAMES) expect(REPORTER_ICONS[name], name).toEqual(ICONS[name]);
	});

	it('Icon.svelte carries the required SVG attributes and hides itself from assistive tech', () => {
		const source = readFileSync(new URL('./Icon.svelte', import.meta.url), 'utf-8');
		for (const attr of [
			'viewBox="0 0 24 24"',
			'fill="none"',
			'stroke="currentColor"',
			'stroke-width="1.5"',
			'stroke-linecap="round"',
			'stroke-linejoin="round"',
			'aria-hidden="true"',
			'focusable="false"',
			'size-[1em]'
		])
			expect(source, attr).toContain(attr);
		expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
	});

	it('no icon path data contains a colour value', () => {
		for (const name of ICON_NAMES)
			for (const d of ICONS[name].paths)
				expect(d, name).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
	});
});
