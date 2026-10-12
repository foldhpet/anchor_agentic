import { expect, type Page } from '@playwright/test';
import type { ItemDetailPage } from '../pages/item-detail.page';
import { AuthoringFlow } from './authoring.flow';
import { log } from '../../core/log';

const FLOW = 'PublishFlow';

/** Publishing a Draft item to the Marketplace (Epic C, plus Epic J quality gates). */
export class PublishFlow {
	constructor(private readonly page: Page) {}

	/** Publishes and asserts success; returns the item's URL for later cross-user visits. */
	async publishItem(detail: ItemDetailPage): Promise<string> {
		log.step(FLOW, `Publishing ${detail.url}`);
		await detail.publish();
		await detail.expectPublishedVersion();
		log.ok(FLOW, 'Published');
		return this.page.url();
	}

	/** Creates a Skill that passes the quality gates and publishes it; returns what browsers need to find it. */
	async publishNewSkill(name: string): Promise<{ id: string; name: string }> {
		const skill = await new AuthoringFlow(this.page).createSkill(name);
		await this.publishItem(skill);
		return { id: skill.currentId, name };
	}

	/** Publish attempt that is expected to be blocked by a publish-time gate. */
	async publishExpectingRejection(detail: ItemDetailPage, errorCode: string | RegExp) {
		log.step(FLOW, `Publishing ${detail.url} (expecting rejection)`);
		await detail.publish();
		await expect(this.page.getByRole('alert')).toContainText(errorCode);
		log.ok(FLOW, `Rejected as expected: ${errorCode}`);
	}
}
