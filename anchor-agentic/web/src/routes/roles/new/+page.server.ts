import { fail, redirect } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/api/client';
import type { Role } from '$lib/api/types';
import type { Actions } from './$types';

// US-053: a dedicated creation page, mirroring agents/new, skills/new,
// workflows/new — redirects to the new Role's own detail page on success.
// The /roles list page keeps its own inline create form unchanged; this is
// an additional entry point, not a replacement (see that story's Notes).
export const actions: Actions = {
	create: async ({ request, locals, fetch }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });

		let created: { role: Role };
		try {
			created = await apiRequest<{ role: Role }>('/api/v1/roles', {
				method: 'POST',
				body: JSON.stringify({ name, description: description || null }),
				accessToken: locals.session?.access_token,
				fetchFn: fetch
			});
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: err.message });
			throw err;
		}
		throw redirect(303, `/roles/${created.role.id}`);
	}
};
