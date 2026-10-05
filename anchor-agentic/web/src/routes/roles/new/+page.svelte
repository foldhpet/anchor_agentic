<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<h1 class="text-2xl">New Role</h1>
<p class="mt-1 text-ink/70">
	A Role is a job function an Agent fulfills — define it once, then build Agents and Tasks under
	it.
</p>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

<form method="POST" action="?/create" use:enhance class="mt-6 flex max-w-sm flex-col gap-4">
	<label class="flex flex-col gap-1 text-sm">
		Name
		<input name="name" required class="rounded-md border border-ink/15 bg-bg px-3 py-1.5" />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		Description
		<input name="description" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5" />
	</label>
	<button type="submit" class="self-start rounded-md bg-primary px-4 py-1.5 text-white"
		>Create Role</button
	>
</form>
