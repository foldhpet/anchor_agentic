<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<h1 class="text-2xl">Register</h1>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

<form method="POST" class="mt-6 flex max-w-sm flex-col gap-4">
	<label class="flex flex-col gap-1 text-sm">
		Username
		<input
			name="username"
			required
			minlength="3"
			maxlength="32"
			autocomplete="username"
			class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		/>
	</label>
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
			minlength="8"
			autocomplete="new-password"
			class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		/>
	</label>
	<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white">Create account</button>
</form>

<p class="mt-4 text-sm text-ink/70">Already have an account? <a href="/login">Log in</a></p>
