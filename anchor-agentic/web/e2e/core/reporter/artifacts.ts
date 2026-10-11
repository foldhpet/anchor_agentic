import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

/** What Playwright attaches to a result; only the fields we read. */
export interface AttachmentLike {
	name: string;
	path?: string;
}

/** Large and rarely needed to understand a failure; skipped to keep the reports folder small. */
const SKIPPED_ATTACHMENTS = new Set(['video']);

/** A filesystem-safe folder name for a run id (an ISO timestamp) or a test key. */
export function slug(text: string, max = 80): string {
	return (
		text
			.replace(/[^A-Za-z0-9._-]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, max) || 'x'
	);
}

/**
 * Copies a failed attempt's screenshot, trace and page snapshot out of Playwright's test-results
 * folder (which the next run wipes) into `<reportsDir>/artifacts/<run>/<test>/`. Returns the
 * copied files as paths relative to `reportsDir`, with forward slashes, for linking from reports.
 */
export function copyAttemptArtifacts(
	attachments: AttachmentLike[],
	opts: { reportsDir: string; runId: string; testKey: string; attempt: number }
): string[] {
	const relDir = ['artifacts', slug(opts.runId), slug(opts.testKey)].join('/');
	const copied: string[] = [];
	for (const attachment of attachments) {
		if (
			!attachment.path ||
			SKIPPED_ATTACHMENTS.has(attachment.name) ||
			!existsSync(attachment.path)
		) {
			continue;
		}
		const extension = extname(attachment.path) || extname(basename(attachment.path));
		const name = `attempt${opts.attempt}-${slug(attachment.name, 40)}${extension}`;
		mkdirSync(join(opts.reportsDir, relDir), { recursive: true });
		copyFileSync(attachment.path, join(opts.reportsDir, relDir, name));
		copied.push(`${relDir}/${name}`);
	}
	return copied;
}

/** Deletes artifact folders of runs that are no longer among the ones to keep. */
export function pruneArtifacts(reportsDir: string, keepRunIds: string[]) {
	const root = join(reportsDir, 'artifacts');
	if (!existsSync(root)) return;
	const keep = new Set(keepRunIds.map((id) => slug(id)));
	for (const name of readdirSync(root)) {
		if (!keep.has(name)) rmSync(join(root, name), { recursive: true, force: true });
	}
}
