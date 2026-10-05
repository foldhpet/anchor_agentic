import type { Page } from '@playwright/test';
import { AllSandboxPage } from '../pages/all-sandbox.page';
import { LegacyAllSandboxPage, LegacySandboxPage } from '../pages/legacy-sandbox.page';
import { MySandboxPage } from '../pages/my-sandbox.page';
import type { RoleDetailPage } from '../pages/role.page';
import { SkillDetailPage } from '../pages/skill.page';
import { TaskDetailPage } from '../pages/task.page';
import { log } from '../support/log';
import type { UserSession } from './session.flow';

const FLOW = 'SandboxFlow';

/** Working in My Sandbox / All Sandbox: grouping, archiving, versions, read-only access (Epic D). */
export class SandboxFlow {
	readonly mine: MySandboxPage;
	readonly all: AllSandboxPage;

	constructor(private readonly page: Page) {
		this.mine = new MySandboxPage(page);
		this.all = new AllSandboxPage(page);
	}

	/** US-014: all five types are grouped, each starting out as a Draft. */
	async expectLibraryGroupedWithDrafts(items: string[]) {
		log.step(FLOW, 'Reviewing My Sandbox grouping');
		await this.mine.open();
		await this.mine.expectGroups('Roles', 'Tasks', 'Agents', 'Skills', 'Workflows');
		for (const name of items) await this.mine.expectItemStatus(name, 'Draft');
		log.ok(FLOW, 'All items grouped and Draft');
	}

	async expectItemStatusInLibrary(name: string, status: 'Draft' | 'Published' | 'Archived') {
		await this.mine.open();
		await this.mine.expectItemStatus(name, status);
	}

	/** US-016: archive, confirm read-only, then hidden by default and revealed by "Show archived". */
	async archiveTaskAndVerifyHidden(taskUrl: string, taskName: string) {
		log.step(FLOW, `Archiving Task "${taskName}"`);
		const task = new TaskDetailPage(this.page);
		await task.goto(taskUrl);
		await task.archive();
		await task.expectArchivedReadOnly();

		await this.mine.open();
		await this.mine.expectItemHidden(taskName);
		await this.mine.showArchived();
		await this.mine.expectArchivedItemShown(taskName);
		log.ok(FLOW, 'Archived Task hidden by default, shown on demand');
	}

	/** US-017–019: every save records a version; viewing an old one leaves the live form untouched. */
	async saveRevisionsAndInspectHistory(role: RoleDetailPage, revisions: string[]) {
		log.step(FLOW, `Saving ${revisions.length} revisions`);
		for (const text of revisions) await role.saveDescription(text);
		// The create itself already recorded one snapshot.
		await role.expectVersionCount(revisions.length + 1);

		await role.openOldestVersion();
		await role.expectDescription(revisions[revisions.length - 1]);
		await role.closeVersionSnapshot();
		log.ok(FLOW, 'Version history intact; live state unchanged');
	}

	/** US-015: another user finds a Skill via All Sandbox and sees only read-only controls. */
	async expectReadOnlyAcrossUsers(viewer: UserSession, itemName: string, itemUrl: string) {
		log.step(FLOW, `Viewer searching All Sandbox for "${itemName}"`);
		const all = new AllSandboxPage(viewer.page);
		await all.open(itemName);
		await all.expectResult(itemName);
		await all.expectNoEditControls();

		await viewer.page.goto(itemUrl);
		await new SkillDetailPage(viewer.page).expectReadOnly();
		log.ok(FLOW, 'Viewer has read-only access');
	}

	/** US-004: a non-owner's edit attempt on the generic Sandbox is rejected with 403/"Forbidden". */
	async nonOwnerCannotEdit(owner: UserSession, viewer: UserSession, title: string) {
		log.step(FLOW, `Owner creating "${title}"; viewer attempting an edit`);
		const ownerSandbox = new LegacySandboxPage(owner.page);
		await ownerSandbox.open();
		await ownerSandbox.createItem(title);

		const viewerAll = new LegacyAllSandboxPage(viewer.page);
		await viewerAll.open();
		await viewerAll.expectItemListed(title);
		await viewerAll.attemptForbiddenEdit(title);
		log.ok(FLOW, 'Edit rejected with Forbidden');
	}
}
