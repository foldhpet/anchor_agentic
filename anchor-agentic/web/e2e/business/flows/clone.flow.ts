import type { ItemDetailPage } from '../pages/item-detail.page';
import { MarketplaceDetailPage } from '../pages/marketplace-detail.page';
import { MySandboxPage } from '../pages/my-sandbox.page';
import { log } from '../../core/log';
import type { UserSession } from './session.flow';

const FLOW = 'CloneFlow';

/** Cloning a Published item into another user's Sandbox (Epic E, US-020–US-022). */
export class CloneFlow {
	/**
	 * Another user opens the source item's Sandbox URL and clones it. Returns the
	 * cloned item's page so callers can assert on provenance / copied children.
	 */
	async cloneFromSandboxUrl<T extends ItemDetailPage>(
		cloner: UserSession,
		sourceUrl: string,
		createDetailPage: (page: UserSession['page']) => T
	): Promise<T> {
		log.step(FLOW, `Cloning ${sourceUrl} as another user`);
		await cloner.page.goto(sourceUrl);
		const detail = createDetailPage(cloner.page);
		await detail.waitForHydration();
		await detail.clone();
		await detail.expectStatus('Draft');
		await detail.expectClonedFrom();
		log.ok(FLOW, `Cloned to ${detail.url}`);
		return detail;
	}

	/** Clones from the item's public Marketplace page. */
	async cloneFromMarketplace(
		cloner: UserSession,
		itemType: 'AGENT' | 'SKILL' | 'WORKFLOW',
		id: string,
		routeSegment: 'agents' | 'skills' | 'workflows'
	) {
		log.step(FLOW, `Cloning ${itemType} ${id} from the Marketplace`);
		const detail = new MarketplaceDetailPage(cloner.page);
		await detail.open(itemType, id);
		await detail.expectCloneAvailable();
		await detail.cloneIntoSandbox(routeSegment);
		log.ok(FLOW, `Cloned to ${cloner.page.url()}`);
	}

	/** The source owner sees its clone counter go up. */
	async expectCloneCount(owner: ItemDetailPage, sourceUrl: string, times: number) {
		await owner.goto(sourceUrl);
		await owner.expectCloneCount(times);
		log.ok(FLOW, `Source shows "Cloned ${times} times"`);
	}

	/** US-055 Part C: the landing page confirms the clone once; a reload no longer shows it. */
	async cloneAndExpectConfirmationOnce<T extends ItemDetailPage>(
		cloner: UserSession,
		itemType: 'AGENT' | 'SKILL' | 'WORKFLOW',
		id: string,
		routeSegment: 'agents' | 'skills' | 'workflows',
		landing: (page: UserSession['page']) => T
	): Promise<T> {
		log.step(FLOW, `Cloning ${itemType} ${id} and checking the confirmation`);
		await this.cloneFromMarketplace(cloner, itemType, id, routeSegment);
		const cloned = landing(cloner.page);
		await cloned.expectClonedConfirmation();
		await cloned.reload();
		await cloned.expectNoClonedConfirmation();
		log.ok(FLOW, 'Confirmation shown once');
		return cloned;
	}

	/** US-055 Part C: two rapid clicks on Clone create exactly one copy in My Sandbox. */
	async doubleClickCreatesOneCopy<T extends ItemDetailPage>(
		cloner: UserSession,
		itemType: 'AGENT' | 'SKILL' | 'WORKFLOW',
		id: string,
		routeSegment: 'agents' | 'skills' | 'workflows',
		landing: (page: UserSession['page']) => T,
		itemName: string
	) {
		log.step(FLOW, `Double-clicking Clone on ${itemType} ${id}`);
		const detail = new MarketplaceDetailPage(cloner.page);
		await detail.open(itemType, id);
		await detail.expectCloneAvailable();
		await detail.doubleClickClone(routeSegment);
		const cloned = landing(cloner.page);
		await cloned.expectClonedConfirmation();
		await cloned.followClonedConfirmationToSandbox();

		await new MySandboxPage(cloner.page).expectItemCount(itemName, 1);
		log.ok(FLOW, `My Sandbox holds exactly one "${itemName}"`);
	}
}
