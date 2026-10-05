import { expect, type Page } from '@playwright/test';
import { log } from '../support/log';
import type { ItemType } from '../support/test-data';

const FLOW = 'ExportFlow';

export interface ExportedFile {
	path: string;
	content: string;
}

export interface ExportResult {
	status: number;
	ok: boolean;
	files: ExportedFile[];
	body: { message?: string } & Record<string, unknown>;
}

/**
 * Export to the `.claude` folder layout (Epic H). Hits the web proxy route
 * `/export/[itemType]/[id]` directly — the same manifest a direct API caller
 * gets from POST /api/v1/export, without depending on browser downloads (US-039).
 */
export class ExportFlow {
	constructor(private readonly page: Page) {}

	async exportItem(itemType: ItemType, id: string): Promise<ExportResult> {
		log.step(FLOW, `Exporting ${itemType} ${id}`);
		const res = await this.page.request.get(`/export/${itemType}/${id}`);
		const body = await res.json().catch(() => ({}));
		return { status: res.status(), ok: res.ok(), files: body.files ?? [], body };
	}

	/** Successful export producing exactly one file at the expected `.claude/...` path. */
	async exportSingleFile(itemType: ItemType, id: string, pathPattern: RegExp): Promise<ExportedFile> {
		const result = await this.exportItem(itemType, id);
		expect(result.ok).toBe(true);
		expect(Array.isArray(result.files)).toBe(true);
		expect(result.files).toHaveLength(1);
		expect(result.files[0].path).toMatch(pathPattern);
		log.ok(FLOW, `Exported ${result.files[0].path}`);
		return result.files[0];
	}

	/** A Workflow export bundling its command file plus every referenced Agent file. */
	async exportWorkflowBundle(id: string): Promise<{ commandFile: ExportedFile; agentFile: ExportedFile }> {
		const result = await this.exportItem('WORKFLOW', id);
		expect(result.ok).toBe(true);
		expect(result.files.length).toBeGreaterThanOrEqual(2);
		const commandFile = result.files.find((f) => f.path.includes('.claude/commands/'));
		const agentFile = result.files.find((f) => f.path.includes('.claude/agents/'));
		expect(commandFile).toBeTruthy();
		expect(agentFile).toBeTruthy();
		log.ok(FLOW, `Bundle: ${commandFile!.path} + ${agentFile!.path}`);
		return { commandFile: commandFile!, agentFile: agentFile! };
	}

	async expectForbidden(itemType: ItemType, id: string) {
		const result = await this.exportItem(itemType, id);
		expect(result.status).toBe(403);
		log.ok(FLOW, 'Export forbidden for non-owner');
	}

	/** US-035 AC4: exporting a Workflow whose step target was archived is rejected. */
	async expectDanglingStepRejection(workflowId: string) {
		const result = await this.exportItem('WORKFLOW', workflowId);
		expect(result.status).toBe(400);
		expect(result.body.message).toBe('dangling_step_reference');
		log.ok(FLOW, 'Rejected with dangling_step_reference');
	}
}
