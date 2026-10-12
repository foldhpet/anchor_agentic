import { expect, type Locator } from '@playwright/test';
import { AnchorBasePage } from './anchor-base.page';

/** `/library/all` — read-only listing of every user's items, searchable. */
export class AllSandboxPage extends AnchorBasePage {
	async open(query?: string) {
		await this.goto(query ? `/library/all?q=${encodeURIComponent(query)}` : '/library/all');
	}

	resultLink(name: string): Locator {
		return this.page.getByRole('link', { name });
	}

	async expectResult(name: string) {
		await expect(this.resultLink(name)).toBeVisible();
	}

	/** US-056: `total` rows carry this name (the original and its copy), and `cloned` of them are tagged. */
	async expectRowsWithClonedTags(name: string, expected: { total: number; cloned: number }) {
		const rows = this.page.locator('li', { hasText: name });
		await expect(rows).toHaveCount(expected.total);
		await expect(rows.getByText('Cloned', { exact: true })).toHaveCount(expected.cloned);
	}

	/** The listing is plain links/text — no per-item edit/delete forms or owner buttons. */
	async expectNoEditControls() {
		await expect(this.page.locator('ul form')).toHaveCount(0);
		await expect(this.page.getByRole('button', { name: 'Save' })).toHaveCount(0);
		await expect(this.page.getByRole('button', { name: 'Archive' })).toHaveCount(0);
	}
}
