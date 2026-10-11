import type { DomainStatus } from './api/types';
import type { IconName } from './icons';

// Shared status mapping (US-048, US-054). Every page that shows a lifecycle status reuses this, so
// Draft/Published/UnderReview/Removed/Archived/Deprecated mean the same thing visually everywhere:
// the colour classes AND the icon. Removed/Deprecated use a border rather than a solid fill: Orange
// only clears ~3:1 contrast, which isn't enough to sit behind small text.
//
// Icons follow the outcome mapping in docs/STYLE-GUIDE.md section 2 (Draft=quarantined,
// Published=passed, UnderReview=flaky, Removed/Deprecated=failed, Archived=skipped). The icon takes the
// text colour of the badge (currentColor). Secondary text is ink/75 or stronger (5.12:1 on bg), never
// ink/70 or paler: those fail AA for small text.
//
// This only supplies classes and an icon name: call sites keep their own exact text format (e.g.
// "[Draft]" in list rows vs. "Status: Draft" on detail pages), since e2e tests assert on those strings.
export interface StatusStyle {
	classes: string;
	icon: IconName;
}

export const STATUS_STYLE: Record<DomainStatus, StatusStyle> = {
	Draft: { classes: 'bg-surface text-ink/75', icon: 'quarantined' },
	Published: { classes: 'bg-primary text-white', icon: 'passed' },
	UnderReview: { classes: 'bg-caution text-ink', icon: 'flaky' },
	Removed: { classes: 'border border-attention text-ink/75', icon: 'failed' },
	Archived: { classes: 'text-ink/75', icon: 'skipped' },
	Deprecated: { classes: 'border border-attention text-ink/75', icon: 'failed' }
};
