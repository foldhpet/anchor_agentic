// Functional icon vocabulary (US-054, docs/STYLE-GUIDE.md section 5 "Icons"). Drawn by us, no library.
// 24px grid, stroked with currentColor; the shared attributes live in Icon.svelte.
//
// The Reporter keeps its own copy in e2e/core/reporter/icons.ts because core/ must not import from
// src/. src/lib/icons.test.ts fails if the two copies diverge, so change both together.

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
	/** Path data, one `d` per <path>. */
	paths: string[];
	/** Dash pattern for the first path only (quarantined: a dashed ring). */
	dash?: string;
}

export const ICONS: Record<IconName, IconShape> = {
	// circle with a tick
	passed: { paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M8 12.5l3 3 5-6'] },
	// diamond with a cross
	failed: { paths: ['M12 2.5l9.5 9.5-9.5 9.5L2.5 12z', 'M9 9l6 6M15 9l-6 6'] },
	// triangle with a bang
	flaky: { paths: ['M12 3.5l9 16H3z', 'M12 10v4M12 16.5h.01'] },
	// bare skip-forward mark
	skipped: { paths: ['M6 6l8 6-8 6z', 'M18 6v12'] },
	// dashed ring with a dot
	quarantined: {
		paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M12 12h.01'],
		dash: '2.83 2.83'
	},
	// two chain links
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
	// arrow leaving a box
	'external-link': {
		paths: ['M14 4h6v6M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5']
	},
	// heart
	support: {
		paths: ['M12 20.5s-8-4.7-8-10.2a4.3 4.3 0 0 1 8-2.7 4.3 4.3 0 0 1 8 2.7c0 5.5-8 10.2-8 10.2z']
	}
};
