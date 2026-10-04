<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1 class="text-2xl">Log in</h1>

{#if data.reason === 'sandbox'}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		Register or log in to continue to the Sandbox.
	</p>
{:else if data.reason === 'expired'}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		Your session expired. Please log in again.
	</p>
{/if}

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

<form method="POST" class="mt-6 flex max-w-sm flex-col gap-4">
	<label class="flex flex-col gap-1 text-sm">
		Email
		<input
			type="email"
			name="email"
			required
			autocomplete="email"
			class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		/>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		Password
		<input
			type="password"
			name="password"
			required
			autocomplete="current-password"
			class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		/>
	</label>
	<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white">Log in</button>
</form>

<p class="mt-4 text-sm text-ink/70">Don't have an account? <a href="/register">Register</a></p>
