export type SandboxOrigin = 'mine' | 'all';

const BACK: Record<SandboxOrigin, { href: string; label: string }> = {
	mine: { href: '/library', label: 'My Sandbox' },
	all: { href: '/library/all', label: 'All Sandbox' }
};

/** Appends the sandbox origin to a detail link so the detail page can link back to where the user came from. */
export function withOrigin(href: string, origin: SandboxOrigin): string {
	return `${href}?from=${origin}`;
}

/** Back target for a detail page; falls back to the viewer's relationship to the item when `from` is absent/invalid. */
export function backLink(from: string | null, isOwner: boolean) {
	const origin: SandboxOrigin = from === 'mine' || from === 'all' ? from : isOwner ? 'mine' : 'all';
	return BACK[origin];
}
