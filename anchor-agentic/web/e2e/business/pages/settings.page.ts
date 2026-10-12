import { AnchorBasePage } from './anchor-base.page';

/** `/settings` — Account Settings. */
export class SettingsPage extends AnchorBasePage {
	async open() {
		await this.goto('/settings');
	}
}
