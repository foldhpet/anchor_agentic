<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1 class="text-2xl">New Agent</h1>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

{#if data.availableRoles.length === 0}
	<p class="mt-6 text-ink/70">
		All of your Roles already have an Agent. <a href="/roles/new">Create a new Role</a> first.
	</p>
{:else}
	<form method="POST" action="?/create" use:enhance class="mt-6 flex max-w-sm flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm">
			Role
			<select name="role_id" required class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
				{#each data.availableRoles as role (role.id)}
					<option value={role.id}>{role.name}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			System prompt
			<textarea name="system_prompt" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
			></textarea>
		</label>
		<button type="submit" class="self-start rounded-md bg-primary px-4 py-1.5 text-white"
			>Create Agent</button
		>
	</form>
{/if}

<p class="mt-6 text-sm"><a href="/roles/new">+ New Role</a></p>
