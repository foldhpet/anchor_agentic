// Functional icons for the report (US-054, docs/STYLE-GUIDE.md section 5 "Icons" and section 7).
//
// Self-contained on purpose: core/ must not import from src/ or e2e/business, so the path data is a
// copy of src/lib/icons.ts. src/lib/icons.test.ts fails if the two diverge; change both together.

export const ICON_NAMES = [
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
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export interface IconShape {
	paths: string[];
	/** Dash pattern for the first path only (quarantined: a dashed ring). */
	dash?: string;
}

export const ICONS: Record<IconName, IconShape> = {
	passed: { paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M8 12.5l3 3 5-6'] },
	failed: { paths: ['M12 2.5l9.5 9.5-9.5 9.5L2.5 12z', 'M9 9l6 6M15 9l-6 6'] },
	flaky: { paths: ['M12 3.5l9 16H3z', 'M12 10v4M12 16.5h.01'] },
	skipped: { paths: ['M6 6l8 6-8 6z', 'M18 6v12'] },
	quarantined: {
		paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M12 12h.01'],
		dash: '2.83 2.83'
	},
	connected: {
		paths: [
			'M10 7.5l1-1a4 4 0 0 1 5.7 5.7l-1 1',
			'M14 16.5l-1 1a4 4 0 0 1-5.7-5.7l1-1',
			'M9.5 14.5l5-5'
		]
	},
	new: { paths: ['M12 5v14M5 12h14'] },
	next: { paths: ['M9 5l7 7-7 7'] },
	previous: { paths: ['M15 5l-7 7 7 7'] },
	'external-link': {
		paths: ['M14 4h6v6M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5']
	},
	support: {
		paths: ['M12 20.5s-8-4.7-8-10.2a4.3 4.3 0 0 1 8-2.7 4.3 4.3 0 0 1 8 2.7c0 5.5-8 10.2-8 10.2z']
	}
};

/**
 * Inline SVG for one icon. Always aria-hidden: it sits beside the outcome word, which carries the
 * meaning. The class comes first so charts (which start with `<svg viewBox`) stay distinguishable.
 */
export function iconSvg(name: IconName, className = ''): string {
	const { paths, dash } = ICONS[name];
	const body = paths
		.map((d, i) => `<path d="${d}"${i === 0 && dash ? ` stroke-dasharray="${dash}"` : ''}/>`)
		.join('');
	return `<svg class="icon${className ? ` ${className}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * Monochrome text glyphs for Markdown and the terminal: plain Unicode symbols with text
 * presentation (no emoji, no U+FE0F), one per icon. Always printed with the outcome word.
 */
export const GLYPH: Record<IconName, string> = {
	passed: '✓',
	failed: '✗',
	flaky: '≈',
	skipped: '»',
	quarantined: '○',
	connected: '⇄',
	new: '+',
	next: '›',
	previous: '‹',
	'external-link': '⇗',
	support: '♡'
};

/** Glyph followed by the outcome word, e.g. `✓ passed`. */
export const withGlyph = (name: IconName, word: string): string => `${GLYPH[name]} ${word}`;
