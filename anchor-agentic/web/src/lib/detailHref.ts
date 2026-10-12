import { resolve } from '$app/paths';
import type { LibraryItemType } from './api/types';
import type { SandboxOrigin } from './backLink';

/**
 * Link to an item's own page. With `origin`, `?from=` lets the item page link back to the list the
 * user came from (see backLink). Every branch goes through resolve(), including its query form.
 */
export function detailHref(type: LibraryItemType, id: string, origin?: SandboxOrigin) {
	switch (type) {
		case 'ROLE':
			return origin
				? resolve(`/roles/[id]?from=${origin}` as const, { id })
				: resolve('/roles/[id]', { id });
		case 'TASK':
			return origin
				? resolve(`/tasks/[id]?from=${origin}` as const, { id })
				: resolve('/tasks/[id]', { id });
		case 'AGENT':
			return origin
				? resolve(`/agents/[id]?from=${origin}` as const, { id })
				: resolve('/agents/[id]', { id });
		case 'SKILL':
			return origin
				? resolve(`/skills/[id]?from=${origin}` as const, { id })
				: resolve('/skills/[id]', { id });
		case 'WORKFLOW':
			return origin
				? resolve(`/workflows/[id]?from=${origin}` as const, { id })
				: resolve('/workflows/[id]', { id });
	}
}
