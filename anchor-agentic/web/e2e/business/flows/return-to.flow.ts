import { expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { MarketplaceDetailPage } from '../pages/marketplace-detail.page';
import { MarketplacePage, type MarketplaceQuery } from '../pages/marketplace.page';
import { MySandboxPage } from '../pages/my-sandbox.page';
import { RegisterPage } from '../pages/register.page';
import { log } from '../../core/log';
import { readPersonas, trackCreatedEmail, type Persona } from '../support/personas';
import { acceptedTargets, DUPLICATE_NEXT, REJECTED_TARGETS } from '../support/return-to-data';
import { newIdentity, type ItemType } from '../support/test-data';

const FLOW = 'ReturnToFlow';

/** Returning to the page the visitor was on after logging in or registering (US-057). */
export class ReturnToFlow {
	private readonly login: LoginPage;
	private readonly register: RegisterPage;
	private readonly detail: MarketplaceDetailPage;
	private readonly listing: MarketplacePage;

	constructor(private readonly page: Page) {
		this.login = new LoginPage(page);
		this.register = new RegisterPage(page);
		this.detail = new MarketplaceDetailPage(page);
		this.listing = new MarketplacePage(page);
	}

	/** Logs in on the open /login page as a shared persona (a real sign-in). */
	private async submitCredentialsOf(persona: Persona) {
		const { email, password } = readPersonas()[persona];
		await this.login.waitForHydration();
		await this.login.fillAndSubmit(email, password);
	}

	/**
	 * Item page -> notice "Log in" -> log in -> back on that exact item page as a plain view: the Clone
	 * button is still unused and My Sandbox holds no copy (nothing was cloned or replayed).
	 */
	async logInFromItemNoticeAndLandBack(
		itemType: ItemType,
		id: string,
		itemName: string,
		persona: Persona
	) {
		const itemPath = `/marketplace/${itemType}/${id}`;
		log.step(FLOW, `Anonymous visitor on ${itemPath} follows the notice's Log in link`);
		await this.detail.open(itemType, id);
		await this.detail.expectAnonymousNotice();
		await this.detail.followNoticeLogInLink();

		await this.submitCredentialsOf(persona);
		await this.login.expectPathAndQuery(itemPath);
		await this.login.expectLoggedIn();
		await this.detail.expectCloneAvailable();

		await new MySandboxPage(this.page).open();
		await new MySandboxPage(this.page).expectItemCount(itemName, 0);
		log.ok(FLOW, `Back on ${itemPath}, logged in, and nothing was cloned`);
	}

	/** Item page -> notice "Register" -> register a throwaway account -> back on that item page. */
	async registerFromItemNoticeAndLandBack(itemType: ItemType, id: string, tag: string) {
		const itemPath = `/marketplace/${itemType}/${id}`;
		log.step(FLOW, `Anonymous visitor on ${itemPath} follows the notice's Register link`);
		await this.detail.open(itemType, id);
		await this.detail.expectAnonymousNotice();
		await this.detail.followNoticeRegisterLink();

		const identity = newIdentity(tag);
		trackCreatedEmail(identity.email);
		await this.register.waitForHydration();
		await this.register.fillAndSubmit(identity.username, identity.email, identity.password);
		await this.register.expectPathAndQuery(itemPath);
		await this.register.expectLoggedIn();
		await this.detail.expectCloneAvailable();
		log.ok(FLOW, `Registered ${identity.email} and came back to ${itemPath}`);
	}

	/** Filtered Marketplace list -> nav "Log in" -> log in -> exactly that list URL, every parameter kept. */
	async logInFromFilteredListAndLandBack(
		query: MarketplaceQuery,
		itemName: string,
		persona: Persona
	) {
		const listUrl = `/?${new URLSearchParams(query as Record<string, string>).toString()}`;
		log.step(FLOW, `Anonymous visitor on ${listUrl} uses the nav Log in link`);
		await this.listing.open(query);
		await this.listing.expectPathAndQuery(listUrl);
		await this.listing.expectListed(itemName);
		await this.listing.expectNavAuthLinksCarry(listUrl);
		await this.listing.followNavLogInLink(listUrl);

		await this.submitCredentialsOf(persona);
		await this.listing.expectPathAndQuery(listUrl);
		await this.listing.expectLoggedIn();
		await this.listing.expectListed(itemName);
		log.ok(FLOW, `Back on ${listUrl} with q, type and page intact`);
	}

	/** US-058: a sorted list -> nav "Log in" -> back on the same URL with the sort still chosen. */
	async logInFromSortedListAndLandBack(
		query: MarketplaceQuery & { sort: string },
		itemName: string,
		persona: Persona,
		sortLabel: string
	) {
		await this.logInFromFilteredListAndLandBack(query, itemName, persona);
		await this.listing.expectSortSelected(sortLabel);
		await this.listing.expectSortedBySummary(sortLabel);
		log.ok(FLOW, `Sort "${sortLabel}" survived the login round trip`);
	}

	/** Guarded URL as anonymous -> /login?reason=sandbox&next=... (banner shown) -> log in -> that URL. */
	async logInAfterGuardRedirectAndLandBack(guardedPath: string, persona: Persona) {
		const redirect = `/login?reason=sandbox&next=${encodeURIComponent(guardedPath)}`;
		log.step(FLOW, `Anonymous visitor requests the guarded ${guardedPath}`);
		await this.login.goto(guardedPath);
		await this.login.expectPathAndQuery(redirect);
		await this.login.expectSandboxReasonBanner();

		await this.submitCredentialsOf(persona);
		await this.login.expectPathAndQuery(guardedPath);
		await this.login.expectLoggedIn();
		log.ok(FLOW, `Guard redirected to ${redirect}; login returned to ${guardedPath}`);
	}

	/** A wrong password keeps the target on the page; the right one then lands on it. */
	async failedLogInKeepsTarget(target: string, persona: Persona) {
		log.step(FLOW, `Logging in with a wrong password from /login?next=${target}`);
		await this.login.openWithTarget(target);
		await this.login.fillAndSubmit(readPersonas()[persona].email, `wrong-${Date.now()}-password`);
		await this.login.expectInvalidCredentialsError();
		await this.login.expectPathAndQuery(`/login?next=${encodeURIComponent(target)}`);
		await this.login.expectRegisterLinkCarries(target);
		log.warn(FLOW, 'Wrong password rejected, target still carried; retrying with the right one');

		await this.submitCredentialsOf(persona);
		await this.login.expectPathAndQuery(target);
		await this.login.expectLoggedIn();
		log.ok(FLOW, `Second attempt landed on ${target}`);
	}

	/** Log in <-> Register links keep a valid target; invalid or missing targets add none; nav adds none. */
	async switchingFormsKeepsTarget(target: string) {
		log.step(FLOW, `Switching between the forms with next=${target}`);
		await this.login.openWithTarget(target);
		await this.login.expectRegisterLinkCarries(target);
		await this.login.expectNavAuthLinksWithoutTarget();
		await this.login.followRegisterLink(target);

		await this.register.waitForHydration();
		await this.register.expectLogInLinkCarries(target);
		await this.register.expectNavAuthLinksWithoutTarget();
		await this.register.followLogInLink(target);

		await this.login.openWithTarget('//evil.example');
		await this.login.expectRegisterLinkCarries(null);
		await this.register.openWithTarget('//evil.example');
		await this.register.expectLogInLinkCarries(null);
		log.ok(FLOW, 'Valid target travels both ways; the nav and rejected targets add none');
	}

	/**
	 * With one signed-in session, /login and /register redirect straight to the validated target:
	 * accepted values exactly, every rejected value to the app's own "/".
	 */
	async expectLoggedInRedirectsFollowTheValidator(itemPath: string) {
		const appOrigin = (await this.login.finalUrlOf('/')).origin;
		const pages = [this.login, this.register];

		log.step(FLOW, `Checking ${acceptedTargets(itemPath).length} accepted targets`);
		for (const target of acceptedTargets(itemPath)) {
			for (const page of pages) {
				const final = await page.finalUrlWhenLoggedIn(`next=${encodeURIComponent(target)}`);
				expect(final.origin, `origin for accepted ${JSON.stringify(target)}`).toBe(appOrigin);
				expect(`${final.pathname}${final.search}`, `accepted ${JSON.stringify(target)}`).toBe(
					target
				);
			}
		}

		log.step(FLOW, `Checking ${REJECTED_TARGETS.length} rejected targets`);
		for (const target of REJECTED_TARGETS) {
			for (const page of pages) {
				const final = await page.finalUrlWhenLoggedIn(`next=${encodeURIComponent(target)}`);
				const label = `rejected ${JSON.stringify(target).slice(0, 60)}`;
				expect(final.origin, `origin for ${label}`).toBe(appOrigin);
				expect(final.pathname, `path for ${label}`).toBe('/');
			}
		}

		for (const page of pages) {
			const final = await page.finalUrlWhenLoggedIn(DUPLICATE_NEXT.query);
			expect(final.origin).toBe(appOrigin);
			expect(final.pathname, 'only the first next counts').toBe(DUPLICATE_NEXT.landsOn);
		}
		log.ok(
			FLOW,
			'Accepted targets kept exactly; every rejected one fell back to "/" on our origin'
		);
	}
}
