import type { DomainStatus } from './api/types';

// Shared status-color mapping (US-048). Every page that shows a lifecycle
// status reuses this, so Draft/Published/UnderReview/Removed/Archived/
// Deprecated mean the same thing visually everywhere. Removed/Deprecated use
// a border rather than a solid fill — Orange only clears ~3:1 contrast,
// which isn't enough to sit behind small text.
//
// This only supplies the color classes — call sites keep their own exact
// text format (e.g. "[Draft]" in list rows vs. "Status: Draft" on detail
// pages), since e2e tests assert on those specific strings.
export const STATUS_STYLE: Record<DomainStatus, string> = {
	Draft: 'bg-surface text-ink/70',
	Published: 'bg-primary text-white',
	UnderReview: 'bg-caution text-ink',
	Removed: 'border border-attention text-ink/70',
	Archived: 'text-ink/50',
	Deprecated: 'border border-attention text-ink/70'
};
