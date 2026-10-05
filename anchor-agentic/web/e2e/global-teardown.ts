import { deleteTrackedUsers } from './business/support/personas';
import { hasLiveSupabase } from './business/support/test-data';

/** Deletes every user this run created (personas + UI-registered auth-test users). */
export default async function globalTeardown() {
	if (!hasLiveSupabase) return;
	await deleteTrackedUsers();
}
