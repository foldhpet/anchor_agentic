import { optionalApiRequest, type OptionalResult } from './client';
import type { Provenance, VersionSnapshot } from './types';

// The parts of an item detail page that are nice to have but must never stop the page from
// rendering (or from refreshing after a form action): version history and clone provenance.

type Options = { accessToken?: string | null; fetchFn?: typeof fetch };
type VersionedType = 'ROLE' | 'TASK' | 'AGENT' | 'SKILL' | 'WORKFLOW';

export function loadVersions(
	itemType: VersionedType,
	id: string,
	page: number,
	pageSize: number,
	options: Options
): Promise<OptionalResult<{ versions: VersionSnapshot[]; total: number }>> {
	return optionalApiRequest(
		`/api/v1/library/${itemType}/${id}/versions?page=${page}&pageSize=${pageSize}`,
		options,
		{ versions: [], total: 0 }
	);
}

export function loadProvenance(
	itemType: VersionedType,
	id: string,
	options: Options
): Promise<OptionalResult<{ provenance: Provenance | null; cloneCount: number }>> {
	return optionalApiRequest(`/api/v1/clone/${itemType}/${id}`, options, {
		provenance: null,
		cloneCount: 0
	});
}

/** Names of the optional parts that could not be loaded, for the page's notice. */
export function degradedParts(parts: {
	versions?: OptionalResult<unknown>;
	provenance?: OptionalResult<unknown>;
}) {
	const missing: string[] = [];
	if (parts.versions?.failed) missing.push('version history');
	if (parts.provenance?.failed) missing.push('clone details');
	return missing;
}
