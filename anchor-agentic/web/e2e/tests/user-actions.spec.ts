import { expect, test, type Page } from '@playwright/test';
import { UserActions } from '../core/user-actions';

// Exercises the application-independent User Action library against a stubbed page served from
// a fake origin, so it needs neither the app nor Supabase. Each test checks both the effect of
// the action and the log line it writes.
const ORIGIN = 'http://user-actions.test';

const FORM_PAGE = `
	<form action="?/publish" method="post" id="publish-form">
		<label>Name <input name="name"></label>
		<label>Password <input name="password" type="password"></label>
		<label>Role
			<select name="role">
				<option value="r1">Analyst</option>
				<option value="r2">Tester</option>
			</select>
		</label>
		<button type="button" id="count" onclick="this.textContent = 'clicked'">Count</button>
		<button type="submit">Publish</button>
	</form>
	<a href="/next/42">Go next</a>`;

async function stubOrigin(page: Page) {
	await page.route(`${ORIGIN}/**`, async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (request.method() === 'POST') {
			return route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
		}
		const body = url.pathname.startsWith('/next') ? '<h1>Next</h1>' : FORM_PAGE;
		return route.fulfill({ status: 200, contentType: 'text/html', body });
	});
}

/** Collects what User Actions log while `run` executes. */
async function captureLog(run: () => Promise<void>): Promise<string[]> {
	const lines: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		lines.push(args.join(' '));
	};
	try {
		await run();
	} finally {
		console.log = original;
	}
	return lines;
}

test.describe('Core User Actions', () => {
	test.beforeEach(async ({ page }) => {
		await stubOrigin(page);
	});

	test('goTo opens the path, returns the response and logs it', async ({ page }) => {
		const actions = new UserActions(page);
		let status: number | undefined;
		const lines = await captureLog(async () => {
			status = (await actions.goTo(`${ORIGIN}/`))?.status();
		});

		expect(status).toBe(200);
		expect(lines).toEqual([`🔹 [UserAction] Opened ${ORIGIN}/`]);
	});

	test('fill types the value and logs label and value', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		const lines = await captureLog(() =>
			actions.fill(page.getByLabel('Name'), 'Test Analyst', 'Name')
		);

		await expect(page.getByLabel('Name')).toHaveValue('Test Analyst');
		expect(lines).toEqual(['🔹 [UserAction] Filled "Name" with "Test Analyst"']);
	});

	test('fill shortens a long value in the log but types all of it', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		const long = 'x'.repeat(100);
		const lines = await captureLog(() => actions.fill(page.getByLabel('Name'), long, 'Name'));

		await expect(page.getByLabel('Name')).toHaveValue(long);
		expect(lines).toEqual([`🔹 [UserAction] Filled "Name" with "${'x'.repeat(40)}…"`]);
	});

	test('fillSecret types the value but never logs it', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		const lines = await captureLog(() =>
			actions.fillSecret(page.getByLabel('Password'), 'hunter2-secret', 'Password')
		);

		await expect(page.getByLabel('Password')).toHaveValue('hunter2-secret');
		expect(lines).toEqual(['🔹 [UserAction] Filled "Password" with ******']);
		expect(lines.join('\n')).not.toContain('hunter2');
	});

	test('select chooses by visible label or by value and logs the choice', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		const lines = await captureLog(async () => {
			await actions.select(page.getByLabel('Role'), { label: 'Tester' }, 'Role');
			await actions.select(page.getByLabel('Role'), 'r1', 'Role');
		});

		await expect(page.getByLabel('Role')).toHaveValue('r1');
		expect(lines).toEqual([
			'🔹 [UserAction] Selected "Tester" in "Role"',
			'🔹 [UserAction] Selected "r1" in "Role"'
		]);
	});

	test('click clicks the control and logs its label', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		const lines = await captureLog(() => actions.click(page.locator('#count'), 'Count'));

		await expect(page.locator('#count')).toHaveText('clicked');
		expect(lines).toEqual(['🔹 [UserAction] Clicked "Count"']);
	});

	test('clickAndWaitForAction waits for the form action POST and logs it', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		const posted = page.waitForRequest(
			(req) => req.method() === 'POST' && req.url().includes('?/publish')
		);
		const lines = await captureLog(() =>
			actions.clickAndWaitForAction(
				page.getByRole('button', { name: 'Publish' }),
				'publish',
				'Publish'
			)
		);

		await posted;
		expect(lines).toEqual(['🔹 [UserAction] Clicked "Publish" and the "publish" action completed']);
	});

	test('clickAndWaitForUrl follows the navigation and logs where it ended up', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		const lines = await captureLog(() =>
			actions.clickAndWaitForUrl(
				page.getByRole('link', { name: 'Go next' }),
				/\/next\/\d+$/,
				'Go next'
			)
		);

		await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
		expect(lines).toEqual([`🔹 [UserAction] Clicked "Go next" and navigated to ${ORIGIN}/next/42`]);
	});

	test('waitForUrl resolves once the browser is at the URL and logs it', async ({ page }) => {
		const actions = new UserActions(page);
		await actions.goTo(`${ORIGIN}/`);
		void page.evaluate(() => setTimeout(() => (location.href = '/next/7'), 50));
		const lines = await captureLog(() => actions.waitForUrl(/\/next\/7$/, 'the next page'));

		expect(lines).toEqual([`🔹 [UserAction] Reached "the next page" at ${ORIGIN}/next/7`]);
	});
});
