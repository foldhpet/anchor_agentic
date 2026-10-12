// US-055: one-shot "just cloned" flag. A cookie (not a ?cloned=1 URL parameter) so the redirect
// target stays exactly the new item's detail URL.
import type { Cookies } from '@sveltejs/kit';

const NAME = 'cloned_item';

export function setClonedFlash(cookies: Cookies, itemId: string): void {
	cookies.set(NAME, itemId, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 });
}

/** True once, right after a clone redirected to this item; the flag is consumed. */
export function takeClonedFlash(cookies: Cookies, itemId: string): boolean {
	const match = cookies.get(NAME) === itemId;
	if (match) cookies.delete(NAME, { path: '/' });
	return match;
}
